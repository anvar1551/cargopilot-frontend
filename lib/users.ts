import { api } from "@/lib/api";

export type UserRole = "customer" | "manager" | "warehouse" | "driver";

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;

  warehouse?: {
    id: string;
    name: string;
  } | null;

  customerEntity?: {
    id: string;
    name: string;
    companyName?: string | null;
  } | null;
};

export type ListUsersResponse = {
  data: User[];
  total: number;
  page: number;
  limit: number;
  pageCount: number;
};

export async function fetchUsers(
  params?: {
    q?: string;
    role?: UserRole;
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
  role: AppRole;
  phone?: string | null;
  warehouseId?: string | null;
  customerEntityId?: string | null;
};

export async function createUser(input: CreateUserAsManagerInput) {
  const res = await api.post("/api/auth", input);
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
