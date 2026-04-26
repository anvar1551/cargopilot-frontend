// lib/addresses.ts
import { api } from "./api";

export type AddressType = "RESIDENTIAL" | "BUSINESS";

export type Address = {
  id: string;
  customerEntityId?: string | null;

  city?: string | null;
  street?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  neighborhood?: string | null;
  postalCode?: string | null;
  landmark?: string | null;

  building?: string | null;
  floor?: string | null;
  apartment?: string | null;

  country?: string | null;
  addressType?: AddressType | null;
};

export function formatAddress(a: Address) {
  return [
    a.addressLine1,
    a.addressLine2,
    a.street,
    a.building ? `Bldg ${a.building}` : null,
    a.floor ? `Fl. ${a.floor}` : null,
    a.apartment ? `Apt ${a.apartment}` : null,
    a.neighborhood,
    a.city,
    a.postalCode,
    a.country,
    a.landmark ? `Landmark: ${a.landmark}` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

export type FetchAddressesParams = {
  customerEntityId?: string; // manager-mode; if omitted => self-mode
  q?: string;
  page?: number;
  limit?: number;
};

export async function fetchAddresses(
  params?: FetchAddressesParams,
  signal?: AbortSignal,
) {
  const res = await api.get<Address[]>("/api/addresses", {
    params: {
      customerEntityId: params?.customerEntityId,
      q: params?.q?.trim() || undefined,
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
    },
    signal,
  });

  return res.data;
}
