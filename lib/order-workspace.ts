import { z } from "zod";
import { api } from "./api";
import { authContext, authEpoch } from "./auth";
import {
  readCreationIntent,
  submitCreationIntent,
  type CreationIntent,
} from "./creation-intent";
import { SERVICE_TYPES } from "./orders/service-types";

const text = z.string().trim().max(2048);
const person = z
  .object({
    name: text,
    phone: text,
    phone2: text.optional(),
    phone3: text.optional(),
  })
  .strict();
const routeAddress = z
  .object({
    country: text.optional(),
    city: text.optional(),
    neighborhood: text.optional(),
    street: text.optional(),
    addressLine1: text.optional(),
    addressLine2: text.optional(),
    building: text.optional(),
    apartment: text.optional(),
    floor: text.optional(),
    landmark: text.optional(),
    postalCode: text.optional(),
    latitude: z.number().finite().min(-90).max(90).optional(),
    longitude: z.number().finite().min(-180).max(180).optional(),
    addressType: z.enum(["RESIDENTIAL", "BUSINESS"]).optional(),
  })
  .strict();
const measurement = z.number().finite().positive().optional();
const parcel = z
  .object({
    weightKg: measurement,
    lengthCm: measurement,
    widthCm: measurement,
    heightCm: measurement,
  })
  .strict();
export const ROUTE_MODES = [
  "ROAD",
  "AIR",
  "SEA",
  "RAIL",
  "COURIER",
  "MULTIMODAL",
] as const;
/** Optional extensions have no defaults: previously persisted v1 intents retain their exact content. */
export const normalOrderInput = z
  .object({
    customerEntityId: z.string().uuid().nullable(),
    sender: person,
    receiver: person,
    addresses: z
      .object({
        pickupAddress: text.min(3),
        dropoffAddress: text.min(3),
        destinationCity: text,
        senderAddressId: z.string().uuid().nullable(),
        receiverAddressId: z.string().uuid().nullable(),
        senderAddress: routeAddress.optional(),
        receiverAddress: routeAddress.optional(),
      })
      .strict(),
    shipment: z
      .object({
        serviceType: z.enum(SERVICE_TYPES),
        weightKg: z.number().positive().max(100000),
        pieceTotal: z.number().int().min(1).max(100),
        currency: z.enum(["UZS", "USD", "CNY"]),
        codEnabled: z.literal(false),
        parcels: z.array(parcel).min(1).max(100).optional(),
        transportMode: z.enum(ROUTE_MODES).optional(),
        fragile: z.boolean().optional(),
        dangerousGoods: z.boolean().optional(),
        shipmentInsurance: z.boolean().optional(),
      })
      .strict(),
    schedule: z
      .object({
        plannedPickupAt: z.string().datetime().optional(),
        plannedDeliveryAt: z.string().datetime().optional(),
        promiseDate: z.string().datetime().optional(),
      })
      .strict()
      .optional(),
    reference: z
      .object({
        referenceId: text,
        shelfId: text.optional(),
        promoCode: text.optional(),
        numberOfCalls: z.number().int().nonnegative().optional(),
      })
      .strict(),
    note: text,
  })
  .strict()
  .superRefine((v, c) => {
    if (
      v.shipment.parcels &&
      v.shipment.parcels.length !== v.shipment.pieceTotal
    )
      c.addIssue({
        code: "custom",
        path: ["shipment", "parcels"],
        message: "Measurements must match the parcel count",
      });
    if (
      !v.customerEntityId &&
      (v.addresses.senderAddressId || v.addresses.receiverAddressId)
    )
      c.addIssue({
        code: "custom",
        path: ["customerEntityId"],
        message: "Select the owning customer",
      });
  });
const csvInput = z
  .object({
    csvText: z
      .string()
      .min(1)
      .refine(
        (v) => new TextEncoder().encode(v).length <= 1024 * 1024,
        "CSV exceeds 1 MiB",
      ),
    customerEntityId: z.string().uuid().nullable(),
  })
  .strict();
const receiptOrder = z.object({
  id: z.string().uuid(),
  orderNumber: z.union([z.string(), z.number()]).nullable().optional(),
});
const importResult = z
  .object({
    success: z.literal(true),
    count: z.number().int().positive().max(100),
    orders: z.array(receiptOrder).min(1).max(100),
    replayedRows: z.number().int().nonnegative().max(100),
    downstreamRecoveryRequired: z.boolean(),
  })
  .refine((v) => v.count === v.orders.length && v.replayedRows <= v.count);
