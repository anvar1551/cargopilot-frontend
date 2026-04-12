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

export function getStatusLabel(status?: string | null, t?: Translate) {
  if (!status) return "-";
  return t ? t(`common.status.${status}`) : fallbackPretty(status);
}

export function getReasonCodeLabel(reasonCode?: string | null, t?: Translate) {
  if (!reasonCode) return "-";
  return t ? t(`common.reason.${reasonCode}`) : fallbackPretty(reasonCode);
}

export function getRoleLabel(role?: string | null, t?: Translate) {
  if (!role) return "-";
  return t ? t(`common.role.${role}`) : fallbackPretty(role);
}

export function getServiceTypeLabel(serviceType?: string | null, t?: Translate) {
  if (!serviceType) return "-";
  return t ? t(`createOrder.shipment.enum.serviceType.${serviceType}`) : fallbackPretty(serviceType);
}

export function isSupportedLocale(value: string): value is Locale {
  return value === "en" || value === "ru" || value === "uz";
}
