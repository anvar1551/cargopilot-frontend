import { api } from "@/lib/api";

export type PermissionItem = {
  id: string;
  key: string;
  resource: string;
  action: string;
  description: string | null;
};

export type RoleItem = {
  id: string;
  code: string;
  name: string;
  companyId: string | null;
  isSystem: boolean;
  permissions: PermissionItem[];
};

export async function fetchPermissions(signal?: AbortSignal) {
  const res = await api.get<{ items: PermissionItem[] }>("/api/auth/permissions", { signal });
  return res.data.items ?? [];
}

export async function fetchRoles(signal?: AbortSignal) {
  const res = await api.get<{ items: RoleItem[] }>("/api/auth/roles", { signal });
  return res.data.items ?? [];
}

export async function createRole(input: {
  code: string;
  name: string;
  permissionKeys: string[];
  isOwnerRole?: boolean;
}) {
  const res = await api.post<{ role: RoleItem }>("/api/auth/roles", input);
  return res.data.role;
}