function guard(context: string, epoch: string) {
  if (!context || context !== authContext() || epoch !== authEpoch())
    throw Error("Session changed; result suppressed");
}
function key(context: string, kind: CreationIntent["kind"]) {
  if (!context) throw Error("Selected context required");
  return `cp_creation_v1:${encodeURIComponent(String(api.defaults.baseURL ?? window.location.origin))}:${encodeURIComponent(context)}:${kind}`;
}
export function pendingCreation(context: string, kind: CreationIntent["kind"]) {
  const i = readCreationIntent(localStorage.getItem(key(context, kind)));
  if (i && (i.context !== context || i.kind !== kind))
    throw Error("Stored context mismatch");
  return i;
}
export function finishCreation(context: string, kind: CreationIntent["kind"]) {
  if (pendingCreation(context, kind)?.state !== "confirmed")
    throw Error("Unconfirmed intent cannot be replaced");
  localStorage.removeItem(key(context, kind));
  if (pendingCreation(context, kind)) throw Error("Storage unavailable");
}
export async function createInWorkspace(
  context: string,
  kind: CreationIntent["kind"],
  payload: unknown | null,
) {
  const epoch = authEpoch();
  guard(context, epoch);
  const input =
    payload === null
      ? null
      : kind === "order"
        ? normalOrderInput.parse(payload)
        : csvInput.parse(payload);
  if (!navigator.locks) throw Error("Supported browser locking is required");
  return submitCreationIntent(kind, input, {
    context: authContext,
    epoch: authEpoch,
    uuid: () => crypto.randomUUID(),
    read: () => localStorage.getItem(key(context, kind)),
    write: (raw) => localStorage.setItem(key(context, kind), raw),
    lock: async (work) =>
      await navigator.locks.request(
        key(context, kind),
        { ifAvailable: true },
        async (lock) => {
          if (!lock) throw Error("Another tab is submitting");
          return await work();
        },
      ),
    send: async (i) => {
      guard(context, epoch);
      // Validate recovered payload again; storage is not an authority or arbitrary API client.
      const body =
        kind === "order"
          ? normalOrderInput.parse(i.payload)
          : csvInput.parse(i.payload);
      const r = await api.post(
        kind === "order" ? "/api/orders" : "/api/orders/import/confirm",
        { ...body, operationId: z.string().uuid().parse(i.operationId) },
        { timeout: 20000, noReplay: true } as Parameters<typeof api.post>[2],
      );
      guard(context, epoch);
      if (kind === "import") {
        const v = importResult.parse(r.data);
        return {
          orders: v.orders,
          replayedRows: v.replayedRows,
          downstreamRecoveryRequired: v.downstreamRecoveryRequired,
        };
      }
      const v = z
        .object({
          order: receiptOrder,
          creationReplay: z.boolean(),
          downstreamRecoveryRequired: z.boolean().optional(),
        })
        .parse(r.data);
      return {
        orders: [v.order],
        replayedRows: v.creationReplay ? 1 : 0,
        downstreamRecoveryRequired: v.downstreamRecoveryRequired ?? false,
      };
    },
  });
}
export async function previewInWorkspace(context: string, payload: unknown) {
  const epoch = authEpoch();
  guard(context, epoch);
  const body = csvInput.parse(payload);
  const r = await api.post("/api/orders/import/preview", body, {
    timeout: 20000,
    noReplay: true,
  } as Parameters<typeof api.post>[2]);
  guard(context, epoch);
  return z
    .object({
      totalRows: z.number().int().min(1).max(100),
      validRows: z.number().int().nonnegative(),
      invalidRows: z.number().int().nonnegative(),
      rows: z
        .array(
          z.object({
            rowNumber: z.number().int(),
            valid: z.boolean(),
            errors: z.array(z.string()),
            summary: z.object({
              receiverName: z.string(),
              pickupAddress: z.string(),
              dropoffAddress: z.string(),
              serviceType: z.string(),
            }),
          }),
        )
        .max(100),
    })
    .parse(r.data);
}
export async function templateInWorkspace(context: string) {
  const epoch = authEpoch();
  guard(context, epoch);
  const r = await api.get("/api/orders/import/template.csv", {
    responseType: "blob",
    timeout: 15000,
  });
  guard(context, epoch);
  if (!(r.data instanceof Blob) || r.data.size > 1024 * 1024)
    throw Error("Unsupported CSV template response");
  return r.data as Blob;
}

const statusRow = z.discriminatedUnion("state", [
  z
    .object({
      ordinal: z.number().int().nonnegative(),
      state: z.literal("pending"),
    })
    .strict(),
  z
    .object({
      ordinal: z.number().int().nonnegative(),
      state: z.literal("committed"),
      confirmedAt: z.string().datetime(),
      order: receiptOrder.strip(),
    })
    .strict(),
]);
const statusResult = z
  .object({
    operationId: z.string().uuid(),
    kind: z.literal("import"),
    acceptedAt: z.string().datetime(),
    rowCount: z.number().int().min(1).max(100),
    complete: z.boolean(),
    rows: z.array(statusRow).min(1).max(100),
    downstreamCompletion: z.literal("not_assessed"),
  })
  .strict()
  .refine(
    (v) =>
      v.rows.length === v.rowCount &&
      v.rows.every((r, i) => r.ordinal === i) &&
      v.complete === v.rows.every((r) => r.state === "committed"),
  );
export async function importReceiptStatus(
  context: string,
  operationId: string,
) {
  const epoch = authEpoch();
  guard(context, epoch);
  const id = z.string().uuid().parse(operationId);
  const response = await api.get(`/api/orders/import/${id}/status`, {
    timeout: 15000,
  });
  guard(context, epoch);
  const status = statusResult.parse(response.data);
  if (status.operationId !== id) throw Error("Receipt identity mismatch");
  return status;
}
