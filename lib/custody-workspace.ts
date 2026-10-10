import { z } from "zod";
import { api } from "./api";
import { authContext, authEpoch } from "./auth";
import { canonicalIntent } from "./creation-intent";

const id = z.string().uuid(),
  actions = z.enum(["intake", "receive", "dispatch", "last-mile-offer"]);
export type CustodyAction = z.infer<typeof actions>;
const payload = z
  .object({
    orderId: id,
    action: actions,
    expectedEventId: id.nullable(),
    expectedUpdatedAt: z.string().datetime(),
    parcelIds: z.array(id).min(1).max(100),
    warehouseId: id,
    destinationWarehouseId: id.optional(),
    driverMembershipId: id.optional(),
    legId: id.optional(),
    outgoingDriverReason: z.string().trim().min(10).max(500).optional(),
  })
  .strict()
  .superRefine((p, c) => {
    if (new Set(p.parcelIds).size !== p.parcelIds.length)
      c.addIssue({
        code: "custom",
        message: "Complete unique parcel set required",
      });
    if (
      p.action === "dispatch" &&
      (!p.driverMembershipId || !p.destinationWarehouseId || !p.legId)
    )
      c.addIssue({
        code: "custom",
        message: "Select an eligible driver and planned internal leg",
      });
    if (p.action === "last-mile-offer" && !p.driverMembershipId)
      c.addIssue({
        code: "custom",
        message: "Select an eligible local driver",
      });
    if (p.action !== "dispatch" && (p.destinationWarehouseId || p.legId))
      c.addIssue({ code: "custom", message: "Unexpected transport target" });
    if (["intake", "receive"].includes(p.action) && p.driverMembershipId)
      c.addIssue({ code: "custom", message: "Unexpected driver target" });
    if (!["intake", "receive"].includes(p.action) && p.outgoingDriverReason)
      c.addIssue({
        code: "custom",
        message: "Reason applies to receiving only",
      });
  });
const receipt = z
  .object({
    orderId: id,
    operationId: id,
    eventId: id,
    phase: z.string(),
    status: z.string(),
    currentWarehouseId: id.nullable(),
    trackingId: id,
  })
  .strict();
const stored = z
  .object({
    version: z.literal(1),
    context: z.string().min(1),
    operationId: id,
    payload,
    display: z
      .object({ orderNumber: z.string().min(1), target: z.string().min(1) })
      .strict(),
    state: z.enum(["uncertain", "confirmed"]),
    result: receipt.optional(),
  })
  .strict();
