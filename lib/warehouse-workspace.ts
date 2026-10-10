import { z } from "zod";
import { api } from "./api";
import { authContext, authEpoch } from "./auth";
import { canonicalIntent } from "./creation-intent";

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .regex(/^[^\u0000-\u001f\u007f]+$/);
export const warehouseFields = z
  .object({
    name: text(160),
    location: text(500),
    type: z.enum(["warehouse", "pickup_point"]).default("warehouse"),
    region: z
      .string()
      .trim()
      .max(160)
      .regex(/^[^\u0000-\u001f\u007f]*$/)
      .nullable()
      .optional()
      .transform((v) => v || null),
    latitude: z
      .number()
      .finite()
      .min(-90)
      .max(90)
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    longitude: z
      .number()
      .finite()
      .min(-180)
      .max(180)
      .nullable()
      .optional()
      .transform((v) => v ?? null),
  })
  .strict();
export type WarehouseFields = z.infer<typeof warehouseFields>;
const row = warehouseFields
  .extend({ id: z.string().uuid(), createdAt: z.string().datetime() })
  .strip();
const detail = row
  .extend({
    users: z.array(z.unknown()).max(0),
    orders: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            orderNumber: z.union([z.string(), z.number()]),
            status: z.string(),
            serviceType: z.string().nullable(),
            createdAt: z.string().datetime(),
            updatedAt: z.string().datetime(),
          })
          .strip(),
      )
      .max(100),
  })
  .strip();
export type WarehouseRow = z.infer<typeof row>;
export type WarehouseDetail = z.infer<typeof detail>;
const authority = z
  .object({
    profileRevision: z.literal("warehouse-provisioning.v1"),
    companyMembershipId: z.string().uuid(),
    companyId: z.string().uuid(),
    tenantId: z.string().uuid(),
    accepted: z.literal(true),
  })
  .strip();
const stored = z
  .object({
    version: z.literal(1),
    context: z.string().min(1),
    operationId: z.string().uuid(),
    kind: z.enum(["create", "edit"]),
    id: z.string().uuid().optional(),
    payload: warehouseFields,
    state: z.enum(["uncertain", "rejected", "confirmed"]),
    result: row.optional(),
  })
  .strict();
