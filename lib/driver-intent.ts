import { z } from "zod";
import { canonicalIntent } from "./creation-intent";

const uuid = z
  .string()
  .uuid()
  .transform((v) => v.toLowerCase());
const reason = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .regex(/^[^\u0000-\u001f\u007f]+$/);
export const DRIVER_PROFILES = {
  "local-driver.v1": "Local pickup / last-mile driver",
  "linehaul-driver.v1": "Linehaul driver",
} as const;
const profile = z.enum(["local-driver.v1", "linehaul-driver.v1"]);
const profileFields = {
  profileRevision: profile,
  reason,
};
const invite = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    ...profileFields,
  })
  .strict();
const cancel = z.object({ invitationId: uuid, reason }).strict();
const grant = z
  .object({
    membershipId: uuid,
    action: z.enum(["grant", "revoke"]),
    ...profileFields,
  })
  .strict();
// Token digest binds re-entered secrets without persisting a reusable token.
const accept = z
  .object({
    tokenDigest: z.string().regex(/^[a-f0-9]{64}$/),
    mode: z.enum(["new", "existing"]),
    name: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .regex(/^[^\u0000-\u001f\u007f]+$/)
      .optional(),
  })
  .strict();
export type DriverKind = "invite" | "cancel" | "grant" | "accept";
export function driverPayload(kind: DriverKind, input: unknown) {
  const value = { invite, cancel, grant, accept }[kind].parse(input);
  if (
    kind === "accept" &&
    "mode" in value &&
    (value.mode === "new") !== Boolean(value.name)
  )
    throw Error("New identity requires a name; existing identity must omit it");
  return value;
}
export const acceptedResult = z
  .object({
    companyMembershipId: uuid,
    tenantId: uuid,
    companyId: uuid,
    tenantMembershipId: uuid,
    userId: uuid,
    profileRevision: profile,
  })
  .strict();
export const invitationResult = z
  .object({
    invitationId: uuid,
    expiresAt: z.string().datetime(),
    delivery: z.literal("token-returned-once"),
  })
  .strict();
