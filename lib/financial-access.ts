import { z } from "zod";
import { api } from "./api";
import { authContext, authEpoch } from "./auth";
import { canonicalIntent } from "./creation-intent";
const uuid = z.string().uuid();
export const FINANCIAL_PROFILES = [
  "pricing-maker.v1",
  "pricing-checker.v1",
  "billing-operator.v1",
  "price-exception-checker.v1",
  "manual-invoice-issuer.v1",
  "entity-configuration-reader.v1",
] as const;
const profiles = z
  .array(z.enum(FINANCIAL_PROFILES))
  .min(1)
  .max(6)
  .refine((v) => new Set(v).size === v.length)
  .transform((v) => [...v].sort());
const reason = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .regex(/^[^\u0000-\u001f\u007f]+$/);
const fingerprint = z.string().regex(/^[a-f0-9]{64}$/);
const proposal = z
  .object({
    membershipId: uuid,
    legalEntityId: uuid,
    profileRevisions: profiles,
    expectedAcceptanceId: uuid.nullable(),
    reason,
  })
  .strict();
const acceptance = z
  .object({
    proposalId: uuid,
    fingerprint,
    reason,
    expected: z
      .object({
        membershipId: uuid,
        legalEntityId: uuid,
        profileRevisions: profiles,
      })
      .strict(),
  })
  .strict();
const revocation = z
  .object({
    membershipId: uuid,
    legalEntityId: uuid,
    expectedAcceptanceId: uuid,
    reason,
  })
  .strict();
