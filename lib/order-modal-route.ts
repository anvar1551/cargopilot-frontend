/** Route-owned query parameters must never mount a competing generic detail fetch. */
export function usesGenericOrderModal(pathname: string | null): boolean {
  const path = (pathname ?? "").replace(/\/+$/, "");
  return (
    !/^\/dashboard\/manager\/invoices(?:\/|$)/i.test(path) &&
    !/^\/dashboard\/(manager|warehouse|customer)\/orders\/[^/]+$/i.test(path)
  );
}
