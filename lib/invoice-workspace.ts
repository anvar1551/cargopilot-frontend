import { z } from "zod";
import { api } from "./api";
import { authContext, authEpoch } from "./auth";
import { canonicalIntent } from "./creation-intent";
const id = z.string().uuid(),
  payloadSchema = z
    .object({
      orderId: id,
      priceApprovalId: id,
      reason: z.string().trim().min(1).max(1000),
    })
    .strict();
export type InvoicePayload = z.infer<typeof payloadSchema>;
const resultSchema = z
  .object({
    id,
    orderId: id,
    invoiceNumber: z.string().min(1),
    amount: z.string().regex(/^\d+\.\d{4}$/),
    currency: z.string().regex(/^[A-Z]{3}$/),
    status: z.string(),
    billing: z.object({ priceApprovalId: id }).passthrough(),
  })
  .passthrough();
export type InvoiceResult = z.infer<typeof resultSchema>;
export type InvoiceIntent = {
  version: 1;
  context: string;
  operationId: string;
  payload: InvoicePayload;
  display: {
    orderNumber: string;
    payerName: string;
    amount: string;
    currency: string;
  };
  state: "uncertain" | "confirmed";
  result?: InvoiceResult;
};
const displaySchema = z
  .object({
    orderNumber: z.string().min(1).max(100),
    payerName: z.string().min(1).max(300),
    amount: z.string().regex(/^\d+\.\d{4}$/),
    currency: z.string().length(3),
  })
  .strict();