export type FinancialKind = "propose" | "accept" | "revoke";
export function financialPayload(kind: FinancialKind, v: unknown) {
  return { propose: proposal, accept: acceptance, revoke: revocation }[
    kind
  ].parse(v);
}
function result(kind: FinancialKind, v: unknown): Record<string, unknown> {
  if (kind === "propose")
    return z.object({ proposalId: uuid, fingerprint }).strip().parse(v);
  if (kind === "revoke")
    return z
      .object({ companyMembershipId: uuid, revokedAcceptanceId: uuid })
      .strip()
      .parse(v);
  return z
    .object({
      companyMembershipId: uuid,
      legalEntityId: uuid,
      profileRevisions: profiles,
      roleIds: z.array(uuid).min(1).max(6),
      acceptanceId: uuid,
    })
    .strip()
    .parse(v);
}
export type FinancialIntent = {
  version: 1;
  context: string;
  kind: FinancialKind;
  operationId: string;
  payload: Record<string, unknown>;
  state: "uncertain" | "rejected" | "confirmed";
  code?: string;
  result?: Record<string, unknown>;
};
export function readFinancialIntent(
  raw: string | null,
): FinancialIntent | null {
  if (!raw) return null;
  if (raw.length > 20000) throw Error("Unreadable intent");
  const i = z
    .object({
      version: z.literal(1),
      context: z.string().min(1).max(4096),
      kind: z.enum(["propose", "accept", "revoke"]),
      operationId: uuid,
      payload: z.record(z.string(), z.unknown()),
      state: z.enum(["uncertain", "rejected", "confirmed"]),
      code: z
        .string()
        .regex(/^FINANCIAL_[A-Z_]+$/)
        .optional(),
      result: z.record(z.string(), z.unknown()).optional(),
    })
    .strict()
    .parse(JSON.parse(raw));
  i.payload = financialPayload(i.kind, i.payload);
  if (i.result) i.result = result(i.kind, i.result);
  if (i.state === "confirmed" && !i.result) throw Error("Missing receipt");
  return i;
}
export type FinancialIO = {
  current(): boolean;
  read(): string | null;
  write(v: string): void;
  uuid(): string;
  lock<T>(f: () => Promise<T>): Promise<T>;
  send(i: FinancialIntent): Promise<unknown>;
};
export async function submitFinancialIntent(
  kind: FinancialKind,
  context: string,
  input: unknown | null,
  io: FinancialIO,
) {
  const guard = () => {
    if (!context || !io.current()) throw Error("Context changed");
  };
  guard();
  const payload = input === null ? null : financialPayload(kind, input);
  return io.lock(async () => {
    guard();
    let i = readFinancialIntent(io.read());
    if (i && (i.context !== context || i.kind !== kind))
      throw Error("Stored context mismatch");
    if (i && payload && canonicalIntent(i.payload) !== canonicalIntent(payload))
      throw Error("Conflicting intent; retain original");
    if (!i) {
      if (!payload) throw Error("No original intent");
      i = {
        version: 1,
        context,
        kind,
        operationId: uuid.parse(io.uuid()),
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
        throw Error("Persistence failure; sending blocked");
    };
    intent.state = "uncertain";
    delete intent.code;
    persist();
    try {
      const r = result(kind, await io.send(JSON.parse(JSON.stringify(intent))));
      guard();
      if (kind === "propose" && r.proposalId !== intent.operationId)
        throw Error("Proposal receipt mismatch");
      if (
        kind === "revoke" &&
        (r.companyMembershipId !== intent.payload.membershipId ||
          r.revokedAcceptanceId !== intent.payload.expectedAcceptanceId)
      )
        throw Error("Revocation receipt mismatch");
      if (kind === "accept") {
        const expected = intent.payload.expected as {
          membershipId: string;
          legalEntityId: string;
          profileRevisions: string[];
        };
        if (
          r.acceptanceId !== intent.operationId ||
          r.companyMembershipId !== expected.membershipId ||
          r.legalEntityId !== expected.legalEntityId ||
          canonicalIntent(r.profileRevisions) !==
            canonicalIntent(expected.profileRevisions)
        )
          throw Error("Acceptance receipt mismatch");
      }
      intent.result = r;
      intent.state = "confirmed";
      persist();
      return intent;
    } catch (e) {
      if (io.current() && intent.state !== "confirmed") {
        const error = e as {
          response?: { status?: number; data?: { code?: string } };
        };
        const code = error.response?.data?.code;
        if (
          [400, 401, 403, 409].includes(error.response?.status ?? 0) &&
          typeof code === "string" &&
          /^FINANCIAL_[A-Z_]+$/.test(code)
        ) {
          intent.state = "rejected";
          intent.code = code;
        }
        persist();
      }
      throw e;
    }
  });
}
function key(context: string, kind: FinancialKind) {
  return (
    "cp_financial_access_v1:" +
    encodeURIComponent(String(api.defaults.baseURL ?? window.location.origin)) +
    ":" +
    encodeURIComponent(context) +
    ":" +
    kind
  );
}
async function lock<T>(name: string, f: () => Promise<T>) {
  if (!navigator.locks) throw Error("Browser locking required");
  return navigator.locks.request(name, { ifAvailable: true }, async (l) => {
    if (!l) throw Error("Another tab is submitting");
    return f();
  });
}
export function pendingFinancial(context: string, kind: FinancialKind) {
  const i = readFinancialIntent(localStorage.getItem(key(context, kind)));
  if (i && (i.context !== context || i.kind !== kind))
    throw Error("Stored context mismatch");
  return i;
}
export async function finishFinancial(context: string, kind: FinancialKind) {
  const epoch = authEpoch();
  await lock(key(context, kind), async () => {
    if (context !== authContext() || epoch !== authEpoch())
      throw Error("Context changed");
    if (pendingFinancial(context, kind)?.state !== "confirmed")
      throw Error("Unconfirmed intent must remain");
    localStorage.removeItem(key(context, kind));
    if (localStorage.getItem(key(context, kind)) !== null)
      throw Error("Storage failure");
  });
}
export async function mutateFinancial(
  context: string,
  kind: FinancialKind,
  input: unknown | null,
) {
  const epoch = authEpoch();
  return submitFinancialIntent(kind, context, input, {
    current: () => context === authContext() && epoch === authEpoch(),
    read: () => localStorage.getItem(key(context, kind)),
    write: (v) => localStorage.setItem(key(context, kind), v),
    uuid: () => crypto.randomUUID(),
    lock: (f) => lock(key(context, kind), f),
    send: async (i) => {
      const v = financialPayload(kind, i.payload);
      const body =
        kind === "accept"
          ? {
              proposalId: (v as z.infer<typeof acceptance>).proposalId,
              fingerprint: (v as z.infer<typeof acceptance>).fingerprint,
              reason: v.reason,
            }
          : v;
      return (
        await api.post(
          "/api/auth/company-financial-grants/" +
            { propose: "proposals", accept: "accept", revoke: "revoke" }[kind],
          { ...body, operationId: i.operationId },
          { timeout: 15000, noReplay: true } as Parameters<typeof api.post>[2],
        )
      ).data;
    },
  });
}
const recipient = z
  .object({
    membershipId: uuid,
    name: z.string().max(160),
    expectedAcceptanceId: uuid.nullable(),
    currentProfiles: z.array(z.enum(FINANCIAL_PROFILES)).max(6),
    currentEnabled: z.boolean(),
  })
  .strip();
const grant = z
  .object({
    membershipId: uuid,
    name: z.string().max(160),
    legalEntityId: uuid,
    profileRevisions: profiles,
    enabled: z.boolean(),
    acceptanceId: uuid,
    managed: z.literal(true),
  })
  .strip();
const proposed = z
  .object({
    proposalId: uuid,
    membershipId: uuid,
    recipientName: z.string().max(160),
    legalEntityId: uuid,
    profileRevisions: profiles,
    expectedAcceptanceId: uuid.nullable(),
    expectedEnabled: z.boolean(),
    fingerprint,
    reason,
    createdAt: z.string().datetime(),
    acceptanceId: uuid.nullable(),
    state: z.enum(["pending", "accepted"]),
    independent: z.boolean(),
    stale: z.boolean(),
  })
  .strip();
export type FinancialRecipient = z.infer<typeof recipient>;
export type FinancialGrant = z.infer<typeof grant>;
export type FinancialProposal = z.infer<typeof proposed>;
const ceiling = z
  .object({
    revision: z.literal("financial-delegation.v1"),
    authorities: z
      .array(
        z
          .object({
            kind: z.enum(["proposer", "checker"]),
            legalEntity: z
              .object({
                id: uuid,
                name: z.string().max(160),
                baseCurrency: z.string().min(3).max(3),
              })
              .strip(),
            profiles: z
              .array(
                z
                  .object({
                    revision: z.enum(FINANCIAL_PROFILES),
                    permissions: z.array(z.string().max(120)).max(12),
                  })
                  .strip(),
              )
              .min(1)
              .max(6),
          })
          .strip(),
      )
      .min(1)
      .max(2),
  })
  .strip();
const page = <T extends z.ZodTypeAny>(s: T) =>
  z
    .object({
      items: z.array(s).max(50),
      nextCursor: z.string().max(768).nullable(),
    })
    .strip();
const schemas = {
  ceiling,
  recipients: page(recipient),
  proposals: page(proposed),
  grants: page(grant),
};
export async function readFinancialDiscovery<K extends keyof typeof schemas>(
  context: string,
  view: K,
  kind?: "proposer" | "checker",
  cursor?: string,
) {
  const epoch = authEpoch();
  if (!context || context !== authContext()) throw Error("Context changed");
  const r = await api.get("/api/auth/company-financial-access", {
    params: {
      view,
      ...(kind ? { kind } : {}),
      limit: 20,
      ...(cursor ? { cursor } : {}),
    },
    timeout: 15000,
    noReplay: true,
  } as Parameters<typeof api.get>[1]);
  if (context !== authContext() || epoch !== authEpoch())
    throw Error("Context changed");
  return schemas[view].parse(r.data) as z.infer<(typeof schemas)[K]>;
}
export function financialError(e: unknown) {
  const code = (e as { response?: { data?: { code?: string } } }).response?.data
    ?.code;
  const messages: Record<string, string> = {
    FINANCIAL_CEILING_REQUIRED:
      "Current owner-appointed financial authority and an active owned issuing entity are required. Operational/driver authority is insufficient.",
    FINANCIAL_ENTITY_UNAVAILABLE:
      "Issuing entity is unavailable. Controlled entity setup must be completed separately.",
    FINANCIAL_INDEPENDENT_CHECKER_REQUIRED:
      "The checker must be a different human from proposer and recipient.",
    FINANCIAL_GRANT_STALE:
      "Managed access changed. Preserve the original intent for review; do not substitute a newer acceptance.",
    FINANCIAL_INTENT_CONFLICT:
      "Operation identity conflicts with different content. Retain the original intent.",
    FINANCIAL_REMOVAL_CEILING:
      "Removed or replacement access exceeds your accepted ceiling.",
    FINANCIAL_UNMANAGED_GRANT:
      "Unrelated financial grants cannot be adopted or replaced by this workflow.",
    FINANCIAL_RECEIPT_NOT_CURRENT:
      "The accepted result is no longer current; fresh authority is required.",
  };
  return code
    ? (messages[code] ??
        "Current authority or immutable grant contract rejected the action. No success is confirmed.")
    : "No confirmation received. Keep the original intent and context; do not silently replace it.";
}
