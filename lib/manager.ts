import { api } from "@/lib/api";

export type DriverLite = {
  id: string;
  name: string;
  email: string;
  warehouseId: string | null;
};

export async function fetchManagerOverview() {
  const res = await api.get("/api/manager/overview");
  return res.data;
}

export async function fetchDrivers(): Promise<DriverLite[]> {
  const res = await api.get("/api/manager/drivers");
  return Array.isArray(res.data) ? res.data : res.data?.drivers ?? [];
}

export async function fetchWarehouses() {
  const res = await fetch("/api/manager/warehouses");
  if (!res.ok) throw new Error("Failed to load warehouses");
  return res.json();
}
