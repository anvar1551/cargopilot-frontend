import { z } from "zod";
import { api } from "./api";
import { authContext, authEpoch } from "./auth";
import { canonicalIntent } from "./creation-intent";
const uuid = z.string().uuid();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const reason = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .regex(/^[^\u0000-\u001f\u007f]+$/);
// The server's extensible supported-currency registry is authoritative. No FX.
export const configuration = z
  .object({
    baseCurrency: z.string().regex(/^[A-Z]{3}$/),
    fiscalYearStartMonth: z.number().int().min(1).max(12),
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .refine((v) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: v });
          return !/^[+-]/.test(v);
        } catch {
          return false;
        }
      }, "Enter a supported IANA timezone"),
    reportingCurrency: z.null(),
  })
  .strict();
const proposal = z.object({ configuration, reason }).strict();
const decision = z
  .object({
    proposalId: uuid,
    contentHash: hash,
    decision: z.enum(["approved", "rejected"]),
    reason,
    expected: configuration,
  })
  .strict();
export type SetupKind = "propose" | "decide";
export function setupPayload(
  kind: SetupKind,
  input: unknown,
): Record<string, unknown> {
  return (kind === "propose" ? proposal : decision).parse(input);
}
const decisionResult = z
  .object({
    proposalId: uuid,
    decision: z.enum(["approved", "rejected"]),
    legalEntityId: uuid.nullable(),
    configuration,
    contentHash: hash,
  })
  .strip();
