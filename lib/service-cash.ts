import { z } from "zod";
import { api } from "./api";
import { authContext, authEpoch } from "./auth";
import { canonicalIntent } from "./creation-intent";
const id = z.string().uuid();
const common = {
  orderId: id,
  kind: z.literal("service_charge"),
  note: z
    .string()
    .max(500)
    .regex(/^[^\x00-\x1f\x7f]*$/)
    .nullable()
    .default(null),
};
const schemas = {
  collect: z
    .object({ ...common, obligationId: id, warehouseId: id.optional() })
    .strict(),
  offer: z
    .object({
      ...common,
      expectedEventId: id,
      recipientMembershipId: id,
      recipientWarehouseId: id.nullable(),
    })
    .strict(),
  accept: z.object({ ...common, expectedEventId: id, offerId: id }).strict(),
  settle: z.object({ ...common, expectedEventId: id }).strict(),
};
export type CashAction = keyof typeof schemas;
export function cashPayload(action: CashAction, input: unknown) {
  return schemas[action].parse(input);
}
const exact = z
  .string()
  .regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/)
  .max(50);
const receiptSchema = z
  .object({
    orderId: id,
    orderNumber: z.string(),
    obligationId: id,
    kind: z.literal("service_charge"),
    action: z.enum(["collect", "offer", "accept", "settle"]),
    amount: exact,
    currency: z.string().regex(/^[A-Z]{3}$/),
    expectedEventId: id,
    offerId: id.nullable(),
    state: z.enum(["offered", "held", "settled"]),
    holderMembershipId: id.nullable(),
    holderWarehouseId: id.nullable(),
    sourceWarehouseId: id.nullable(),
  })
  .strict();