export type CustodyIntent = z.infer<typeof stored>;
export function readCustodyIntent(raw: string | null) {
  if (raw === null) return null;
  const i = stored.parse(JSON.parse(raw));
  if (
    i.state === "confirmed" &&
    (!i.result ||
      i.result.operationId !== i.operationId ||
      i.result.orderId !== i.payload.orderId)
  )
    throw Error("Invalid custody confirmation");
  return i;
}
type IO = {
  current: () => boolean;
  read: () => string | null;
  write: (v: string) => void;
  uuid: () => string;
  lock: <T>(f: () => Promise<T>) => Promise<T>;
  send: (i: CustodyIntent) => Promise<unknown>;
};
export async function submitCustodyIntent(
  context: string,
  input: { payload: unknown; display: CustodyIntent["display"] } | null,
  io: IO,
) {
  const guard = () => {
    if (!io.current()) throw Error("Session changed");
  };
  guard();
  return io.lock(async () => {
    guard();
    let i = readCustodyIntent(io.read());
    const p = input ? payload.parse(input.payload) : null;
    if (
      i &&
      (i.context !== context ||
        (p && canonicalIntent(p) !== canonicalIntent(i.payload)))
    )
      throw Error(
        "Conflicting custody intent: preserve original action and target",
      );
    if (!i) {
      if (!p || !input) throw Error("No original custody intent");
      i = stored.parse({
        version: 1,
        context,
        operationId: io.uuid(),
        payload: p,
        display: input.display,
        state: "uncertain",
      });
    }
    const intent = i,
      persist = () => {
        guard();
        const raw = JSON.stringify(intent);
        io.write(raw);
        if (io.read() !== raw)
          throw Error("Persistence failed: custody sending blocked");
      };
    intent.state = "uncertain";
    persist();
    const result = receipt.parse(await io.send(structuredClone(intent)));
    guard();
    if (
      result.orderId !== intent.payload.orderId ||
      result.operationId !== intent.operationId
    )
      throw Error("Mismatched custody receipt");
    intent.result = result;
    intent.state = "confirmed";
    persist();
    return intent;
  });
}
function key(context: string) {
  return (
    "cp_warehouse_custody_v1:" +
    encodeURIComponent(String(api.defaults.baseURL ?? window.location.origin)) +
    ":" +
    encodeURIComponent(context)
  );
}
async function lock<T>(context: string, f: () => Promise<T>) {
  if (!navigator.locks)
    throw Error("Exclusive browser storage locking required");
  return navigator.locks.request(
    key(context),
    { ifAvailable: true },
    async (held) => {
      if (!held) throw Error("Another tab is submitting custody");
      return f();
    },
  );
}
export function pendingCustody(context: string) {
  const i = readCustodyIntent(localStorage.getItem(key(context)));
  if (i && i.context !== context) throw Error("Stored context mismatch");
  return i;
}
export async function mutateCustody(
  context: string,
  input: Parameters<typeof submitCustodyIntent>[1],
) {
  const epoch = authEpoch();
  return submitCustodyIntent(context, input, {
    current: () => context === authContext() && epoch === authEpoch(),
    read: () => localStorage.getItem(key(context)),
    write: (v) => localStorage.setItem(key(context), v),
    uuid: () => crypto.randomUUID(),
    lock: (f) => lock(context, f),
    send: async (i) => {
      const { orderId, ...data } = i.payload;
      return (
        await api.post(
          `/api/orders/${orderId}/custody`,
          { ...data, operationId: i.operationId },
          {
            timeout: 15000,
            noReplay: true,
            cashContext: context,
          } as Parameters<typeof api.post>[2],
        )
      ).data;
    },
  });
}
export async function finishCustody(context: string) {
  const epoch = authEpoch();
  return lock(context, async () => {
    if (context !== authContext() || epoch !== authEpoch())
      throw Error("Session changed");
    if (pendingCustody(context)?.state !== "confirmed")
      throw Error("Uncertain custody intent cannot be removed");
    localStorage.removeItem(key(context));
    if (localStorage.getItem(key(context)) !== null)
      throw Error("Storage failure");
  });
}
export async function readCustody<T>(
  context: string,
  path: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const epoch = authEpoch();
  if (!context || context !== authContext()) throw Error("Session changed");
  const r = await api.get(path, {
    params,
    timeout: 15000,
    noReplay: true,
  } as Parameters<typeof api.get>[1]);
  if (context !== authContext() || epoch !== authEpoch())
    throw Error("Session changed");
  return r.data as T;
}
export type CustodyWork = {
  orderId: string;
  orderNumber: string;
  status: string;
  phase: string;
  expectedUpdatedAt: string;
  expectedEventId: string | null;
  currentWarehouseId: string | null;
  destinationWarehouseId: string | null;
  legId: string | null;
};
export type CustodyPage = { items: CustodyWork[]; nextCursor: string | null };
export type CustodyPreflight = {
  orderId: string;
  orderNumber: string;
  status: string;
  updatedAt: string;
  actions: CustodyAction[];
  warehouses: { id: string; name: string }[];
  parcelIds: string[];
  parcels: {
    id: string;
    parcelCode: string;
    pieceNo: number;
    pieceTotal: number;
  }[];
  custody: {
    id: string;
    phase: string;
    warehouseId: string | null;
    destinationWarehouseId: string | null;
  } | null;
};
export type CustodyOptions = {
  items: { id: string; name: string; destinationWarehouseId?: string }[];
  nextCursor: string | null;
};
export function custodyActionLabel(a: CustodyAction) {
  return {
    intake: "Receive pickup handover",
    receive: "Receive accepted transport",
    dispatch: "Nominate linehaul transfer",
    "last-mile-offer": "Nominate last-mile driver",
  }[a];
}
