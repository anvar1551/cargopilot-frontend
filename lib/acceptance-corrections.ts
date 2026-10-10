import type { AuthUser } from "./auth";

// Navigation hints only. Every read/mutation still requires server authorization.
export function postLoginDestination(user: AuthUser | null, next: string | null, home: string): string {
  if (!user?.tenantId || !user.companyId || !user.companyMembershipId || !user.tenantMembershipId || !next) return home;
  if (!next.startsWith("/dashboard/") || /[\\\x00-\x20\x7f]/.test(next)) return home;
  const url = new URL(next, "http://navigation.invalid");
  const rawPath = next.split(/[?#]/)[0];
  if (url.origin !== "http://navigation.invalid" || url.pathname !== rawPath || rawPath.includes("%")) return home;
  for (const key of ["tenantId", "companyId", "companyMembershipId"] as const) {
    if (url.searchParams.has(key) && url.searchParams.getAll(key).some(value => value !== user[key])) return home;
  }
  const permissions = new Set(user.permissionCodes ?? []);
  const any = (...keys: string[]) => keys.some(key => permissions.has(key));
  const pathname = url.pathname;
  if (pathname === "/dashboard/warehouse") {
    return any("shipment.view") && any("shipment.custody.intake", "shipment.custody.receive", "shipment.custody.dispatch", "shipment.custody.last-mile-offer") ? next : home;
  }
  if (pathname === "/dashboard/service-cash" || pathname === "/dashboard/manager/service-cash") {
    return any("cash.custody.read") ? next : home;
  }
  if (pathname !== home && !pathname.startsWith(home + "/")) return home;
  if (url.searchParams.has("order") && !any("shipment.view", "shipment.viewAssigned") && !(pathname === "/dashboard/manager/invoices" && any("finance.invoices.issue"))) return home;
  if (pathname === home || pathname === home + "/settings") return next;
  const routes: Array<[RegExp, string[]]> = [
    [/^\/dashboard\/manager\/customers(?:\/[^/]+)?$/, ["customers.read"]],
    [/^\/dashboard\/(manager|warehouse|customer)\/orders(?:\/[^/]+)?$/, ["shipment.view", "shipment.viewAssigned"]],
    [/^\/dashboard\/manager\/pricing$/, ["pricing.read"]],
    [/^\/dashboard\/manager\/order-billing$/, ["billing.payers.bind", "pricing.orders.accept", "pricing.orders.approve"]],
    [/^\/dashboard\/manager\/invoices$/, ["finance.invoices.read", "finance.invoices.issue"]],
    [/^\/dashboard\/manager\/users$/, ["membership.invite", "membership.delegateOperational"]],
    [/^\/dashboard\/manager\/drivers$/, ["membership.delegateDrivers"]],
    [/^\/dashboard\/manager\/drivers\/roster$/, ["drivers.read"]],
    [/^\/dashboard\/manager\/warehouses$/, ["shipment.view", "warehouse.create"]],
    [/^\/dashboard\/manager\/financial-access$/, ["membership.proposeFinancial", "membership.approveFinancial"]],
    [/^\/dashboard\/manager\/cash-access$/, ["membership.proposeCashCapability", "membership.approveCashCapability"]],
    [/^\/dashboard\/manager\/entity-setup$/, ["finance.entitySetup.propose", "finance.entitySetup.approve"]],
    [/^\/dashboard\/manager\/dispatch$/, ["shipment.assignCourier"]],
    [/^\/dashboard\/manager\/support$/, ["support.view"]],
    [/^\/dashboard\/manager\/analytics$/, ["shipment.view"]],
    [/^\/dashboard\/manager\/business(?:\/[^/]+)?$/, ["organizations.read"]],
    [/^\/dashboard\/manager\/live-map$/, ["drivers.read"]],
    [/^\/dashboard\/manager\/integrations$/, ["integration.provider.read", "integration.routing.read", "integration.outbox.read"]],
    [/^\/dashboard\/manager\/payment-providers$/, ["payments.providers.read"]],
  ];
  if (pathname === "/dashboard/manager/finance") {
    return [...permissions].some(key => /^finance\./.test(key) && /\.(read|viewLedger)$/.test(key)) ? next : home;
  }
  return routes.some(([pattern, keys]) => pattern.test(pathname) && any(...keys)) ? next : home;
}

// A scoped order's payment method does not prove collection or invoice payment.
// Current overview projection has no accepted instruction/custody evidence.
export function overviewPaymentLabel(order: { paymentType?: string | null }): string {
  return ["CASH", "ONLINE"].includes(order.paymentType ?? "")
    ? `${order.paymentType} · payment status unknown`
    : "Unknown";
}

export function pricingHistoryReady(canRead: boolean, tab: string, selected: string): boolean {
  return canRead && (tab === "policy" || (tab === "tariff" && !!selected));
}

export function navigationLabel(translated: string, key: string, fallback: string): string {
  return translated && translated !== key ? translated : fallback;
}
