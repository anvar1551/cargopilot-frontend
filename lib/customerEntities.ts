import { api } from "./api";

export type CustomerType = "PERSON" | "COMPANY";

export type CustomerAddress = {
  id: string;
  city?: string | null;
  street?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  neighborhood?: string | null;
  postalCode?: string | null;
  landmark?: string | null;
  building?: string | null;
  floor?: string | null;
  apartment?: string | null;
  country?: string | null;
  addressType?: "RESIDENTIAL" | "BUSINESS" | null;
  createdAt?: string;
};

export type CustomerEntity = {
  id: string;
  type: CustomerType;
  name: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  altPhone1?: string | null;
  altPhone2?: string | null;
  taxId?: string | null;
  createdAt: string;
  defaultAddress?: CustomerAddress | null;
  addresses?: CustomerAddress[];

  _count?: {
    orders: number;
    users: number;
    addresses: number;
  };
};

export type ListCustomersResponse = {
  data: CustomerEntity[];
  total: number;
  page: number;
  limit: number;
  pageCount: number;
};

export async function fetchCustomers(
  params?: {
    q?: string;
    type?: CustomerType;
    page?: number;
    limit?: number;
  },
  signal?: AbortSignal,
) {
  const res = await api.get<ListCustomersResponse>("/api/customers", {
    params,
    signal,
  });

  return res.data;
}

export async function createCustomer(dto: unknown) {
  const res = await api.post("/api/customers", dto);
  return res.data;
}

export async function getCustomerById(id: string) {
  const res = await api.get<CustomerEntity>(`/api/customers/${id}`);
  return res.data;
}
