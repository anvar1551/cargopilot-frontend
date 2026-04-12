import type { Address } from "@/lib/addresses";

// matches your prisma fields
export function buildAddressText(addr?: Address | null): string {
  if (!addr) return "";

  const parts = [
    addr.addressLine1,
    addr.addressLine2,
    addr.building,
    addr.floor ? `Floor ${addr.floor}` : null,
    addr.apartment,
    addr.street,
    addr.neighborhood,
    addr.city,
    addr.postalCode,
    addr.country,
    addr.landmark ? `Landmark: ${addr.landmark}` : null,
  ].filter(Boolean);

  return parts.join(", ");
}
