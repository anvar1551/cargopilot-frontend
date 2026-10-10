import axios from "axios";
import { z } from "zod";
import { api } from "./api";
import { authContext, authEpoch, getUser } from "./auth";
import {
  operationalPayload,
  readOperationalIntent,
  submitOperationalIntent,
  type OperationalKind,
} from "./operational-intent";

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const routes = {
  invite: "/api/auth/company-invitations",
  cancel: "/api/auth/company-invitations/cancel",
  grant: "/api/auth/company-operational-grants",
  accept: "/api/auth/company-invitations/accept",
};
function key(context: string, kind: OperationalKind) {
  return `cp_operational_v1:${encodeURIComponent(String(api.defaults.baseURL ?? window.location.origin))}:${encodeURIComponent(context)}:${kind}`;
}
export function pendingOperational(context: string, kind: OperationalKind) {
  const i = readOperationalIntent(localStorage.getItem(key(context, kind)));
  if (i && (i.context !== context || i.kind !== kind))
    throw Error("Stored context mismatch");
  return i;
}
export async function finishOperational(
  context: string,
  kind: OperationalKind,
) {
  if (!navigator.locks)
    throw Error("Browser locking is required for durable administration");
  await navigator.locks.request(
    key(context, kind),
    { ifAvailable: true },
    async (lock) => {
      if (!lock) throw Error("Another tab is submitting this action");
      if (pendingOperational(context, kind)?.state !== "confirmed")
        throw Error("Unconfirmed intent cannot be replaced");
      localStorage.removeItem(key(context, kind));
      if (pendingOperational(context, kind)) throw Error("Storage unavailable");
    },
  );
}
function io(
  context: string,
  kind: OperationalKind,
  current: () => boolean,
  send: Parameters<typeof submitOperationalIntent>[3]["send"],
) {
  if (!navigator.locks)
    throw Error("Browser locking is required for durable administration");
  return {
    current,
    send,
    uuid: () => crypto.randomUUID(),
    read: () => localStorage.getItem(key(context, kind)),
    write: (raw: string) => localStorage.setItem(key(context, kind), raw),
    lock: async <T>(work: () => Promise<T>) =>
      navigator.locks.request(
        key(context, kind),
        { ifAvailable: true },
        async (lock) => {
          if (!lock) throw Error("Another tab is submitting this action");
          return work();
        },
      ),
  };
}
export async function mutateOperational(
  context: string,
  kind: Exclude<OperationalKind, "accept">,
  input: unknown | null,
) {
  const epoch = authEpoch(),
    current = () => context === authContext() && epoch === authEpoch();
  let oneTimeToken: string | undefined;
  const intent = await submitOperationalIntent(
    kind,
    context,
    input,
    io(context, kind, current, async (i) => {
      const body = operationalPayload(kind, i.payload);
      const r = await api.post(
        routes[kind],
        { ...body, operationId: i.operationId },
        { timeout: 15000, noReplay: true } as Parameters<typeof api.post>[2],
      );
      if (!current()) throw Error("Session changed");
      if (kind === "invite" && r.data.token !== undefined)
        oneTimeToken = tokenSchema.parse(r.data.token);
      return r.data;
    }),
  );
  return { intent, oneTimeToken }; // Token is never included in the durable intent.
}

export async function acceptOperationalInvitation(input: {
  token: string;
  mode: "new" | "existing";
  name?: string;
  password?: string;
}) {
  const token = tokenSchema.parse(input.token.trim());
  const epoch = authEpoch(),
    selected = authContext();
  if (input.mode === "new" && selected)
    throw Error("Sign out before enrolling a new identity");
  if (input.mode === "existing" && !selected)
    throw Error("Sign in as the invited identity first");
  if (
    input.mode === "existing" &&
    (input.name !== undefined || input.password !== undefined)
  )
    throw Error("Existing identities cannot establish credentials here");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  const tokenDigest = Array.from(new Uint8Array(digest), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
  // A new-user request may have committed before its response was lost. Keep its
  // anonymous receipt identity and confirm only through an authenticated user.
  const anonymous = pendingOperational("recipient:new", "accept");
  const confirmingNew =
    input.mode === "existing" && anonymous?.payload.tokenDigest === tokenDigest;
  const context =
    confirmingNew || input.mode === "new" ? "recipient:new" : selected!;
  const old = pendingOperational(context, "accept");
  if (input.mode === "new" && old)
    throw Error(
      "Sign in to confirm the original new-user acceptance; do not repeat credentials",
    );
  const credentials =
    input.mode === "new"
      ? z
          .object({
            password: z
              .string()
              .min(12)
              .max(72)
              .refine(
                (v) =>
                  new TextEncoder().encode(v).length <= 72 &&
                  v.trim().length >= 12 &&
                  !/[\u0000-\u001f\u007f]/.test(v),
              ),
            name: z
              .string()
              .trim()
              .min(1)
              .max(160)
              .regex(/^[^\u0000-\u001f\u007f]+$/),
          })
          .strict()
          .parse({ name: input.name, password: input.password })
      : {};
  const payload = old?.payload ?? {
    tokenDigest,
    mode: input.mode,
    ...(input.mode === "new" ? { name: input.name?.trim() } : {}),
  };
  if (payload.tokenDigest !== tokenDigest)
    throw Error("Original invitation must be retained");
  const current = () => authEpoch() === epoch && authContext() === selected;
  // Anonymous acceptance has its own Axios instance: no automatic token injection,
  // refresh, replay or error logging. Existing-user acceptance uses bound api.
  const anonymousApi = axios.create({
    baseURL: api.defaults.baseURL,
    timeout: 15000,
  });
  const intent = await submitOperationalIntent(
    "accept",
    context,
    payload,
    io(context, "accept", current, async (i) => {
      const body = { token, operationId: i.operationId, ...credentials };
      const r =
        input.mode === "new"
          ? await anonymousApi.post(
              api.defaults.baseURL?.endsWith("/api")
                ? routes.accept.slice(4)
                : routes.accept,
              body,
            )
          : await api.post(routes.accept, body, {
              timeout: 15000,
              noReplay: true,
            } as Parameters<typeof api.post>[2]);
      if (input.mode === "existing" && r.data?.userId !== getUser()?.id)
        throw Error("Accepted identity confirmation mismatch");
      return r.data;
    }),
  );
  return intent;
}