export function businessText(value: unknown, fallback = "Unavailable") {
  return typeof value === "string" && value.trim()
    ? value.replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        "[internal reference]",
      )
    : fallback;
}
export function validateInvoiceResult(intent: InvoiceIntent, value: unknown) {
  const r = resultSchema.parse(value);
  if (
    r.orderId !== intent.payload.orderId ||
    r.billing.priceApprovalId !== intent.payload.priceApprovalId ||
    r.amount !== intent.display.amount ||
    r.currency !== intent.display.currency
  )
    throw Error("Invoice confirmation does not match the original intent.");
  return {
    id: r.id,
    orderId: r.orderId,
    invoiceNumber: r.invoiceNumber,
    amount: r.amount,
    currency: r.currency,
    status: r.status,
    billing: { priceApprovalId: r.billing.priceApprovalId },
  };
}
export function readInvoiceIntent(raw: string | null): InvoiceIntent | null {
  if (raw === null) return null;
  if (raw.length > 20000)
    throw Error("Stored invoice request exceeds its bound.");
  const i = z
    .object({
      version: z.literal(1),
      context: z.string().min(1).max(1000),
      operationId: id,
      payload: payloadSchema,
      display: displaySchema,
      state: z.enum(["uncertain", "confirmed"]),
      result: resultSchema.optional(),
    })
    .strict()
    .parse(JSON.parse(raw));
  if (i.state === "confirmed") {
    if (!i.result) throw Error("Confirmation missing");
    i.result = validateInvoiceResult(i, i.result);
  }
  return i;
}
type IO = {
  current: () => boolean;
  read: () => string | null;
  write: (v: string) => void;
  uuid: () => string;
  lock: <T>(f: () => Promise<T>) => Promise<T>;
  send: (i: InvoiceIntent) => Promise<unknown>;
};
export async function submitInvoiceIntent(
  context: string,
  input: { payload: unknown; display: unknown } | null,
  io: IO,
) {
  const guard = () => {
    if (!context || !io.current())
      throw Error("Session changed; retain the original request.");
  };
  guard();
  return io.lock(async () => {
    guard();
    let intent = readInvoiceIntent(io.read());
    const next = input
      ? {
          payload: payloadSchema.parse(input.payload),
          display: displaySchema.parse(input.display),
        }
      : null;
    if (
      intent &&
      (intent.context !== context ||
        (next &&
          canonicalIntent(next.payload) !== canonicalIntent(intent.payload)))
    )
      throw Error("Conflicting request. Retry the original content only.");
    if (!intent) {
      if (!next) throw Error("Original request unavailable");
      intent = {
        version: 1,
        context,
        operationId: id.parse(io.uuid()),
        ...next,
        state: "uncertain",
      };
    }
    const persist = () => {
      guard();
      const raw = JSON.stringify(intent);
      io.write(raw);
      if (io.read() !== raw)
        throw Error("Storage verification failed. Nothing may be sent.");
    };
    intent.state = "uncertain";
    persist();
    const result = validateInvoiceResult(
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
    "cp_invoice_v1:" +
    encodeURIComponent(String(api.defaults.baseURL ?? window.location.origin)) +
    ":" +
    encodeURIComponent(context)
  );
}
async function lock<T>(context: string, f: () => Promise<T>) {
  if (!navigator.locks) throw Error("Exclusive browser locking is required.");
  return navigator.locks.request(key(context), { ifAvailable: true }, (l) => {
    if (!l) throw Error("Another tab is submitting this invoice request.");
    return f();
  });
}
export function pendingInvoice(context: string) {
  const i = readInvoiceIntent(localStorage.getItem(key(context)));
  if (i && i.context !== context) throw Error("Stored context mismatch");
  return i;
}
export async function issueInvoice(
  context: string,
  input: { payload: unknown; display: unknown } | null,
) {
  const epoch = authEpoch();
  return submitInvoiceIntent(context, input, {
    current: () => context === authContext() && epoch === authEpoch(),
    read: () => localStorage.getItem(key(context)),
    write: (v) => localStorage.setItem(key(context), v),
    uuid: () => crypto.randomUUID(),
    lock: (f) => lock(context, f),
    send: async (i) =>
      (
        await api.post(
          "/api/invoices/orders/" + i.payload.orderId + "/issue",
          {
            operationId: i.operationId,
            priceApprovalId: i.payload.priceApprovalId,
            reason: i.payload.reason,
          },
          { timeout: 15000, noReplay: true } as Parameters<typeof api.post>[2],
        )
      ).data,
  });
}
export async function closeInvoiceReceipt(context: string) {
  const epoch = authEpoch();
  return lock(context, async () => {
    if (context !== authContext() || epoch !== authEpoch())
      throw Error("Session changed");
    if (pendingInvoice(context)?.state !== "confirmed")
      throw Error("Uncertain requests cannot be abandoned.");
    localStorage.removeItem(key(context));
    if (localStorage.getItem(key(context)) !== null)
      throw Error("Storage failure");
  });
}
export async function readInvoiceWorkspace<T>(
  context: string,
  params: Record<string, unknown>,
) {
  const epoch = authEpoch();
  if (context !== authContext()) throw Error("Session changed");
  const r = await api.get("/api/invoices/workspace", {
    params,
    timeout: 15000,
    noReplay: true,
  } as Parameters<typeof api.get>[1]);
  if (context !== authContext() || epoch !== authEpoch())
    throw Error("Session changed");
  return r.data as T;
}
export async function invoiceDownload(context: string, orderId: string) {
  const epoch = authEpoch();
  if (context !== authContext()) throw Error("Session changed");
  const r = await api.get(
    "/api/invoices/orders/" + id.parse(orderId) + "/url",
    { timeout: 15000, noReplay: true } as Parameters<typeof api.get>[1],
  );
  if (context !== authContext() || epoch !== authEpoch())
    throw Error("Session changed");
  const url = new URL(r.data.url);
  if (!["https:", "http:"].includes(url.protocol))
    throw Error("Unsupported file URL");
  return url.href;
}
export function invoiceError(e: unknown) {
  const v = e as {
    response?: { status?: number; data?: { error?: string } };
    message?: string;
  };
  const messages: Record<string, string> = {
    BILLING_INTENT_CONFLICT:
      "This request identity is already bound to different content. Preserve the original request for review.",
    BILLING_INVOICE_RECEIPT_CONFLICT:
      "The original invoice receipt cannot be confirmed against this context and source. Preserve it for review.",
    BILLING_ACTIVE_ENTITY_REQUIRED:
      "An active, explicitly configured issuing entity is required.",
    BILLING_CURRENT_ACCEPTED_PRICE_REQUIRED:
      "The selected price is no longer current. An unresolved request cannot be retargeted.",
    BILLING_ACCEPTED_PRICE_REQUIRED: "A valid accepted price is required.",
    BILLING_ACCEPTED_POLICY_REQUIRED:
      "An independently approved policy is required.",
    BILLING_ORDER_STATE_INELIGIBLE:
      "The order is not in an invoice-eligible state under its accepted policy.",
    BILLING_BASE_CURRENCY_FX_POLICY_REQUIRED:
      "Invoice and issuing-entity base currencies must match. FX is unavailable.",
    BILLING_NONCOLLECTIBLE_INVOICE_UNAVAILABLE:
      "A zero price cannot produce a manual invoice.",
    BILLING_INVOICE_ALREADY_EXISTS_OR_UNACCEPTED:
      "An invoice already exists or lacks accepted evidence. Inspect the register; do not create a replacement.",
    CASH_INVOICE_BASIS_CONFLICT:
      "The accepted price, payment instruction and service-charge obligation do not agree.",
  };
  const code = v.response?.data?.error;
  if (code && messages[code]) return messages[code];
  if (v.response?.status === 401)
    return "Session unavailable. Sign in again with the original selected company before retrying.";
  if (v.response?.status === 403)
    return "Current invoice authority or resource access is unavailable. Administrator status does not grant access.";
  if (v.response?.status === 404)
    return "This record is unavailable in your selected context.";
  return businessText(
    v.response?.data?.error ?? v.message,
    "Result unconfirmed. Preserve the original request.",
  );
}
