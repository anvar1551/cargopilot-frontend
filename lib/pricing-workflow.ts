import { z } from "zod";
import { api } from "./api";
import { authContext, authEpoch } from "./auth";
import { canonicalIntent } from "./creation-intent";
const id = z.string().uuid(),
  hash = z.string().regex(/^[a-f0-9]{64}$/),
  reason = z.string().trim().min(1).max(1000);
const decimal = z
  .string()
  .regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/)
  .max(40);
const country = z
  .string()
  .trim()
  .regex(/^[A-Z]{2}$/);
const service = z.enum([
  "DOOR_TO_DOOR",
  "DOOR_TO_POINT",
  "POINT_TO_DOOR",
  "POINT_TO_POINT",
]);
const mode = z.enum(["ROAD", "AIR", "SEA", "RAIL", "COURIER", "MULTIMODAL"]);
export const tariffDraft = z
  .object({
    name: z.string().trim().min(1).max(160),
    code: z.string().trim().max(40).nullable(),
    description: z.string().max(500).nullable(),
    status: z.enum(["draft", "active", "archived"]),
    serviceType: service,
    priceType: z.enum(["bucket", "linear"]),
    pricingStrategy: z.enum(["FIXED_LANE", "LEG_TRANSIT"]),
    coverageType: z.enum(["domestic", "international"]),
    transportMode: mode,
    originCountryCode: country.nullable(),
    destinationCountryCode: country.nullable(),
    routeTemplateId: id.nullable(),
    currency: z.enum(["UZS", "USD", "CNY"]),
    priority: z.number().int().nonnegative(),
    isDefault: z.boolean(),
    customerEntityId: id.nullable(),
    rates: z
      .array(
        z
          .object({
            zone: z.number().int().min(0).max(99),
            weightFromKg: z.number().nonnegative(),
            weightToKg: z.number().positive(),
            price: z.number().nonnegative(),
          })
          .strict()
          .refine((r) => r.weightToKg > r.weightFromKg),
      )
      .max(1000),
    transitLegRates: z
      .array(
        z
          .object({
            sequence: z.number().int().positive(),
            legCode: z.string().min(1).max(48),
            label: z.string().max(120).nullable().optional(),
            mode: mode.nullable().optional(),
            originCountryCode: country,
            destinationCountryCode: country,
            ratePerKg: z.number().nonnegative(),
            minCharge: z.number().nonnegative().nullable().optional(),
            flatFee: z.number().nonnegative().nullable().optional(),
          })
          .strict(),
      )
      .max(50),
  })
  .strict();
const key = z
  .string()
  .regex(/^[A-Za-z0-9_.-]+$/)
  .min(1)
  .max(60);
export const policyContent = z
  .object({
    currency: z.string().regex(/^[A-Z]{3}$/),
    precision: z.number().int().min(0).max(4),
    rounding: z.enum(["HALF_UP", "HALF_EVEN", "DOWN", "UP"]),
    weight: z
      .object({
        source: z.literal("recorded_order_kg"),
        rule: z.literal("as_recorded"),
      })
      .strict(),
    zones: z
      .object({
        source: z.literal("structured_address_cities"),
        mappings: z
          .array(
            z
              .object({
                origin: z.string().trim().min(1).max(100),
                destination: z.string().trim().min(1).max(100),
                originCountry: country,
                destinationCountry: country,
                zone: z.number().int().min(0).max(1000),
                coverageType: z.enum(["domestic", "international"]),
                transportMode: mode,
              })
              .strict(),
          )
          .min(1)
          .max(100),
      })
      .strict(),
    tariff: z
      .object({
        strategy: z.literal("FIXED_LANE"),
        priceType: z.literal("bucket"),
        includedServices: z.array(key).min(1).max(30),
      })
      .strict(),
    fees: z.array(z.object({ service: key, amount: decimal }).strict()).max(30),
    discounts: z
      .array(
        z
          .object({
            code: key,
            type: z.enum(["flat", "percent"]),
            value: decimal,
          })
          .strict(),
      )
      .max(10),
    tax: z.discriminatedUnion("treatment", [
      z
        .object({
          treatment: z.literal("exclusive_percent"),
          rate: decimal,
          authorityReference: z.string().min(1).max(200),
        })
        .strict(),
      z
        .object({
          treatment: z.enum(["exempt", "not_applicable"]),
          authorityReference: z.string().min(1).max(200),
        })
        .strict(),
    ]),
    calculationOrder: z.enum(["discount_then_tax", "tax_then_discount"]),
    roundingStage: z.literal("each_component"),
    billing: z
      .object({
        mode: z.literal("manual"),
        eligibleOrderStates: z
          .array(
            z.enum([
              "pending",
              "assigned",
              "pickup_in_progress",
              "picked_up",
              "at_warehouse",
              "in_transit",
              "out_for_delivery",
              "delivered",
              "exception",
              "return_in_progress",
              "returned",
            ]),
          )
          .min(1)
          .max(15),
        dueDays: z.number().int().min(0).max(365),
        numberPrefix: z
          .string()
          .regex(/^[A-Z0-9-]+$/)
          .min(1)
          .max(20),
      })
      .strict(),
  })
  .strict();
