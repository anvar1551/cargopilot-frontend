import { api } from "@/lib/api";

export type UserRole = "customer" | "manager" | "warehouse" | "driver";
export type MembershipScopeType =
  | "company"
  | "branch"
  | "warehouse"
  | "agent"
  | "pickup_point"
  | "carrier"
  | "client";

export type RoleLite = {
  id: string;
  code: string;
  name: string;
  isSystem: boolean;
};

export type User = {
  id: string;
  membershipId: string;
  createdAt: string;
  name: string;
  email: string;
  warehouseId: string | null;
  customerEntityId: string | null;
  driverType: "local" | "linehaul" | null;
  branchId: string | null;
  roles: RoleLite[];
  scopes: Array<{
    scopeType: MembershipScopeType;
    scopeRefId: string;
  }>;
};

export type ListUsersResponse = {
  items: User[];
  total: number;
  page: number;
  limit: number;
};

export async function fetchUsers(
  params?: {
    q?: string;
    page?: number;
    limit?: number;
  },
  signal?: AbortSignal,
) {
  const res = await api.get<ListUsersResponse>("/api/auth", {
    params,
    signal,
  });

  return res.data;
}

export type AppRole = "customer" | "manager" | "warehouse" | "driver";

export type CreateUserAsManagerInput = {
  name: string;
  email: string;
  password: string;
  roleCodes: string[];
  branchId?: string | null;
  warehouseId?: string | null;
  customerEntityId?: string | null;
  driverType?: "local" | "linehaul" | null;
  scopes?: Array<{
    scopeType: MembershipScopeType;
    scopeRefId: string;
  }>;
};

export async function createUser(input: CreateUserAsManagerInput) {
  const res = await api.post("/api/auth", input);
  return res.data;
}

export async function updateUserAccess(
  userId: string,
  input: {
    name?: string;
    email?: string;
    roleCodes?: string[];
    branchId?: string | null;
    warehouseId?: string | null;
    customerEntityId?: string | null;
    driverType?: "local" | "linehaul" | null;
    scopes?: Array<{
      scopeType: MembershipScopeType;
      scopeRefId: string;
    }>;
  },
) {
  const res = await api.patch(`/api/auth/${userId}`, input);
  return res.data;
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}) {
  const res = await api.post<{ message: string }>("/api/auth/change-password", input);
  return res.data;
}

export async function deleteUser(userId: string) {
  const res = await api.delete<{ message: string }>(`/api/auth/${userId}`);
  return res.data;
}
