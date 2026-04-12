// lib/warehouses.ts
import { getToken } from "@/lib/auth"; // adjust if your token helper file differs
import { api } from "./api";

export type Warehouse = {
  id: string;
  name: string;
  location: string;
  region?: string | null;
  createdAt?: string;
};

function authHeaders() {
  const token = getToken();
  return { Authorization: `Bearer ${token}` };
}

export async function fetchWarehouses(): Promise<Warehouse[]> {
  const res = await api.get("/api/warehouses", { headers: authHeaders() });
  return Array.isArray(res.data) ? res.data : [];
}

export async function createWarehouse(payload: {
  name: string;
  location: string;
  region?: string;
}): Promise<Warehouse> {
  const res = await api.post("/api/warehouses", payload, {
    headers: authHeaders(),
  });

  // your backend returns the warehouse object directly
  return res.data;
}
