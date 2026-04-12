import { api } from "./api";
import { CreateOrderPayload } from "./validators/order";

export type ParcelInput = {
  weightKg?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
};

export type OrderTaskType = "pickup" | "delivery" | "linehaul";
export type OrderStatus =
  | "pending"
  | "assigned"
  | "pickup_in_progress"
  | "picked_up"
  | "at_warehouse"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "exception"
  | "return_in_progress"
  | "returned"
  | "cancelled";

export type DriverWorkload = {
  driverId: string;
  totalAssigned: number;
  activeAssigned: number;
  byStatus: Record<string, number>;
};

export type Order = {
  id: string;
  orderNumber?: string | number | null;
  status?: string | null;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  plannedDeliveryAt?: string | null;
  destinationCity?: string | null;
  serviceType?: string | null;
  labelUrl?: string | null;
  parcels?: Array<{
    id?: string | null;
    labelKey?: string | null;
    parcelCode?: string | null;
    pieceNo?: number | null;
    pieceTotal?: number | null;
  }> | null;
  customer?: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
  } | null;
  customerEntity?: {
    id?: string | null;
    name?: string | null;
    companyName?: string | null;
    phone?: string | null;
  } | null;
  invoice?: {
    status?: string | null;
    invoiceUrl?: string | null;
    paymentUrl?: string | null;
  } | null;
  Invoice?: {
    status?: string | null;
    invoiceUrl?: string | null;
    paymentUrl?: string | null;
  } | null;
  senderName?: string | null;
  senderPhone?: string | null;
  receiverName?: string | null;
  receiverPhone?: string | null;
  currentWarehouse?: {
    id?: string | null;
    name?: string | null;
    location?: string | null;
    region?: string | null;
  } | null;
  trackingEvents?: Array<{
    id?: string | null;
    status?: string | null;
    timestamp?: string | null;
    note?: string | null;
  }> | null;
  tracking?: Array<{
    id?: string | null;
    status?: string | null;
    timestamp?: string | null;
    note?: string | null;
  }> | null;
  [key: string]: unknown;
};

export type OrdersResponse = {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  pageCount: number;
  nextCursor?: string | null;
  mode?: "page" | "cursor";
  totalExact?: boolean;
};

export type ListOrdersParams = {
  q?: string;
  page?: number;
  limit?: number;
  cursor?: string;
  mode?: "page" | "cursor";
  scope?: "fast" | "deep";
  statuses?: string[];
  createdFrom?: string;
  createdTo?: string;
  customerQuery?: string;
  assignedDriverId?: string;
  warehouseId?: string;
  region?: string;
};

export type OrderImportPreviewRow = {
  rowNumber: number;
  valid: boolean;
  errors: string[];
  summary: {
    receiverName: string;
    pickupAddress: string;
    dropoffAddress: string;
    serviceType: string;
    codAmount: number | null;
    referenceId: string | null;
  };
};

export type OrderImportPreview = {
  templateColumns: readonly string[];
  rows: OrderImportPreviewRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
};

export async function createOrder(dto: CreateOrderPayload) {
  const res = await api.post("/api/orders", dto);
  return res.data;
}

export async function fetchOrders(
  params?: ListOrdersParams,
): Promise<OrdersResponse> {
  const res = await api.get("/api/orders", {
    params: {
      ...params,
      statuses: params?.statuses?.join(",") || undefined,
    },
  });
  return res.data;
}

export async function exportOrdersCsv(params?: ListOrdersParams) {
  const res = await api.get("/api/orders/export.csv", {
    params: {
      ...params,
      statuses: params?.statuses?.join(",") || undefined,
    },
    responseType: "blob",
  });
  return res.data as Blob;
}

export async function downloadOrderImportTemplate() {
  const res = await api.get("/api/orders/import/template.csv", {
    responseType: "blob",
  });
  return res.data as Blob;
}

export async function previewOrderImport(payload: {
  csvText: string;
  customerEntityId?: string | null;
}) {
  const res = await api.post("/api/orders/import/preview", payload);
  return res.data as OrderImportPreview;
}

export async function confirmOrderImport(payload: {
  csvText: string;
  customerEntityId?: string | null;
}) {
  const res = await api.post("/api/orders/import/confirm", payload);
  return res.data as { success: boolean; count: number; orders: Order[] };
}

export async function fetchOrdersPaged(params?: {
  q?: string;
  page?: number;
  limit?: number;
}): Promise<OrdersResponse> {
  const res = await api.get("/api/orders", { params });
  return res.data;
}

export async function fetchOrderById(id: string) {
  const res = await api.get(`/api/orders/${id}`);
  return res.data;
}

export async function assignDriversBulk(payload: {
  orderIds: string[];
  driverId: string;
  type: OrderTaskType;
  warehouseId?: string | null;
  note?: string | null;
  region?: string | null;
  includeFull?: boolean;
}) {
  const params = payload.includeFull ? { include: "full" } : undefined;
  const res = await api.post(
    `/api/orders/assign-driver-bulk`,
    {
      orderIds: payload.orderIds,
      driverId: payload.driverId,
      type: payload.type,
      warehouseId: payload.warehouseId ?? null,
      note: payload.note ?? null,
      region: payload.region ?? null,
    },
    { params },
  );
  return res.data as { success: boolean; count: number; orders: Order[] };
}

// Backward-compatible alias used by older UI modules.
export const assignOrderTasksBulk = assignDriversBulk;

export async function updateOrdersStatusBulk(payload: {
  orderIds: string[];
  status: OrderStatus;
  warehouseId?: string | null;
  reasonCode?: string | null;
  note?: string | null;
  region?: string | null;
  includeFull?: boolean;
}) {
  const params = payload.includeFull ? { include: "full" } : undefined;
  const res = await api.post(
    `/api/orders/status-bulk`,
    {
      orderIds: payload.orderIds,
      status: payload.status,
      warehouseId: payload.warehouseId ?? null,
      reasonCode: payload.reasonCode ?? null,
      note: payload.note ?? null,
      region: payload.region ?? null,
    },
    { params },
  );
  return res.data as { success: boolean; count: number; orders: Order[] };
}

export async function fetchDriverWorkloads(): Promise<DriverWorkload[]> {
  const res = await api.get(`/api/orders/driver-workloads`);
  return Array.isArray(res.data) ? res.data : (res.data?.workloads ?? []);
}