const schemas = {
  draftCreate: z.object({ draft: tariffDraft }).strict(),
  draftUpdate: z.object({ planId: id, draft: tariffDraft }).strict(),
  draftDelete: z.object({ planId: id }).strict(),
  tariffPropose: z
    .object({
      planId: id,
      expectedGeneration: z.number().int().nonnegative(),
      reason,
    })
    .strict(),
  tariffDecide: z
    .object({
      planId: id,
      versionId: id,
      contentSha256: hash,
      decision: z.enum(["approved", "rejected"]),
      reason,
    })
    .strict(),
  policyPropose: z.object({ content: policyContent, reason }).strict(),
  policyDecide: z
    .object({
      versionId: id,
      contentHash: hash,
      decision: z.enum(["approved", "rejected"]),
      reason,
    })
    .strict(),
  payer: z
    .object({
      orderId: id,
      payerCustomerEntityId: id,
      evidence: z.string().trim().min(1).max(500),
      reason,
    })
    .strict(),
  instruction: z
    .object({
      orderId: id,
      billToId: id,
      method: z.literal("CASH"),
      collectionParty: z.enum(["SENDER", "RECIPIENT"]),
      evidence: z.string().trim().min(1).max(500),
      reason,
    })
    .strict(),
  price: z.object({ orderId: id, reason }).strict(),
  priceApprove: z
    .object({ orderId: id, snapshotId: id, contentHash: hash, reason })
    .strict(),
};
export type PricingKind = keyof typeof schemas;
export function pricingPayload(kind: PricingKind, v: unknown) {
  return schemas[kind].parse(v) as Record<string, unknown>;
}
export type PricingIntent = {
  version: 1;
  context: string;
  kind: PricingKind;
  operationId: string;
  payload: Record<string, unknown>;
  state: "uncertain" | "confirmed";
  result?: Record<string, unknown>;
};
const kinds = Object.keys(schemas) as [PricingKind, ...PricingKind[]];
export function readPricingIntent(raw: string | null): PricingIntent | null {
  if (!raw) return null;
  if (raw.length > 300000) throw Error("Intent exceeds storage bound");
  const i = z
    .object({
      version: z.literal(1),
      context: z.string().min(1).max(1000),
      kind: z.enum(kinds),
      operationId: id,
      payload: z.record(z.string(), z.unknown()),
      state: z.enum(["uncertain", "confirmed"]),
      result: z.record(z.string(), z.unknown()).optional(),
    })
    .strict()
    .parse(JSON.parse(raw));
  i.payload = pricingPayload(i.kind, i.payload);
  if (i.state === "confirmed") {
    if (!i.result) throw Error("Missing receipt");
    validateResult(i, i.result);
  }
  return i;
}
function validateResult(i: PricingIntent, v: unknown): Record<string, unknown> {
  const r = z.record(z.string(), z.unknown()).parse(v),
    p = i.payload;
  if (i.kind === "draftDelete") {
    if (r.deleted !== true || r.id !== p.planId)
      throw Error("Deletion not confirmed");
    return { deleted: true, id: r.id };
  }
  const rId = id.parse(r.id ?? r.versionId);
  if (i.kind === "tariffPropose") hash.parse(r.contentSha256);
  if (i.kind === "policyPropose") {
    hash.parse(r.contentHash);
    z.number().int().positive().parse(r.revision);
  }
  if (i.kind === "draftUpdate" && rId !== p.planId)
    throw Error("Draft receipt mismatch");
  if (
    i.kind === "tariffPropose" &&
    (r.planId !== p.planId || r.sourceGeneration !== p.expectedGeneration)
  )
    throw Error("Version receipt mismatch");
  if (
    i.kind === "tariffDecide" &&
    (rId !== p.versionId ||
      r.planId !== p.planId ||
      r.decision !== p.decision ||
      r.contentSha256 !== p.contentSha256)
  )
    throw Error("Decision receipt mismatch");
  if (
    i.kind === "policyDecide" &&
    (rId !== p.versionId || r.decision !== p.decision)
  )
    throw Error("Decision receipt mismatch");
  if (i.kind === "payer" && r.payerCustomerEntityId !== p.payerCustomerEntityId)
    throw Error("Payer receipt mismatch");
  if (
    i.kind === "instruction" &&
    (r.orderId !== p.orderId ||
      r.method !== p.method ||
      r.collectionParty !== p.collectionParty)
  )
    throw Error("Instruction receipt mismatch");
  if (i.kind === "price" || i.kind === "priceApprove") {
    if (
      r.orderId !== p.orderId ||
      (i.kind === "priceApprove" &&
        (r.id !== p.snapshotId || r.contentHash !== p.contentHash))
    )
      throw Error("Price receipt mismatch");
    return z
      .object({
        id,
        orderId: id,
        contentHash: hash,
        total: z.string().regex(/^\d+\.\d{4}$/),
        currency: z.string().length(3),
        state: z.enum(["accepted", "approval_required"]),
        content: z.record(z.string(), z.unknown()),
        acceptedAt: z.string().nullable(),
      })
      .strip()
      .parse(r);
  }
  return Object.fromEntries(
    Object.entries(r).filter(([k]) =>
      [
        "id",
        "versionId",
        "planId",
        "sourceGeneration",
        "contentSha256",
        "contentHash",
        "revision",
        "decision",
        "previousVersionId",
        "proposedAt",
        "decidedAt",
        "payerCustomerEntityId",
        "orderId",
        "method",
        "collectionParty",
      ].includes(k),
    ),
  );
}
type IO = {
  current: () => boolean;
  read: () => string | null;
  write: (v: string) => void;
  uuid: () => string;
  lock: <T>(f: () => Promise<T>) => Promise<T>;
  send: (i: PricingIntent) => Promise<unknown>;
};
export async function submitPricingIntent(
  kind: PricingKind,
  context: string,
  input: unknown | null,
  io: IO,
) {
  const guard = () => {
    if (!context || !io.current()) throw Error("Context changed");
  };
  guard();
  return io.lock(async () => {
    guard();
    let i = readPricingIntent(io.read());
    const p = input === null ? null : pricingPayload(kind, input);
    if (
      i &&
      (i.context !== context ||
        i.kind !== kind ||
        (p && canonicalIntent(p) !== canonicalIntent(i.payload)))
    )
      throw Error("Conflicting intent: retain original content");
    if (i && kind.startsWith("draft"))
      throw Error(
        "Draft writes have no durable receipt. Do not replay; inspect authoritative state.",
      );
    if (!i) {
      if (!p) throw Error("No original intent");
      i = {
        version: 1,
        context,
        kind,
        operationId: id.parse(io.uuid()),
        payload: p,
        state: "uncertain",
      };
    }
    const intent = i;
    const persist = () => {
      guard();
      const raw = JSON.stringify(intent);
      if (raw.length > 300000) throw Error("Intent too large");
      io.write(raw);
      if (io.read() !== raw)
        throw Error("Persistence failure: sending blocked");
    };
    intent.state = "uncertain";
    persist();
    const result = validateResult(
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
function storageKey(context: string, kind: PricingKind) {
  return (
    "cp_pricing_v1:" +
    encodeURIComponent(String(api.defaults.baseURL ?? window.location.origin)) +
    ":" +
    encodeURIComponent(context) +
    ":" +
    kind
  );
}
async function locked<T>(key: string, f: () => Promise<T>) {
  if (!navigator.locks) throw Error("Browser locking required");
  return navigator.locks.request(key, { ifAvailable: true }, async (l) => {
    if (!l) throw Error("Another tab is submitting");
    return f();
  });
}
export function pendingPricing(context: string, kind: PricingKind) {
  const i = readPricingIntent(localStorage.getItem(storageKey(context, kind)));
  if (i && i.context !== context) throw Error("Context mismatch");
  return i;
}
export async function finishPricing(context: string, kind: PricingKind) {
  const epoch = authEpoch();
  return locked(storageKey(context, kind), async () => {
    if (context !== authContext() || epoch !== authEpoch())
      throw Error("Context changed");
    if (pendingPricing(context, kind)?.state !== "confirmed")
      throw Error("Unconfirmed intent must remain");
    localStorage.removeItem(storageKey(context, kind));
    if (localStorage.getItem(storageKey(context, kind)) !== null)
      throw Error("Storage failure");
  });
}
export function pricingRequest(i: PricingIntent) {
  const p = pricingPayload(i.kind, i.payload),
    { planId, orderId, versionId, ...rest } = p,
    root = "/api/pricing";
  if (i.kind.startsWith("draft"))
    return {
      method:
        i.kind === "draftDelete"
          ? "DELETE"
          : i.kind === "draftUpdate"
            ? "PUT"
            : "POST",
      url: root + "/tariff-plans" + (planId ? "/" + planId : ""),
      data: p.draft,
    };
  if (i.kind.startsWith("tariff"))
    return {
      method: "POST",
      url:
        root +
        "/tariff-plans/" +
        planId +
        "/versions" +
        (i.kind === "tariffDecide" ? "/" + versionId + "/decision" : ""),
      data: { ...rest, operationId: i.operationId },
    };
  if (i.kind.startsWith("policy"))
    return {
      method: "POST",
      url:
        root +
        "/billing-policies" +
        (i.kind === "policyDecide" ? "/decision" : ""),
      data: {
        ...rest,
        ...(versionId ? { versionId } : {}),
        operationId: i.operationId,
      },
    };
  return {
    method: "POST",
    url:
      root +
      "/orders/" +
      orderId +
      "/" +
      (
        {
          payer: "bill-to",
          instruction: "service-payment-instruction",
          price: "price-acceptance",
          priceApprove: "price-approval",
        } as Record<string, string>
      )[i.kind],
    data: { ...rest, operationId: i.operationId },
  };
}
export async function mutatePricing(
  context: string,
  kind: PricingKind,
  input: unknown | null,
) {
  const epoch = authEpoch();
  return submitPricingIntent(kind, context, input, {
    current: () => context === authContext() && epoch === authEpoch(),
    read: () => localStorage.getItem(storageKey(context, kind)),
    write: (v) => localStorage.setItem(storageKey(context, kind), v),
    uuid: () => crypto.randomUUID(),
    lock: (f) => locked(storageKey(context, kind), f),
    send: async (i) =>
      (
        await api.request({
          ...pricingRequest(i),
          timeout: 15000,
          noReplay: true,
        } as Parameters<typeof api.request>[0])
      ).data,
  });
}
export async function readPricing<T>(
  context: string,
  path: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const epoch = authEpoch();
  if (!context || context !== authContext()) throw Error("Context changed");
  const r = await api.get("/api/pricing" + path, {
    params,
    timeout: 15000,
    noReplay: true,
  } as Parameters<typeof api.get>[1]);
  if (context !== authContext() || epoch !== authEpoch())
    throw Error("Context changed");
  return r.data as T;
}
export function pricingError(e: unknown) {
  const v = e as {
    message?: string;
    response?: { status?: number; data?: { code?: string; error?: string } };
  };
  if (!v.response)
    return v.message ?? "No confirmation; preserve the original intent.";
  return (
    v.response.data?.code ??
    v.response.data?.error ??
    "Request rejected or unconfirmed. Preserve the original request; refresh current state."
  );
}