export type CashResult = z.infer<typeof receiptSchema>;
export type CashIntent = {
  version: 1;
  context: string;
  action: CashAction;
  operationId: string;
  payload: ReturnType<typeof cashPayload>;
  state: "uncertain" | "confirmed";
  result?: CashResult;
};
export function readCashIntent(raw: string | null): CashIntent | null {
  if (raw === null) return null;
  if (raw.length > 16000) throw Error("Invalid stored cash intent");
  const v = z
    .object({
      version: z.literal(1),
      context: z.string().min(1).max(2000),
      action: z.enum(["collect", "offer", "accept", "settle"]),
      operationId: id,
      payload: z.unknown(),
      state: z.enum(["uncertain", "confirmed"]),
      result: receiptSchema.optional(),
    })
    .strict()
    .parse(JSON.parse(raw));
  const i = { ...v, payload: cashPayload(v.action, v.payload) };
  if (i.state === "confirmed") {
    if (!i.result) throw Error("Unproven receipt");
    validateCashReceipt(i, { success: true, order: i.result });
  }
  return i;
}
export function validateCashReceipt(i: CashIntent, raw: unknown): CashResult {
  const r = z
    .object({ success: z.literal(true), order: receiptSchema })
    .strict()
    .parse(raw).order;
  const p = i.payload,
    selected = JSON.parse(i.context);
  if (
    !Array.isArray(selected) ||
    selected.length !== 5 ||
    r.orderId !== p.orderId ||
    r.action !== i.action
  )
    throw Error("Receipt context mismatch");
  if (
    i.action === "collect" &&
    (("obligationId" in p && r.obligationId !== p.obligationId) ||
      r.state !== "held" ||
      r.offerId !== null ||
      r.holderMembershipId !== selected[4] ||
      r.holderWarehouseId !== ("warehouseId" in p ? p.warehouseId : null))
  )
    throw Error("Collection receipt mismatch");
  if (
    i.action === "offer" &&
    (!("expectedEventId" in p) ||
      r.expectedEventId !== p.expectedEventId ||
      r.state !== "offered" ||
      !r.offerId ||
      r.holderMembershipId !== selected[4])
  )
    throw Error("Offer is not an accepted transfer");
  if (
    i.action === "accept" &&
    (!("offerId" in p) ||
      r.offerId !== p.offerId ||
      r.state !== "held" ||
      r.holderMembershipId !== selected[4])
  )
    throw Error("Acceptance receipt mismatch");
  if (
    i.action === "settle" &&
    (r.state !== "settled" ||
      r.holderMembershipId !== null ||
      r.holderWarehouseId !== null ||
      r.offerId !== null)
  )
    throw Error("Settlement receipt mismatch");
  return r;
}
type IO = {
  current: () => boolean;
  read: () => string | null;
  write: (v: string) => void;
  uuid: () => string;
  lock: <T>(f: () => Promise<T>) => Promise<T>;
  send: (i: CashIntent) => Promise<unknown>;
};
export async function submitCashIntent(
  context: string,
  action: CashAction,
  input: unknown | null,
  io: IO,
) {
  const guard = () => {
    if (!context || !io.current())
      throw Error("Session changed; original cash intent retained");
  };
  guard();
  return io.lock(async () => {
    guard();
    let i = readCashIntent(io.read());
    const p = input === null ? null : cashPayload(action, input);
    if (
      i &&
      (i.context !== context ||
        i.action !== action ||
        (p && canonicalIntent(p) !== canonicalIntent(i.payload)))
    )
      throw Error(
        "Conflicting cash intent: retain the original target and content",
      );
    if (!i) {
      if (!p) throw Error("No original cash intent");
      i = {
        version: 1,
        context,
        action,
        operationId: id.parse(io.uuid()),
        payload: p,
        state: "uncertain",
      };
    }
    const intent = i,
      persist = () => {
        guard();
        const raw = JSON.stringify(intent);
        io.write(raw);
        if (io.read() !== raw)
          throw Error("Persistence failed: cash sending blocked");
      };
    intent.state = "uncertain";
    persist();
    const result = validateCashReceipt(
      intent,
      await io.send(structuredClone(intent)),
    );
    guard();
    intent.result = result;
    intent.state = "confirmed";
    persist();
    return intent;
  });
}
function key(context: string) {
  return (
    "cp_service_cash_v1:" +
    encodeURIComponent(String(api.defaults.baseURL ?? window.location.origin)) +
    ":" +
    encodeURIComponent(context)
  );
}
async function locked<T>(k: string, f: () => Promise<T>) {
  if (!navigator.locks) throw Error("Exclusive browser locking required");
  return navigator.locks.request(k, { ifAvailable: true }, async (lock) => {
    if (!lock) throw Error("Another tab is submitting cash");
    return f();
  });
}
export function pendingCash(context: string) {
  const i = readCashIntent(localStorage.getItem(key(context)));
  if (i && i.context !== context) throw Error("Stored context mismatch");
  return i;
}
export function legacyCashPending() {
  return localStorage.getItem("cargopilot_cash_intent_v1") !== null;
}
export function cashRequest(i: CashIntent) {
  const { orderId, ...body } = cashPayload(i.action, i.payload);
  return {
    url: `/api/orders/${orderId}/cash/${{ collect: "collect", offer: "handoff", accept: "handoff/accept", settle: "settle" }[i.action]}`,
    data: { ...body, operationId: i.operationId },
  };
}
export async function mutateCashAction(
  context: string,
  action: CashAction,
  input: unknown | null,
) {
  const epoch = authEpoch();
  return submitCashIntent(context, action, input, {
    current: () => context === authContext() && epoch === authEpoch(),
    read: () => localStorage.getItem(key(context)),
    write: (v) => localStorage.setItem(key(context), v),
    uuid: () => crypto.randomUUID(),
    lock: (f) => locked(key(context), f),
    send: async (i) =>
      (
        await api.post(cashRequest(i).url, cashRequest(i).data, {
          timeout: 15000,
          noReplay: true,
          cashContext: context,
        } as Parameters<typeof api.post>[2])
      ).data,
  });
}
export async function finishCash(context: string) {
  const epoch = authEpoch();
  return locked(key(context), async () => {
    if (context !== authContext() || epoch !== authEpoch())
      throw Error("Session changed");
    if (pendingCash(context)?.state !== "confirmed")
      throw Error("Uncertain cash intent cannot be removed");
    localStorage.removeItem(key(context));
    if (localStorage.getItem(key(context)) !== null)
      throw Error("Storage failure");
  });
}
export async function readCash<T>(
  context: string,
  path: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const epoch = authEpoch();
  if (!context || context !== authContext()) throw Error("Session changed");
  const r = await api.get("/api/orders" + path, {
    params,
    timeout: 15000,
    noReplay: true,
  } as Parameters<typeof api.get>[1]);
  if (context !== authContext() || epoch !== authEpoch())
    throw Error("Session changed");
  return r.data as T;
}
export function cashError(error: unknown) {
  const e = error as {
    message?: string;
    response?: { data?: { error?: string; code?: string } };
  };
  return (
    e.response?.data?.code ??
    e.response?.data?.error ??
    e.message ??
    "No confirmation. Preserve the original intent and explicitly retry."
  );
}
export type CashAccess = {
  membershipId: string;
  profileRevision: string;
  acceptanceId: string;
  legalEntityId: string;
  permissions: string[];
  kinds: string[];
  warehouses: { id: string; name: string }[];
};
export type CashWork = {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  obligationId: string;
  collectionParty: "SENDER" | "RECIPIENT";
  kind: "service_charge";
  amount: string | null;
  currency: string | null;
  expectedEventId: string | null;
  state: string;
  holderMembershipId: string | null;
  holderWarehouseId: string | null;
  holderName: string | null;
  holderWarehouseName: string | null;
  offerId: string | null;
  recipientMembershipId: string | null;
  recipientWarehouseId: string | null;
  recipientName: string | null;
  recipientWarehouseName: string | null;
};
export type CashPage = {
  items: CashWork[];
  meta: { hasNext: boolean; nextCursor: string | null; limit: number };
};
export type RecipientPage = {
  items: {
    membershipId: string;
    name: string;
    profileRevision: string;
    warehouseId: string | null;
  }[];
  expectedEventId: string;
  meta: { hasNext: boolean; nextCursor: string | null; limit: number };
};
/** UI affordances only. Server execution always reloads capability, exact custody and obligation. */
export function cashAvailableActions(
  cap: CashAccess,
  w: CashWork,
): CashAction[] {
  const result: CashAction[] = [];
  const timely =
    w.collectionParty === "SENDER"
      ? ["assigned", "pickup_in_progress"].includes(w.orderStatus)
      : w.orderStatus ===
        (cap.profileRevision === "warehouse-cash.v1"
          ? "at_warehouse"
          : "out_for_delivery");
  if (
    cap.permissions.includes("cash.collect") &&
    !w.expectedEventId &&
    w.amount &&
    !/^0(?:\.0+)?$/.test(w.amount) &&
    timely
  )
    result.push("collect");
  if (
    cap.permissions.includes("cash.handoff") &&
    w.state === "held" &&
    w.expectedEventId
  ) {
    if (w.holderMembershipId === cap.membershipId && !w.offerId) result.push("offer");
    if (w.offerId && w.recipientMembershipId === cap.membershipId)
      result.push("accept");
  }
  if (
    cap.permissions.includes("cash.settle") &&
    w.state === "held" &&
    w.holderWarehouseId &&
    w.holderMembershipId !== cap.membershipId
  )
    result.push("settle");
  return result;
}