export function driverResult(
  kind: DriverKind,
  value: unknown,
): Record<string, unknown> {
  if (kind === "invite") {
    // Deliberately strip the one-time secret before persistence.
    return invitationResult.parse(
      z
        .object({
          invitationId: uuid,
          expiresAt: z.string().datetime(),
          delivery: z.literal("token-returned-once"),
        })
        .strip()
        .parse(value),
    );
  }
  if (kind === "accept") return acceptedResult.parse(value);
  if (kind === "cancel")
    return z
      .object({ invitationId: uuid, state: z.literal("cancelled") })
      .strict()
      .parse(value);
  return z
    .object({
      companyMembershipId: uuid,
      action: z.enum(["grant", "revoke"]),
      profileRevision: profile,
    })
    .strict()
    .parse(value);
}
export type DriverIntent = {
  version: 1;
  kind: DriverKind;
  context: string;
  operationId: string;
  payload: Record<string, unknown>;
  state: "pending" | "uncertain" | "rejected" | "confirmed";
  code?: string;
  result?: Record<string, unknown>;
};
export function readDriverIntent(raw: string | null): DriverIntent | null {
  if (!raw) return null;
  if (raw.length > 20000) throw Error("Stored intent exceeds bound");
  const i = z
    .object({
      version: z.literal(1),
      kind: z.enum(["invite", "cancel", "grant", "accept"]),
      context: z.string().min(1).max(4096),
      operationId: uuid,
      payload: z.record(z.string(), z.unknown()),
      state: z.enum(["pending", "uncertain", "rejected", "confirmed"]),
      code: z
        .string()
        .regex(/^(DELEGATION_|INVITATION_)[A-Z_]+$/)
        .optional(),
      result: z.record(z.string(), z.unknown()).optional(),
    })
    .strict()
    .parse(JSON.parse(raw));
  i.payload = driverPayload(i.kind, i.payload);
  if (i.result) i.result = driverResult(i.kind, i.result);
  if (i.state === "confirmed" && !i.result) throw Error("Missing confirmation");
  return i;
}
export type DriverIO = {
  current(): boolean;
  read(): string | null;
  write(raw: string): void;
  uuid(): string;
  lock<T>(work: () => Promise<T>): Promise<T>;
  send(intent: DriverIntent): Promise<unknown>;
};
export async function submitDriverIntent(
  kind: DriverKind,
  context: string,
  input: unknown | null,
  d: DriverIO,
) {
  const guard = () => {
    if (!context || !d.current())
      throw Error("Session changed; operation suppressed");
  };
  guard();
  const payload = input === null ? null : driverPayload(kind, input);
  return d.lock(async () => {
    guard();
    let intent = readDriverIntent(d.read());
    if (intent && (intent.context !== context || intent.kind !== kind))
      throw Error("Stored context mismatch");
    if (
      intent &&
      payload &&
      canonicalIntent(intent.payload) !== canonicalIntent(payload)
    )
      throw Error("Conflicting intent; preserve original content");
    if (!intent) {
      if (!payload) throw Error("No original intent");
      intent = {
        version: 1,
        kind,
        context,
        operationId: uuid.parse(d.uuid()),
        payload,
        state: "pending",
      };
    }
    const i = intent;
    const persist = () => {
      guard();
      const raw = JSON.stringify(i);
      if (raw.length > 20000) throw Error("Intent exceeds bound");
      d.write(raw);
      if (d.read() !== raw)
        throw Error("Persistence verification failed; nothing may be sent");
    };
    i.state = "pending";
    delete i.code;
    persist();
    try {
      const result = driverResult(
        kind,
        await d.send(JSON.parse(JSON.stringify(i))),
      );
      if (kind === "cancel" && result.invitationId !== i.payload.invitationId)
        throw Error("Cancellation confirmation mismatch");
      if (
        kind === "grant" &&
        (result.companyMembershipId !== i.payload.membershipId ||
          result.action !== i.payload.action ||
          result.profileRevision !== i.payload.profileRevision)
      )
        throw Error("Managed grant confirmation mismatch");
      guard();
      i.result = result;
      i.state = "confirmed";
      persist();
      return i;
    } catch (error) {
      if (d.current() && i.state !== "confirmed") {
        const e = error as {
          response?: { status?: number; data?: { code?: unknown } };
        };
        const status = e.response?.status,
          code = e.response?.data?.code;
        // An explicit application rejection is different from a transport timeout.
        i.state =
          [400, 401, 403, 409].includes(status ?? 0) &&
          typeof code === "string" &&
          /^(DELEGATION_|INVITATION_)[A-Z_]+$/.test(code)
            ? "rejected"
            : "uncertain";
        if (i.state === "rejected") i.code = String(code);
        persist();
      }
      throw error;
    }
  });
}
export function driverError(error: unknown) {
  const code = (error as { response?: { data?: { code?: string } } })?.response
    ?.data?.code;
  const messages: Record<string, string> = {
    DELEGATION_DRIVER_ACTIVE_WORK:
      "Type replacement is blocked while current pickup assignment, nomination or accepted custody depends on this membership. Revocation remains available; it does not complete or reassign work.",
    DELEGATION_DRIVER_CEILING:
      "Existing or requested driver profile exceeds your current accepted driver ceiling.",
    INVITATION_UNAVAILABLE:
      "Invitation is expired, cancelled or unavailable. Ask the original inviter to verify it.",
    INVITATION_ALREADY_USED:
      "Invitation was consumed. Confirm an uncertain acceptance with its original operation ID after signing in.",
    INVITATION_IDENTITY_REQUIRED:
      "Sign in as the invited existing identity. Do not provide a new password for an existing account.",
    INVITATION_NEW_CREDENTIAL_REQUIRED:
      "A new identity requires a name and a valid password; existing users must sign in first.",
    INVITATION_STATE_CONFLICT:
      "Invitation state changed; cancellation or acceptance cannot proceed.",
    DELEGATION_OPERATION_CONFLICT:
      "The operation ID is already bound to different content. Preserve the original intent for review.",
    INVITATION_OPERATION_CONFLICT:
      "Acceptance identity conflicts with an existing operation.",
    DELEGATION_SCOPE_CEILING:
      "Requested or removed warehouse access exceeds your accepted delegation ceiling.",
    DELEGATION_FOREIGN_SCOPE:
      "Warehouse ownership does not match the selected tenant.",
    DELEGATION_AUTHORITY_REQUIRED:
      "An active owner-approved delegation authority is required; permissions or role names alone are insufficient.",
  };
  if (code)
    return (
      messages[code] ??
      "Request rejected by the current authorization or managed-grant contract. No success is confirmed."
    );
  // Never surface Axios request bodies (tokens/passwords) or untrusted server text.
  return "No confirmation received. Preserve the original intent and context; do not create a replacement request.";
}
