import { api } from "./api";
import { CreateOrderPayload } from "./validators/order";
import type { ServiceType } from "./orders/service-types";

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

export type CashQueueStatus = "expected" | "held" | "settled";
export type CashQueueKind = "cod" | "service_charge";
export type CashHolderType =
  | "none"
  | "driver"
  | "warehouse"
  | "pickup_point"
  | "finance";

export type CashQueueItem = {
  id: string;
  orderId: string;
  orderNumber: string | number | null;
  orderStatus: string | null;
  orderPickupAddress: string | null;
  orderDropoffAddress: string | null;
  kind: CashQueueKind;
  status: CashQueueStatus;
  expectedAmount: number;
  collectedAmount: number | null;
  amount: number;
  currency: string | null;
  currentHolderType: CashHolderType | null;
  currentHolderLabel: string | null;
  currentHolderUser: {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
  } | null;
  currentHolderWarehouse: {
    id: string;
    name: string;
    type: string;
    location: string | null;
    region: string | null;
  } | null;
  updatedAt: string;
  ageHours: number;
  canCollect: boolean;
  canHandoff: boolean;
  canSettle: boolean;
};

export type CashQueueMeta = {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  hasPrev: boolean;
  hasNext: boolean;
};

export type CashQueueResponse = {
  items: CashQueueItem[];
  meta: CashQueueMeta;
};

export type CashQueueSummary = {
  expectedCount: number;
  expectedAmount: number;
  heldCount: number;
  heldAmount: number;
  settledCount: number;
  settledAmount: number;
  totalCount: number;
  totalAmount: number;
};

export type Order = {
  id: string;
  orderNumber?: string | number | null;
  status?: string | null;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  plannedDeliveryAt?: string | null;
  destinationCity?: string | null;
  serviceType?: ServiceType | null;
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
  senderPhone2?: string | null;
  senderPhone3?: string | null;
  receiverName?: string | null;
  receiverPhone?: string | null;
  receiverPhone2?: string | null;
  receiverPhone3?: string | null;
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
  cashCollections?: Array<{
    id?: string | null;
    kind?: string | null;
    status?: string | null;
    expectedAmount?: number | null;
    collectedAmount?: number | null;
    currency?: string | null;
    currentHolderType?: string | null;
    currentHolderLabel?: string | null;
    collectedAt?: string | null;
    settledAt?: string | null;
    note?: string | null;
    currentHolderUser?: {
      id?: string | null;
      name?: string | null;
      email?: string | null;
    } | null;
    currentHolderWarehouse?: {
      id?: string | null;
      name?: string | null;
      location?: string | null;
      region?: string | null;
    } | null;
    events?: Array<{
      id?: string | null;
      eventType?: string | null;
      amount?: number | null;
      note?: string | null;
      createdAt?: string | null;
    }> | null;
  }> | null;
  [key: string]: unknown;
};

export type OrderProofStage = "pickup" | "delivery";

export type OrderProofAssetLink = {
  id: string;
  key: string;
  fileName: string | null;
  mimeType: string | null;
  size: number | null;
  createdAt: string | null;
  url: string;
};

export type OrderProofBundle = {
  proofId: string;
  stage: OrderProofStage;
  savedAt: string;
  signedBy: string | null;
  photo: OrderProofAssetLink | null;
  signature: OrderProofAssetLink | null;
};