export type WarehouseIntent = z.infer<typeof stored>;
export type WarehouseIO = {
  current(): boolean;
  read(): string | null;
  write(raw: string): void;
  uuid(): string;
  lock<T>(work: () => Promise<T>): Promise<T>;
  send(i: WarehouseIntent): Promise<unknown>;
};
export function readWarehouseIntent(raw: string | null) {
  if (!raw) return null;
  if (raw.length > 20000) throw Error("Unreadable warehouse intent");
  const i = stored.parse(JSON.parse(raw));
  if (i.kind === "edit" && !i.id) throw Error("Missing edit identity");
  if (i.state === "confirmed" && !i.result) throw Error("Missing receipt");
  return i;
}
export async function submitWarehouseIntent(
  kind: "create" | "edit",
  context: string,
  input: unknown | null,
  io: WarehouseIO,
  id?: string,
) {
  const guard = () => {
    if (!context || !io.current()) throw Error("Selected context changed");
  };
  guard();
  const payload = input === null ? null : warehouseFields.parse(input);
  return io.lock(async () => {
    guard();
    let i = readWarehouseIntent(io.read());
    if (i && (i.context !== context || i.kind !== kind || i.id !== id))
      throw Error("Original intent context mismatch");
    if (i && payload && canonicalIntent(i.payload) !== canonicalIntent(payload))
      throw Error("Preserve original immutable warehouse intent");
    if (i && kind === "edit")
      throw Error(
        "Edits have no server retry receipt; review the authoritative detail before another action",
      );
    if (!i) {
      if (!payload) throw Error("No original intent");
      i = {
        version: 1,
        context,
        operationId: z.string().uuid().parse(io.uuid()),
        kind,
        ...(id ? { id } : {}),
        payload,
        state: "uncertain",
      };
    }
    const intent = i;
    const persist = () => {
      guard();
      const raw = JSON.stringify(intent);
      io.write(raw);
      if (io.read() !== raw)
        throw Error("Storage verification failed; sending is blocked");
    };
    intent.state = "uncertain";
    persist();
    try {
      const result = row.parse(
        await io.send(JSON.parse(JSON.stringify(intent))),
      );
      guard();
      if (kind === "edit" && result.id !== id)
        throw Error("Edit result mismatch");
      intent.result = result;
      intent.state = "confirmed";
      persist();
      return intent;
    } catch (error) {
      if (io.current() && intent.state !== "confirmed") {
        const status = (error as { response?: { status?: number } }).response
          ?.status;
        if (kind === "edit" && [400, 401, 403, 404].includes(status ?? 0))
          intent.state = "rejected";
        persist();
      }
      throw error;
    }
  });
}
function key(context: string, kind: string) {
  return `cp_warehouse_v1:${encodeURIComponent(String(api.defaults.baseURL ?? window.location.origin))}:${encodeURIComponent(context)}:${kind}`;
}
export function pendingWarehouse(context: string, kind: "create" | "edit") {
  const i = readWarehouseIntent(localStorage.getItem(key(context, kind)));
  if (i && (i.context !== context || i.kind !== kind))
    throw Error("Stored context mismatch");
  return i;
}
async function lock<T>(name: string, work: () => Promise<T>) {
  if (!navigator.locks) throw Error("Browser locking is required");
  return navigator.locks.request(name, { ifAvailable: true }, async (l) => {
    if (!l) throw Error("Another tab is sending this operation");
    return work();
  });
}
export async function finishWarehouse(
  context: string,
  kind: "create" | "edit",
) {
  const epoch = authEpoch();
  await lock(key(context, kind), async () => {
    if (context !== authContext() || epoch !== authEpoch())
      throw Error("Context changed");
    const i = pendingWarehouse(context, kind);
    if (
      !i ||
      (i.state !== "confirmed" && !(kind === "edit" && i.state === "rejected"))
    )
      throw Error("Uncertain intent must remain preserved");
    localStorage.removeItem(key(context, kind));
    if (pendingWarehouse(context, kind)) throw Error("Storage unavailable");
  });
}
function current(context: string) {
  const epoch = authEpoch();
  return () => context === authContext() && epoch === authEpoch();
}
export async function writeWarehouse(
  context: string,
  kind: "create" | "edit",
  input: unknown | null,
  id?: string,
) {
  const ok = current(context),
    name = key(context, kind);
  return submitWarehouseIntent(
    kind,
    context,
    input,
    {
      current: ok,
      read: () => localStorage.getItem(name),
      write: (raw) => localStorage.setItem(name, raw),
      uuid: () => crypto.randomUUID(),
      lock: (work) => lock(name, work),
      send: async (i) => {
        const config = { timeout: 15000, noReplay: true } as Parameters<
          typeof api.post
        >[2];
        return (
          kind === "create"
            ? await api.post(
                "/api/warehouses",
                { ...i.payload, operationId: i.operationId },
                config,
              )
            : await api.put(`/api/warehouses/${i.id}`, i.payload, config)
        ).data;
      },
    },
    id,
  );
}
export async function readWarehouseWorkspace(
  context: string,
  kind: "list",
  input: { search?: string; page?: number },
): Promise<WarehouseRow[]>;
export async function readWarehouseWorkspace(
  context: string,
  kind: "detail",
  input: { id: string },
): Promise<WarehouseDetail>;
export async function readWarehouseWorkspace(
  context: string,
  kind: "authority",
): Promise<z.infer<typeof authority>>;
export async function readWarehouseWorkspace(
  context: string,
  kind: "list" | "detail" | "authority",
  input: { search?: string; page?: number; id?: string } = {},
) {
  const ok = current(context);
  if (!context || !ok()) throw Error("Selected context changed");
  const page = z
      .number()
      .int()
      .min(1)
      .max(10000)
      .parse(input.page ?? 1),
    search = z
      .string()
      .max(120)
      .parse(input.search ?? "");
  const url =
    kind === "list"
      ? "/api/warehouses"
      : kind === "authority"
        ? "/api/warehouses/provisioning-authority"
        : `/api/warehouses/${z.string().uuid().parse(input.id)}`;
  const r = await api.get(url, {
    params: kind === "list" ? { search, page, limit: 20 } : undefined,
    timeout: 15000,
    noReplay: true,
  } as Parameters<typeof api.get>[1]);
  if (!ok()) throw Error("Selected context changed");
  return (
    kind === "list"
      ? z.array(row).max(20)
      : kind === "detail"
        ? detail
        : authority
  ).parse(r.data);
}
export function warehouseError(e: unknown) {
  const status = (
    e as { response?: { status?: number; data?: { error?: string } } }
  ).response?.status;
  if (status === 403)
    return "Current permission, explicit scope or accepted provisioning authority is missing or revoked.";
  if (status === 404)
    return "This warehouse is unavailable in the selected context.";
  if (status === 400)
    return "Fields or query were rejected; check the supported contract.";
  if (status === 409)
    return "Warehouse operation conflict: preserve the original identity/content for review.";
  return "No confirmation received. Preserve the original context and intent. Edits cannot be automatically retried.";
}