function result(kind: SetupKind, value: unknown): Record<string, unknown> {
  return kind === "propose"
    ? z.object({ proposalId: uuid, contentHash: hash }).strip().parse(value)
    : decisionResult.parse(value);
}
export type SetupIntent = {
  version: 1;
  context: string;
  kind: SetupKind;
  operationId: string;
  payload: Record<string, unknown>;
  state: "uncertain" | "rejected" | "confirmed";
  code?: string;
  result?: Record<string, unknown>;
};
function validateReceipt(i: SetupIntent, r: Record<string, unknown>) {
  if (i.kind === "propose") {
    if (r.proposalId !== i.operationId)
      throw Error("Proposal receipt mismatch");
  } else if (
    r.proposalId !== i.payload.proposalId ||
    r.contentHash !== i.payload.contentHash ||
    r.decision !== i.payload.decision ||
    canonicalIntent(r.configuration) !== canonicalIntent(i.payload.expected) ||
    (r.decision === "approved" ? !r.legalEntityId : r.legalEntityId !== null)
  )
    throw Error("Decision receipt mismatch");
}
export function readSetupIntent(raw: string | null): SetupIntent | null {
  if (!raw) return null;
  if (raw.length > 20000) throw Error("Unreadable intent");
  const i = z
    .object({
      version: z.literal(1),
      context: z.string().min(1).max(1000),
      kind: z.enum(["propose", "decide"]),
      operationId: uuid,
      payload: z.record(z.string(), z.unknown()),
      state: z.enum(["uncertain", "rejected", "confirmed"]),
      code: z.string().max(120).optional(),
      result: z.record(z.string(), z.unknown()).optional(),
    })
    .strict()
    .parse(JSON.parse(raw));
  i.payload = setupPayload(i.kind, i.payload);
  if (i.result) i.result = result(i.kind, i.result);
  if (i.state === "confirmed") {
    if (!i.result) throw Error("Missing receipt");
    validateReceipt(i, i.result);
  }
  return i;
}
type IntentIO = {
  current: () => boolean;
  read: () => string | null;
  write: (v: string) => void;
  uuid: () => string;
  lock: <T>(f: () => Promise<T>) => Promise<T>;
  send: (i: SetupIntent) => Promise<unknown>;
};
export async function submitSetupIntent(
  kind: SetupKind,
  context: string,
  input: unknown | null,
  io: IntentIO,
) {
  const guard = () => {
    if (!context || !io.current()) throw Error("Context changed");
  };
  guard();
  return io.lock(async () => {
    guard();
    const payload = input === null ? null : setupPayload(kind, input);
    let i = readSetupIntent(io.read());
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
      validateReceipt(intent, r);
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
          [400, 401, 403, 404, 409].includes(error.response?.status ?? 0) &&
          typeof code === "string" &&
          /^ENTITY_SETUP_[A-Z_]+$/.test(code)
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
function key(context: string, kind: SetupKind) {
  return (
    "cp_entity_setup_v1:" +
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
export function pendingSetup(context: string, kind: SetupKind) {
  const i = readSetupIntent(localStorage.getItem(key(context, kind)));
  if (i && (i.context !== context || i.kind !== kind))
    throw Error("Stored context mismatch");
  return i;
}
export async function finishSetup(context: string, kind: SetupKind) {
  const epoch = authEpoch();
  return lock(key(context, kind), async () => {
    if (context !== authContext() || epoch !== authEpoch())
      throw Error("Context changed");
    if (pendingSetup(context, kind)?.state !== "confirmed")
      throw Error("Unconfirmed intent must remain");
    localStorage.removeItem(key(context, kind));
    if (localStorage.getItem(key(context, kind)) !== null)
      throw Error("Storage failure");
  });
}
export async function mutateSetup(
  context: string,
  kind: SetupKind,
  input: unknown | null,
) {
  const epoch = authEpoch();
  return submitSetupIntent(kind, context, input, {
    current: () => context === authContext() && epoch === authEpoch(),
    read: () => localStorage.getItem(key(context, kind)),
    write: (v) => localStorage.setItem(key(context, kind), v),
    uuid: () => crypto.randomUUID(),
    lock: (f) => lock(key(context, kind), f),
    send: async (i) => {
      const v = setupPayload(kind, i.payload);
      const body =
        kind === "decide"
          ? {
              proposalId: v.proposalId,
              contentHash: v.contentHash,
              decision: v.decision,
              reason: v.reason,
            }
          : v;
      return (
        await api.post(
          "/api/auth/issuing-entity-setup/" +
            (kind === "propose" ? "proposals" : "decisions"),
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
    baseCurrency: z.string().length(3),
    fiscalYearStartMonth: z.number().int().min(1).max(12),
    timezone: z.string().max(100),
    reportingCurrency: z.string().nullable(),
    isActive: z.boolean(),
  })
  .strip();
const authority = z
  .object({
    revision: z.literal("issuing-entity-setup.v1"),
    kind: z.enum(["proposer", "checker"]),
    companyName: z.string().max(300),
    supportedCurrencies: z
      .array(z.string().regex(/^[A-Z]{3}$/))
      .min(1)
      .max(100),
    reportingCurrency: z.null(),
    entity: entity.nullable(),
  })
  .strip();
const proposed = z
  .object({
    proposalId: uuid,
    configuration,
    contentHash: hash,
    reason: z.string().max(1000),
    createdAt: z.string().datetime(),
    proposer: z.object({ userId: uuid, name: z.string().max(300) }).strip(),
    independent: z.boolean(),
    decision: z
      .object({
        action: z.enum(["approved", "rejected"]),
        reason: z.string().max(1000),
        createdAt: z.string().datetime(),
        legalEntityId: uuid.nullable(),
      })
      .strip()
      .nullable(),
  })
  .strip();
const page = z
  .object({
    items: z.array(proposed).max(50),
    nextCursor: z.string().max(768).nullable(),
  })
  .strip();
export type SetupProposal = z.infer<typeof proposed>;
const schemas = { authority, proposals: page };
export async function readSetup<K extends keyof typeof schemas>(
  context: string,
  view: K,
  kind: "proposer" | "checker",
  cursor?: string,
) {
  const epoch = authEpoch();
  if (!context || context !== authContext()) throw Error("Context changed");
  const r = await api.get("/api/auth/issuing-entity-setup", {
    params: { view, kind, limit: 20, ...(cursor ? { cursor } : {}) },
    timeout: 15000,
    noReplay: true,
  } as Parameters<typeof api.get>[1]);
  if (context !== authContext() || epoch !== authEpoch())
    throw Error("Context changed");
  return schemas[view].parse(r.data) as z.infer<(typeof schemas)[K]>;
}
export function setupError(e: unknown) {
  const code = (e as { response?: { data?: { code?: string } } }).response?.data
    ?.code;
  const messages: Record<string, string> = {
    ENTITY_SETUP_AUTHORITY_REQUIRED:
      "Current owner-appointed setup authority is required. Administrator or financial delegation status is insufficient.",
    ENTITY_SETUP_ALREADY_CONFIGURED:
      "An entity already exists. This insert-only setup cannot edit or replace it.",
    ENTITY_SETUP_INDEPENDENT_CHECKER_REQUIRED:
      "Approval requires a different human from the proposer.",
    ENTITY_SETUP_STALE_PROPOSAL:
      "The proposer's accepted authority changed. The original proposal cannot be substituted.",
    ENTITY_SETUP_INTENT_CONFLICT:
      "Operation ID conflicts with different content. Preserve the original intent.",
    ENTITY_SETUP_CONTENT_CONFLICT:
      "The immutable configuration identity does not match.",
    ENTITY_SETUP_ALREADY_DECIDED:
      "The proposal already has a decision. Refresh its authoritative state; preserve your intent.",
    ENTITY_SETUP_PUBLICATION_UNAVAILABLE:
      "The existing publication cannot be safely accessed.",
  };
  return code
    ? (messages[code] ??
        "Current context or setup authority rejected the request; no success is confirmed.")
    : "No confirmation received. Preserve the original operation ID, content and context. Retry explicitly only.";
}