export type OrderProofLinksResponse = {
  success: boolean;
  orderId: string;
  proofs: OrderProofBundle[];
  byStage: Record<OrderProofStage, OrderProofBundle[]>;
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
    serviceType: ServiceType | string;
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

export async function fetchOrderProofLinks(
  orderId: string,
  params?: { stage?: OrderProofStage; limit?: number },
) {
  const res = await api.get(`/api/orders/${orderId}/proofs`, {
    params: {
      stage: params?.stage,
      limit: params?.limit,
    },
  });
  return res.data as OrderProofLinksResponse;
}

export async function collectOrderCash(payload: {
  orderId: string;
  kind: "cod" | "service_charge";
  amount?: number | null;
  note?: string | null;
}) {
  const res = await api.post(`/api/orders/${payload.orderId}/cash/collect`, {
    kind: payload.kind,
    amount: payload.amount ?? null,
    note: payload.note ?? null,
  });
  return res.data as { success: boolean; message: string; order: Order };
}

export async function collectOrderCashBulk(payload: {
  items: Array<{
    orderId: string;
    kind: "cod" | "service_charge";
    amount?: number | null;
    note?: string | null;
  }>;
  note?: string | null;
}) {
  const res = await api.post(`/api/orders/cash/collect-bulk`, {
    items: payload.items,
    note: payload.note ?? null,
  });
  return res.data as {
    success: boolean;
    count: number;
    failedCount: number;
    orders: Order[];
    failed: Array<{ orderId: string; kind: "cod" | "service_charge"; error: string }>;
  };
}

export async function handoffOrderCash(payload: {
  orderId: string;
  kind: "cod" | "service_charge";
  toHolderType: "driver" | "warehouse" | "pickup_point";
  toDriverId?: string | null;
  toWarehouseId?: string | null;
  note?: string | null;
}) {
  const res = await api.post(`/api/orders/${payload.orderId}/cash/handoff`, {
    kind: payload.kind,
    toHolderType: payload.toHolderType,
    toDriverId: payload.toDriverId ?? null,
    toWarehouseId: payload.toWarehouseId ?? null,
    note: payload.note ?? null,
  });
  return res.data as { success: boolean; message: string; order: Order };
}

export async function settleOrderCash(payload: {
  orderId: string;
  kind: "cod" | "service_charge";
  note?: string | null;
}) {
  const res = await api.post(`/api/orders/${payload.orderId}/cash/settle`, {
    kind: payload.kind,
    note: payload.note ?? null,
  });
  return res.data as { success: boolean; message: string; order: Order };
}

export async function handoffOrderCashBulk(payload: {
  items: Array<{ orderId: string; kind: "cod" | "service_charge" }>;
  toHolderType: "driver" | "warehouse" | "pickup_point";
  toDriverId?: string | null;
  toWarehouseId?: string | null;
  note?: string | null;
}) {
  const res = await api.post(`/api/orders/cash/handoff-bulk`, {
    items: payload.items,
    toHolderType: payload.toHolderType,
    toDriverId: payload.toDriverId ?? null,
    toWarehouseId: payload.toWarehouseId ?? null,
    note: payload.note ?? null,
  });
  return res.data as {
    success: boolean;
    count: number;
    failedCount: number;
    orders: Order[];
    failed: Array<{ orderId: string; kind: "cod" | "service_charge"; error: string }>;
  };
}

export async function settleOrderCashBulk(payload: {
  items: Array<{ orderId: string; kind: "cod" | "service_charge" }>;
  note?: string | null;
}) {
  const res = await api.post(`/api/orders/cash/settle-bulk`, {
    items: payload.items,
    note: payload.note ?? null,
  });
  return res.data as {
    success: boolean;
    count: number;
    failedCount: number;
    orders: Order[];
    failed: Array<{ orderId: string; kind: "cod" | "service_charge"; error: string }>;
  };
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

export async function fetchCashQueue(params?: {
  page?: number;
  pageSize?: number;
  statuses?: CashQueueStatus[];
  kinds?: CashQueueKind[];
  from?: string;
  to?: string;
}) {
  const res = await api.get("/api/orders/cash/queue", {
    params: {
      page: params?.page,
      pageSize: params?.pageSize,
      statuses: params?.statuses?.join(",") || undefined,
      kinds: params?.kinds?.join(",") || undefined,
      from: params?.from,
      to: params?.to,
    },
  });
  return res.data as CashQueueResponse;
}

export async function fetchCashQueueSummary(params?: {
  statuses?: CashQueueStatus[];
  kinds?: CashQueueKind[];
  from?: string;
  to?: string;
}) {
  const res = await api.get("/api/orders/cash/queue-summary", {
    params: {
      statuses: params?.statuses?.join(",") || undefined,
      kinds: params?.kinds?.join(",") || undefined,
      from: params?.from,
      to: params?.to,
    },
  });
  return res.data as CashQueueSummary;
}
