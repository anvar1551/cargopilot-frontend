import { api } from "@/lib/api";
import type { ServiceType } from "@/lib/orders/service-types";

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

export type ManagerAnalyticsSummary = {
  period: {
    rangeDays: number;
    staleHours: number;
    from: string;
    to: string;
  };
  overview: {
    totalOrders: number;
    createdInRange: number;
    openOrders: number;
    deliveredInRange: number;
    returnedInRange: number;
    exceptionOpenOrders: number;
  };
  operations: {
    pendingOrders: number;
    atWarehouseOrders: number;
    inTransitOrders: number;
    outForDeliveryOrders: number;
    staleOpenOrders: number;
    locationThroughput: {
      warehouse: {
        activeOrders: number;
        atWarehouseOrders: number;
        outForDeliveryOrders: number;
        deliveredInRange: number;
      };
      pickupPoint: {
        activeOrders: number;
        atWarehouseOrders: number;
        outForDeliveryOrders: number;
        deliveredInRange: number;
      };
    };
  };
  sla: {
    overdueOpenOrders: number;
    dueTodayOpenOrders: number;
    dueSoonOpenOrders?: number;
    promiseBackedOrders: number;
  };
  slaPolicy?: {
    staleHours: number;
    dueSoonHours: number;
    overdueGraceHours: number;
    staleHoursApplied: number;
  };
  finance: {
    invoicedPaidAmount: number;
    pendingInvoicesCount: number;
    serviceChargeExpected: number;
    codExpected: number;
    unpaidServiceCount: number;
    unpaidCodCount: number;
    uncollectedExpectedAmount: number;
    driverHeldAmount: number;
    warehouseHeldAmount: number;
    pickupPointHeldAmount: number;
    settledAmount: number;
    holders: Array<{
      holderType: string;
      holderId: string | null;
      holderLabel: string;
      collectionCount: number;
      totalAmount: number;
    }>;
    queue: Array<{
      id: string;
      orderId: string;
      orderNumber: string | null;
      orderStatus: string;
      kind: string;
      status: string;
      holderType: string;
      holderLabel: string | null;
      amount: number;
      currency: string | null;
      ageHours: number;
      updatedAt: string;
    }>;
    queueMeta: {
      page: number;
      pageSize: number;
      total: number;
      pageCount: number;
      hasPrev: boolean;
      hasNext: boolean;
    };
  };
  breakdowns: {
    status: Array<{ status: string; count: number }>;
    serviceType: Array<{ serviceType: ServiceType; count: number }>;
  };
  trend: {
    created: Array<{ date: string; count: number }>;
    delivered: Array<{ date: string; count: number }>;
  };
};

export async function fetchManagerAnalyticsSummary(params?: {
  rangeDays?: number;
  staleHours?: number;
  queueLimit?: number;
  queuePage?: number;
  queuePageSize?: number;
  queueFrom?: string;
  queueTo?: string;
  queueStatuses?: string[];
  queueKinds?: string[];
  queueHolderTypes?: string[];
}): Promise<ManagerAnalyticsSummary> {
  const res = await api.get("/api/manager/analytics/summary", {
    params: {
      ...params,
      queueStatuses: params?.queueStatuses?.length
        ? params.queueStatuses.join(",")
        : undefined,
      queueKinds: params?.queueKinds?.length
        ? params.queueKinds.join(",")
        : undefined,
      queueHolderTypes: params?.queueHolderTypes?.length
        ? params.queueHolderTypes.join(",")
        : undefined,
    },
  });
  return res.data;
}

export async function fetchDrivers(): Promise<DriverLite[]> {
  const res = await api.get("/api/manager/drivers");
  return Array.isArray(res.data) ? res.data : res.data?.drivers ?? [];
}

export async function fetchWarehouses() {
  const res = await api.get("/api/warehouses");
  return Array.isArray(res.data) ? res.data : res.data?.warehouses ?? [];
}
