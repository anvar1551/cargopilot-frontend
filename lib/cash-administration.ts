import { z } from "zod";
import { api } from "./api";
import { authContext, authEpoch } from "./auth";
import { canonicalIntent } from "./creation-intent";
const uuid = z.string().uuid(),
  fingerprint = z.string().regex(/^[a-f0-9]{64}$/);
export const CASH_PROFILES = [
  "local-driver-cash.v1",
  "warehouse-cash.v1",
  "cash-settlement-checker.v1",
] as const;
const profile = z.enum(CASH_PROFILES),
  profiles = z.array(profile).length(1);
const warehouseIds = z
  .array(uuid)
  .min(1)
  .max(20)
  .transform((v) => [...new Set(v)].sort());
const kinds = z
  .array(z.enum(["service_charge", "cod"]))
  .min(1)
  .max(2)
  .refine((v) => new Set(v).size === v.length)
  .transform((v) => [...v].sort());
const reason = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .regex(/^[^\u0000-\u001f\u007f]+$/);
const basis = {
  membershipId: uuid,
  legalEntityId: uuid,
  profileRevisions: profiles,
  warehouseIds,
  kinds,
};
const proposal = z
  .object({ ...basis, expectedAcceptanceId: uuid.nullable(), reason })
  .strict();
const acceptance = z
  .object({
    proposalId: uuid,
    fingerprint,
    reason,
    expected: z.object(basis).strict(),
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
export type CashAdminKind = "propose" | "accept" | "revoke";
export function cashAdminPayload(
  kind: CashAdminKind,
  input: unknown,
): Record<string, unknown> {
  return { propose: proposal, accept: acceptance, revoke: revocation }[
    kind
  ].parse(input);
}
function result(kind: CashAdminKind, input: unknown): Record<string, unknown> {
  if (kind === "propose")
    return z.object({ proposalId: uuid, fingerprint }).strip().parse(input);
  if (kind === "revoke")
    return z
      .object({ companyMembershipId: uuid, revokedAcceptanceId: uuid })
      .strip()
      .parse(input);
  return z
    .object({
      companyMembershipId: uuid,
      legalEntityId: uuid,
      profileRevisions: profiles,
      warehouseIds,
      kinds,
      acceptanceId: uuid,
    })
    .strip()
    .parse(input);
}
export type CashAdminIntent = {
  version: 1;
  context: string;
  kind: CashAdminKind;
  operationId: string;
  payload: Record<string, unknown>;
  state: "uncertain" | "rejected" | "confirmed";
  code?: string;
  result?: Record<string, unknown>;
};
function verifyReceipt(i: CashAdminIntent, r: Record<string, unknown>) {
  if (i.kind === "propose") {
    if (r.proposalId !== i.operationId)
      throw Error("Proposal receipt mismatch");
  } else if (i.kind === "revoke") {
    if (
      r.companyMembershipId !== i.payload.membershipId ||
      r.revokedAcceptanceId !== i.payload.expectedAcceptanceId
    )
      throw Error("Revocation receipt mismatch");
  } else {
    const v = i.payload.expected as z.infer<typeof acceptance>["expected"];
    if (
      r.acceptanceId !== i.operationId ||
      r.companyMembershipId !== v.membershipId ||
      r.legalEntityId !== v.legalEntityId ||
      ["profileRevisions", "warehouseIds", "kinds"].some(
        (k) =>
          canonicalIntent(r[k]) !== canonicalIntent(v[k as keyof typeof v]),
      )
    )
      throw Error("Acceptance receipt mismatch");
  }
}
export function readCashAdminIntent(
  raw: string | null,
): CashAdminIntent | null {
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
        .regex(/^CASH_CAPABILITY_[A-Z_]+$/)
        .optional(),
      result: z.record(z.string(), z.unknown()).optional(),
    })
    .strict()
    .parse(JSON.parse(raw));
  i.payload = cashAdminPayload(i.kind, i.payload);
  if (i.result) i.result = result(i.kind, i.result);
  if (i.state === "confirmed") {
    if (!i.result) throw Error("Missing receipt");
    verifyReceipt(i, i.result);
  }
  return i;
}
type IO = {
  current: () => boolean;
  read: () => string | null;
  write: (s: string) => void;
  uuid: () => string;
  lock: <T>(f: () => Promise<T>) => Promise<T>;
  send: (i: CashAdminIntent) => Promise<unknown>;
};
export async function submitCashAdminIntent(
  kind: CashAdminKind,
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
    const payload = input === null ? null : cashAdminPayload(kind, input);
    let i = readCashAdminIntent(io.read());
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
      verifyReceipt(intent, r);
      intent.result = r;
      intent.state = "confirmed";
      persist();
      return intent;
    } catch (e) {
      if (io.current() && intent.state !== "confirmed") {
        const error = e as {
            response?: { status?: number; data?: { code?: string } };
          },
          code = error.response?.data?.code;
        if (
          [400, 401, 403, 409].includes(error.response?.status ?? 0) &&
          typeof code === "string" &&
          /^CASH_CAPABILITY_[A-Z_]+$/.test(code)
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
function key(context: string, kind: CashAdminKind) {
  return (
    "cp_cash_admin_v1:" +
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
export function pendingCashAdmin(context: string, kind: CashAdminKind) {
  const i = readCashAdminIntent(localStorage.getItem(key(context, kind)));
  if (i && (i.context !== context || i.kind !== kind))
    throw Error("Stored context mismatch");
  return i;
}
export async function finishCashAdmin(context: string, kind: CashAdminKind) {
  const epoch = authEpoch();
  return lock(key(context, kind), async () => {
    if (context !== authContext() || epoch !== authEpoch())
      throw Error("Context changed");
    if (pendingCashAdmin(context, kind)?.state !== "confirmed")
      throw Error("Unconfirmed intent must remain");
    localStorage.removeItem(key(context, kind));
    if (localStorage.getItem(key(context, kind)) !== null)
      throw Error("Storage failure");
  });
}
export async function mutateCashAdmin(
  context: string,
  kind: CashAdminKind,
  input: unknown | null,
) {
  const epoch = authEpoch();
  return submitCashAdminIntent(kind, context, input, {
    current: () => context === authContext() && epoch === authEpoch(),
    read: () => localStorage.getItem(key(context, kind)),
    write: (v) => localStorage.setItem(key(context, kind), v),
    uuid: () => crypto.randomUUID(),
    lock: (f) => lock(key(context, kind), f),
    send: async (i) => {
      const v = cashAdminPayload(kind, i.payload),
        body =
          kind === "accept"
            ? {
                proposalId: v.proposalId,
                fingerprint: v.fingerprint,
                reason: v.reason,
              }
            : v;
      return (
        await api.post(
          "/api/auth/company-cash-capabilities/" +
            { propose: "proposals", accept: "accept", revoke: "revoke" }[kind],
          { ...body, operationId: i.operationId },
          { timeout: 15000, noReplay: true } as Parameters<typeof api.post>[2],
        )
      ).data;
    },
  });
}
const entity = z
  .object({
    id: uuid,
    name: z.string().max(300),
    baseCurrency: z.string().length(3),
  })
  .strip();
const warehouse = z.object({ id: uuid, name: z.string().max(300) }).strip();
const ceiling = z
  .object({
    revision: z.literal("cash-delegation.v1"),
    kind: z.enum(["proposer", "checker"]),
    legalEntity: entity,
    profiles: z
      .array(
        z
          .object({
            revision: profile,
            permissions: z.array(z.string().max(120)).max(3),
          })
          .strip(),
      )
      .min(1)
      .max(3),
    kinds,
    warehouses: z.array(warehouse).min(1).max(20),
  })
  .strip();
const recipient = z
  .object({
    membershipId: uuid,
    name: z.string().max(300),
    profiles: z
      .array(z.object({ revision: profile, warehouseIds }).strip())
      .min(1)
      .max(3),
    expectedAcceptanceId: uuid.nullable(),
    currentEnabled: z.boolean(),
  })
  .strip();
const grant = z
  .object({
    ...basis,
    name: z.string().max(300),
    acceptanceId: uuid,
    enabled: z.boolean(),
    managed: z.literal(true),
  })
  .strip();
const proposed = z
  .object({
    ...basis,
    proposalId: uuid,
    recipientName: z.string().max(300),
    proposerName: z.string().max(300),
    expectedAcceptanceId: uuid.nullable(),
    expectedEnabled: z.boolean(),
    fingerprint,
    reason: z.string().max(500),
    createdAt: z.string().datetime(),
    acceptanceId: uuid.nullable(),
    state: z.enum(["pending", "accepted"]),
    independent: z.boolean(),
    stale: z.boolean(),
  })
  .strip();
export type CashAdminRecipient = z.infer<typeof recipient>;
export type CashAdminGrant = z.infer<typeof grant>;
export type CashAdminProposal = z.infer<typeof proposed>;
export type CashAdminCeiling = z.infer<typeof ceiling>;
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
export async function readCashAdministration<K extends keyof typeof schemas>(
  context: string,
  view: K,
  kind: "proposer" | "checker",
  cursor?: string,
) {
  const epoch = authEpoch();
  if (!context || context !== authContext()) throw Error("Context changed");
  const r = await api.get("/api/auth/company-cash-capabilities", {
    params: { view, kind, limit: 20, ...(cursor ? { cursor } : {}) },
    timeout: 15000,
    noReplay: true,
  } as Parameters<typeof api.get>[1]);
  if (context !== authContext() || epoch !== authEpoch())
    throw Error("Context changed");
  return schemas[view].parse(r.data) as z.infer<(typeof schemas)[K]>;
}
export function cashAdminError(e: unknown) {
  const code = (e as { response?: { data?: { code?: string } } }).response?.data
    ?.code;
  const messages: Record<string, string> = {
    CASH_CAPABILITY_CEILING_REQUIRED:
      "Current independently owner-appointed cash delegation is required. Other administrator or delegation status is insufficient.",
    CASH_CAPABILITY_ENTITY_UNAVAILABLE:
      "An active owned issuing entity is required; complete its approved setup separately.",
    CASH_CAPABILITY_RESOURCE_CEILING:
      "Requested warehouses or cash kinds exceed the accepted ceiling.",
    CASH_CAPABILITY_REMOVAL_CEILING:
      "Removed and replacement access must fit one current accepted ceiling.",
    CASH_CAPABILITY_TARGET_REJECTED:
      "Recipient must be an eligible other company membership in this context.",
    CASH_CAPABILITY_BASE_REQUIRED:
      "The recipient's existing base profile cannot receive this supplement.",
    CASH_CAPABILITY_WAREHOUSE_BASE_REQUIRED:
      "The recipient needs the exact warehouse base profile and requested warehouse scopes.",
    CASH_CAPABILITY_INDEPENDENT_CHECKER_REQUIRED:
      "Checker must differ by human identity from proposer and recipient.",
    CASH_CAPABILITY_INTENT_CONFLICT:
      "Operation ID conflicts with different content. Retain the original intent.",
    CASH_CAPABILITY_GRANT_STALE:
      "The previous acceptance changed. Preserve the original intent; do not substitute a refreshed grant.",
    CASH_CAPABILITY_PROPOSER_ACCEPTANCE_CHANGED:
      "The proposer's accepted authority changed; this proposal cannot be accepted.",
    CASH_CAPABILITY_RECEIPT_NOT_CURRENT:
      "The historical result is no longer current. No new capability is confirmed.",
    CASH_CAPABILITY_PROPOSAL_ALREADY_ACCEPTED:
      "This proposal already has an acceptance. Refresh its authoritative record.",
    CASH_CAPABILITY_GRANT_REVOKED: "Managed access is already revoked.",
  };
  return code
    ? (messages[code] ??
        "Current authority or exact cash capability contract rejected the action; no success is confirmed.")
    : "No confirmation received. Preserve original ID/content/context and retry explicitly only.";
}
