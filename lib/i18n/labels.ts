import type { Locale } from "@/lib/i18n/messages";

export type Translate = (key: string, values?: Record<string, string | number>) => string;

function fallbackPretty(value?: string | null) {
  if (!value) return "-";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeEnumValue(value?: string | null) {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  const segments = raw.split(".");
  return segments[segments.length - 1] || raw;
}

function translateWithFallback(
  key: string,
  rawValue: string,
  t?: Translate,
) {
  if (!t) return fallbackPretty(rawValue);
  const translated = t(key);
  return translated === key ? fallbackPretty(rawValue) : translated;
}

export function getStatusLabel(status?: string | null, t?: Translate) {
  const normalized = normalizeEnumValue(status);
  if (!normalized) return "-";
  return translateWithFallback(`common.status.${normalized}`, normalized, t);
}

export function getReasonCodeLabel(reasonCode?: string | null, t?: Translate) {
  const normalized = normalizeEnumValue(reasonCode);
  if (!normalized) return "-";
  return translateWithFallback(`common.reason.${normalized}`, normalized, t);
}

export function getRoleLabel(role?: string | null, t?: Translate) {
  const normalized = normalizeEnumValue(role);
  if (!normalized) return "-";
  return translateWithFallback(`common.role.${normalized}`, normalized, t);
}

export function getServiceTypeLabel(serviceType?: string | null, t?: Translate) {
  const normalized = normalizeEnumValue(serviceType);
  if (!normalized) return "-";
  return translateWithFallback(
    `createOrder.shipment.enum.serviceType.${normalized}`,
    normalized,
    t,
  );
}

export function getPaidStatusLabel(status?: string | null, t?: Translate) {
  const normalized = normalizeEnumValue(status);
  if (!normalized) return "-";
  return translateWithFallback(
    `createOrder.shipment.enum.paidStatus.${normalized}`,
    normalized,
    t,
  );
}

export function getPaymentTypeLabel(paymentType?: string | null, t?: Translate) {
  const normalized = normalizeEnumValue(paymentType);
  if (!normalized) return "-";
  return translateWithFallback(
    `createOrder.payment.enum.paymentType.${normalized}`,
    normalized,
    t,
  );
}

export function getPaidByLabel(paidBy?: string | null, t?: Translate) {
  const normalized = normalizeEnumValue(paidBy);
  if (!normalized) return "-";
  return translateWithFallback(
    `createOrder.payment.enum.paidBy.${normalized}`,
    normalized,
    t,
  );
}

export function getRecipientUnavailableLabel(value?: string | null, t?: Translate) {
  const normalized = normalizeEnumValue(value);
  if (!normalized) return "-";
  return translateWithFallback(
    `createOrder.payment.enum.recipientUnavailable.${normalized}`,
    normalized,
    t,
  );
}

export function isSupportedLocale(value: string): value is Locale {
  return value === "en" || value === "ru" || value === "uz";
}
