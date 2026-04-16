// lib/warehouses.ts
import { getToken } from "@/lib/auth"; // adjust if your token helper file differs
import { api } from "./api";

export const WAREHOUSE_TYPES = ["warehouse", "pickup_point"] as const;

export type WarehouseType = (typeof WAREHOUSE_TYPES)[number];

export const DEFAULT_WAREHOUSE_TYPE: WarehouseType = "warehouse";

export const WAREHOUSE_CAPABILITIES = {
  warehouse: [
    "inbound_intake",
    "sorting",
    "outbound_dispatch",
    "linehaul_handoff",
    "driver_assignment",
  ],
  pickup_point: [
    "customer_dropoff",
    "customer_pickup",
    "local_batch_scan",
    "driver_assignment",
    "handoff_to_hub",
  ],
} as const;

export type Warehouse = {
  id: string;
  name: string;
  type?: WarehouseType | null;
  location: string;
  region?: string | null;
  createdAt?: string;
};

export function normalizeWarehouseType(value?: string | null): WarehouseType {
  const normalized = String(value || "")
    .trim()
    .replace(/[-\s]+/g, "_")
    .toLowerCase();

  return WAREHOUSE_TYPES.includes(normalized as WarehouseType)
    ? (normalized as WarehouseType)
    : DEFAULT_WAREHOUSE_TYPE;
}

export function getWarehouseTypeLabel(type?: string | null) {
  switch (normalizeWarehouseType(type)) {
    case "pickup_point":
      return "Pickup point";
    case "warehouse":
    default:
      return "Warehouse";
  }
}

export function getWarehouseCapabilities(type?: string | null) {
  return WAREHOUSE_CAPABILITIES[normalizeWarehouseType(type)];
}

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
  type?: WarehouseType;
  location: string;
  region?: string;
}): Promise<Warehouse> {
  const res = await api.post("/api/warehouses", payload, {
    headers: authHeaders(),
  });

  // your backend returns the warehouse object directly
  return res.data;
}
