import { api } from "./api";

export type OrganizationType =
  | "company"
  | "branch"
  | "agent"
  | "pickup_point"
  | "carrier"
  | "client";

export type Organization = {
  id: string;
  name: string;
  type: OrganizationType;
  code?: string | null;
  parentOrgId?: string | null;
  parentOrg?: {
    id: string;
    name: string;
    type: OrganizationType;
    code?: string | null;
    isActive: boolean;
  } | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    childOrgs: number;
    companyMemberships: number;
    ownedOrders: number;
    assignedOrders: number;
  };
};

export type ListOrganizationsResponse = {
  data: Organization[];
  total: number;
  page: number;
  limit: number;
  pageCount: number;
};

export type ListOrganizationsParams = {
  type?: OrganizationType;
  parentOrgId?: string;
  isActive?: boolean | "true" | "false";
  q?: string;
  page?: number;
  limit?: number;
};

export async function fetchOrganizations(
  params?: ListOrganizationsParams,
  signal?: AbortSignal,
) {
  const queryParams: Record<string, string | number> = {};
  if (params?.type) queryParams.type = params.type;
  if (params?.parentOrgId) queryParams.parentOrgId = params.parentOrgId;
  if (params?.q) queryParams.q = params.q;
  if (typeof params?.page === "number") queryParams.page = params.page;
  if (typeof params?.limit === "number") {
    queryParams.limit = Math.max(1, Math.min(100, params.limit));
  }
  if (typeof params?.isActive === "boolean") {
    queryParams.isActive = params.isActive ? "true" : "false";
  } else if (params?.isActive) {
    queryParams.isActive = params.isActive;
  }

  const res = await api.get<ListOrganizationsResponse>("/api/organizations", {
    params: queryParams,
    signal,
  });
  return res.data;
}

export async function createOrganization(payload: {
  name: string;
  type: OrganizationType;
  code?: string | null;
  parentOrgId?: string | null;
  isActive?: boolean;
}) {
  const res = await api.post<Organization>("/api/organizations", payload);
  return res.data;
}

export async function updateOrganization(
  id: string,
  payload: {
    name?: string;
    type?: OrganizationType;
    code?: string | null;
    parentOrgId?: string | null;
    isActive?: boolean;
  },
) {
  const res = await api.put<Organization>(`/api/organizations/${id}`, payload);
  return res.data;
}

export async function deactivateOrganization(id: string) {
  const res = await api.delete<Organization>(`/api/organizations/${id}`);
  return res.data;
}
