import { api } from "@/lib/api";
import { subscribeAuthenticatedSse } from "@/lib/sse";
import { fetchOrders, type Order } from "./orders";

export type DriverLite = {
  id: string;
  name: string;
  email: string;
  warehouseId: string | null;
  warehouseIds?: string[];
  driverType?: "local" | "linehaul";
};

export async function fetchManagerOverview() {
  const res = await api.get("/api/dashboard/overview");
  return res.data;
}

export type ManagerAnalyticsV2Summary = {
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
  };
  sla: {
    overdueOpenOrders: number;
    dueSoonOpenOrders: number;
    dueTodayOpenOrders: number;
  };
  finance: {
    invoicedPaidAmount: number;
    pendingInvoicesCount: number;
    serviceChargeExpected: number;
    codExpected: number;
    unpaidServiceCount: number;
    unpaidCodCount: number;
  };
  generatedAt: string;
  isPartial?: boolean;
  isStale?: boolean;
};

export type ManagerAnalyticsV2Trend = {
  period: {
    rangeDays: number;
    from: string;
    to: string;
  };
  trend: {
    created: Array<{ date: string; count: number }>;
    delivered: Array<{ date: string; count: number }>;
  };
  generatedAt: string;
  isPartial?: boolean;
  isStale?: boolean;
};

export type ManagerAnalyticsV2Warnings = {
  overdueTotal: number;
  staleTotal: number;
  financeExposureTotal: number;
  overdueOrders: Array<{
    id: string;
    orderNumber: string | null;
    status: string;
    expectedDeliveryAt: string | null;
    updatedAt: string;
  }>;
  staleOrders: Array<{
    id: string;
    orderNumber: string | null;
    status: string;
    expectedDeliveryAt: string | null;
    updatedAt: string;
  }>;
  financeExposureOrders: Array<{
    id: string;
    orderNumber: string | null;
    status: string;
    codDue: number;
    serviceChargeDue: number;
    updatedAt: string;
  }>;
  generatedAt?: string;
  isPartial?: boolean;
  isStale?: boolean;
};

export type ManagerAnalyticsV2FinanceQueue = {
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
  generatedAt?: string;
  isPartial?: boolean;
  isStale?: boolean;
};

export type ManagerOpsMetrics = {
  generatedAt: string;
  analytics: {
    summary: {
      total: number;
      hits: number;
      misses: number;
      errors: number;
      hitRatio: number;
      p50Ms: number;
      p95Ms: number;
    };
    trend: {
      total: number;
      hits: number;
      misses: number;
      errors: number;
      hitRatio: number;
      p50Ms: number;
      p95Ms: number;
    };
    warnings: {
      total: number;
      hits: number;
      misses: number;
      errors: number;
      hitRatio: number;
      p50Ms: number;
      p95Ms: number;
    };
    financeQueue: {
      total: number;
      hits: number;
      misses: number;
      errors: number;
      hitRatio: number;
      p50Ms: number;
      p95Ms: number;
    };
    totals: {
      total: number;
      hits: number;
      misses: number;
      errors: number;
      cacheHitRatio: number;
    };
  };
  sse: {
    analytics: {
      active: number;
      totalConnects: number;
      totalDisconnects: number;
      reconnectSpikes: number;
    };
    liveMap: {
      active: number;
      totalConnects: number;
      totalDisconnects: number;
      reconnectSpikes: number;
    };
  };
  worker: {
    eventsConsumed: number;
    rebuildCount: number;
    errorCount: number;
    lastEventAt: string | null;
    lastLagMs: number;
    lastHeartbeatAt: string | null;
    lagAlert: boolean;
  };
  alerts: {
    cacheHitBelowThreshold: boolean;
    summaryP95Slow: boolean;
    trendP95Slow: boolean;
    warningsP95Slow: boolean;
    financeQueueP95Slow: boolean;
    workerLagHigh: boolean;
    analyticsReconnectSpike: boolean;
    liveMapReconnectSpike: boolean;
  };
  redis?: {
    enabled: boolean;
    sharedClientStatus: string;
    cooldownActive: boolean;
    cooldownRemainingMs: number;
    lastUnavailableReason: string | null;
    stats: {
      connectAttempts: number;
      connectFailures: number;
      cooldownHits: number;
      operationTimeouts: number;
      notReadyErrors: number;
      recycledClients: number;
    };
  };
};

export async function fetchManagerAnalyticsSummaryV2(params?: {
  rangeDays?: number;
  staleHours?: number;
}): Promise<ManagerAnalyticsV2Summary> {
  const safeParams: Record<string, number> = {};
  if (Number.isFinite(params?.rangeDays)) safeParams.rangeDays = Number(params?.rangeDays);
  if (Number.isFinite(params?.staleHours)) safeParams.staleHours = Number(params?.staleHours);
  const res = await api.get("/api/analytics/summary", { params: safeParams });
  const raw = (res.data ?? {}) as Partial<ManagerAnalyticsV2Summary>;
  return {
    period: {
      rangeDays: Number(raw.period?.rangeDays ?? params?.rangeDays ?? 30),
      staleHours: Number(raw.period?.staleHours ?? params?.staleHours ?? 48),
      from: String(raw.period?.from ?? ""),
      to: String(raw.period?.to ?? ""),
    },
    overview: {
      totalOrders: Number(raw.overview?.totalOrders ?? 0),
      createdInRange: Number(raw.overview?.createdInRange ?? 0),
      openOrders: Number(raw.overview?.openOrders ?? 0),
      deliveredInRange: Number(raw.overview?.deliveredInRange ?? 0),
      returnedInRange: Number(raw.overview?.returnedInRange ?? 0),
      exceptionOpenOrders: Number(raw.overview?.exceptionOpenOrders ?? 0),
    },
    operations: {
      pendingOrders: Number(raw.operations?.pendingOrders ?? 0),
      atWarehouseOrders: Number(raw.operations?.atWarehouseOrders ?? 0),
      inTransitOrders: Number(raw.operations?.inTransitOrders ?? 0),
      outForDeliveryOrders: Number(raw.operations?.outForDeliveryOrders ?? 0),
      staleOpenOrders: Number(raw.operations?.staleOpenOrders ?? 0),
    },
    sla: {
      overdueOpenOrders: Number(raw.sla?.overdueOpenOrders ?? 0),
      dueSoonOpenOrders: Number(raw.sla?.dueSoonOpenOrders ?? 0),
      dueTodayOpenOrders: Number(raw.sla?.dueTodayOpenOrders ?? 0),
    },
    finance: {
      invoicedPaidAmount: Number(raw.finance?.invoicedPaidAmount ?? 0),
      pendingInvoicesCount: Number(raw.finance?.pendingInvoicesCount ?? 0),
      serviceChargeExpected: Number(raw.finance?.serviceChargeExpected ?? 0),
      codExpected: Number(raw.finance?.codExpected ?? 0),
      unpaidServiceCount: Number(raw.finance?.unpaidServiceCount ?? 0),
      unpaidCodCount: Number(raw.finance?.unpaidCodCount ?? 0),
    },
    generatedAt: String(raw.generatedAt ?? new Date().toISOString()),
    isPartial: Boolean(raw.isPartial),
    isStale: Boolean(raw.isStale),
  };
}

export async function fetchManagerAnalyticsTrendV2(params?: {
  rangeDays?: number;
}): Promise<ManagerAnalyticsV2Trend> {
  const safeParams: Record<string, number> = {};
  if (Number.isFinite(params?.rangeDays)) safeParams.rangeDays = Number(params?.rangeDays);
  const res = await api.get("/api/analytics/trend", { params: safeParams });
  const raw = (res.data ?? {}) as Partial<ManagerAnalyticsV2Trend>;
  return {
    period: {
      rangeDays: Number(raw.period?.rangeDays ?? params?.rangeDays ?? 30),
      from: String(raw.period?.from ?? ""),
      to: String(raw.period?.to ?? ""),
    },
    trend: {
      created: Array.isArray(raw.trend?.created) ? raw.trend!.created : [],
      delivered: Array.isArray(raw.trend?.delivered) ? raw.trend!.delivered : [],
    },
    generatedAt: String(raw.generatedAt ?? new Date().toISOString()),
    isPartial: Boolean(raw.isPartial),
    isStale: Boolean(raw.isStale),
  };
}

export async function fetchManagerAnalyticsWarningsV2(params?: {
  rangeDays?: number;
  staleHours?: number;
}): Promise<ManagerAnalyticsV2Warnings> {
  const safeParams: Record<string, number> = {};
  if (Number.isFinite(params?.rangeDays)) safeParams.rangeDays = Number(params?.rangeDays);
  if (Number.isFinite(params?.staleHours)) safeParams.staleHours = Number(params?.staleHours);
  const res = await api.get("/api/analytics/warnings", { params: safeParams });
  const raw = (res.data ?? {}) as Partial<ManagerAnalyticsV2Warnings>;
  return {
    overdueTotal: Number(raw.overdueTotal ?? 0),
    staleTotal: Number(raw.staleTotal ?? 0),
    financeExposureTotal: Number(raw.financeExposureTotal ?? 0),
    overdueOrders: Array.isArray(raw.overdueOrders) ? raw.overdueOrders : [],
    staleOrders: Array.isArray(raw.staleOrders) ? raw.staleOrders : [],
    financeExposureOrders: Array.isArray(raw.financeExposureOrders) ? raw.financeExposureOrders : [],
    generatedAt: String(raw.generatedAt ?? new Date().toISOString()),
    isPartial: Boolean(raw.isPartial),
    isStale: Boolean(raw.isStale),
  };
}

export async function fetchManagerAnalyticsFinanceQueueV2(params?: {
  queuePage?: number;
  queuePageSize?: number;
  queueFrom?: string;
  queueTo?: string;
  queueStatuses?: string[];
  queueKinds?: string[];
  queueHolderTypes?: string[];
}): Promise<ManagerAnalyticsV2FinanceQueue> {
  const res = await api.get("/api/analytics/finance-queue", {
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
  const raw = (res.data ?? {}) as Partial<ManagerAnalyticsV2FinanceQueue>;
  const page = Number(raw.queueMeta?.page ?? params?.queuePage ?? 1);
  const pageSize = Number(raw.queueMeta?.pageSize ?? params?.queuePageSize ?? 20);
  const total = Number(raw.queueMeta?.total ?? 0);
  const pageCount = Number(raw.queueMeta?.pageCount ?? Math.max(1, Math.ceil(total / Math.max(1, pageSize))));

  return {
    queue: Array.isArray(raw.queue) ? raw.queue : [],
    queueMeta: {
      page,
      pageSize,
      total,
      pageCount,
      hasPrev: Boolean(raw.queueMeta?.hasPrev ?? page > 1),
      hasNext: Boolean(raw.queueMeta?.hasNext ?? page < pageCount),
    },
    generatedAt: String(raw.generatedAt ?? new Date().toISOString()),
    isPartial: Boolean(raw.isPartial),
    isStale: Boolean(raw.isStale),
  };
}

export async function invalidateManagerAnalyticsV2() {
  const res = await api.post("/api/analytics/refresh");
  return res.data as { ok: boolean };
}

export async function fetchManagerOpsMetrics(): Promise<ManagerOpsMetrics> {
  const res = await api.get("/api/dashboard/ops/metrics");
  return (res.data ?? {}) as ManagerOpsMetrics;
}

export async function fetchDrivers(): Promise<DriverLite[]> {
  const res = await api.get("/api/dashboard/drivers");
  return Array.isArray(res.data) ? res.data : res.data?.drivers ?? [];
}

export async function fetchWarehouses() {
  const res = await api.get("/api/warehouses");
  return Array.isArray(res.data) ? res.data : res.data?.warehouses ?? [];
}

export type LiveMapDriverStatus = "online" | "idle" | "stale" | "offline";

export type ManagerLiveMapDriver = DriverLite & {
  warehouseIds: string[];
  driverType: "local" | "linehaul";
  liveEnabled: boolean;
  lat: number;
  lng: number;
  headingDeg: number;
  speedKmh: number;
  lastSeenAt: string;
  status: LiveMapDriverStatus;
  region: string | null;
  activeOrderId: string | null;
  seed: number;
};

export type ManagerLiveMapOrder = {
  id: string;
  orderNumber: string | number | null;
  status: string | null;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  assignedDriverId: string | null;
  warehouseId: string | null;
  region: string | null;
};

export type ManagerLiveMapWarehouse = {
  id: string;
  name: string;
  location: string | null;
  region: string | null;
  type?: string | null;
  lat: number | null;
  lng: number | null;
};

export type ManagerLiveMapSnapshot = {
  generatedAt: string;
  drivers: ManagerLiveMapDriver[];
  orders: ManagerLiveMapOrder[];
  warehouses: ManagerLiveMapWarehouse[];
  isMock: boolean;
  isPartial?: boolean;
  isStale?: boolean;
};

export type LiveMapViewport = {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
};

export type LiveMapEvent =
  | {
      type: "driver_location_upsert";
      at: string;
      payload: {
        driverId: string;
        warehouseId: string | null;
        lat: number;
        lng: number;
        speedKmh: number;
        headingDeg: number;
        accuracyM: number | null;
        recordedAt: string;
        orderId: string | null;
        status?: LiveMapDriverStatus;
        liveEnabled?: boolean;
        heartbeatAt?: string | null;
        seq?: number;
      };
    }
  | {
      type: "driver_presence_update";
      at: string;
      payload: {
        driverId: string;
        enabled: boolean;
        heartbeatAt: string | null;
        updatedAt: string;
      };
    }
  | {
      type: "driver_presence_heartbeat";
      at: string;
      payload: {
        driverId: string;
        heartbeatAt: string;
      };
    };

export function subscribeManagerAnalyticsStream(args: {
  onReady?: (payload: { connectedAt?: string }) => void;
  onRefresh: (payload: {
    at?: string;
    reason?: string;
    scope?: string;
    keys?: Array<"summary" | "trend" | "warnings" | "finance-queue">;
    source?: string;
  }) => void;
  onError?: (error: Error) => void;
}) {
  return subscribeAuthenticatedSse({
    path: "/api/analytics/stream",
    lastEventIdKey: "cp:sse:manager-analytics:last-id",
    onReady: (payload) => args.onReady?.((payload ?? {}) as { connectedAt?: string }),
    onEvent: (frame) => {
      if (frame.event !== "analytics-refresh") return;
      try {
        args.onRefresh(
          frame.data
            ? (JSON.parse(frame.data) as {
                at?: string;
                reason?: string;
                scope?: string;
                keys?: Array<"summary" | "trend" | "warnings" | "finance-queue">;
                source?: string;
              })
            : {},
        );
      } catch {
        args.onRefresh({});
      }
    },
    onError: args.onError,
  });
}

export function deriveLiveMapDriverStatus(
  recordedAtIso: string | null | undefined,
  liveEnabled = true,
): LiveMapDriverStatus {
  if (!liveEnabled) return "offline";
  if (!recordedAtIso) return "offline";
  const ts = new Date(recordedAtIso).getTime();
  if (!Number.isFinite(ts)) return "offline";

  const ageSec = (Date.now() - ts) / 1000;
  if (ageSec <= 70) return "online";
  if (ageSec <= 180) return "idle";
  if (ageSec <= 600) return "stale";
  return "offline";
}

export function subscribeManagerLiveMapStream(args: {
  onReady?: (payload: { connectedAt?: string }) => void;
  onEvent: (event: LiveMapEvent) => void;
  onError?: (error: Error) => void;
  viewport?: LiveMapViewport | null;
}) {
  const path = (() => {
    if (!args.viewport) return "/api/live-map/stream";
    const params = new URLSearchParams({
      minLat: String(args.viewport.minLat),
      minLng: String(args.viewport.minLng),
      maxLat: String(args.viewport.maxLat),
      maxLng: String(args.viewport.maxLng),
    });
    return `/api/live-map/stream?${params.toString()}`;
  })();
  return subscribeAuthenticatedSse({
    path,
    lastEventIdKey: "cp:sse:manager-live-map:last-id",
    onReady: (payload) => args.onReady?.((payload ?? {}) as { connectedAt?: string }),
    onEvent: (frame) => {
      if (frame.event !== "live-map" || !frame.data) return;
      try {
        args.onEvent(JSON.parse(frame.data) as LiveMapEvent);
      } catch (error) {
        args.onError?.(
          error instanceof Error ? error : new Error("Failed to parse live-map event"),
        );
      }
    },
    onError: args.onError,
  });
}

const LIVE_MAP_DEFAULT_CENTER = {
  lat: 41.2995,
  lng: 69.2401,
};

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function inLatRange(value: number | null) {
  return value != null && value >= -90 && value <= 90;
}

function inLngRange(value: number | null) {
  return value != null && value >= -180 && value <= 180;
}

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getAssignedDriverId(order: Order): string | null {
  const direct = (order as { assignedDriverId?: unknown }).assignedDriverId;
  if (typeof direct === "string" && direct.trim()) return direct;

  const nested = (order as { assignedDriver?: { id?: unknown } | null }).assignedDriver?.id;
  if (typeof nested === "string" && nested.trim()) return nested;
  return null;
}

function mapOrderForLiveMap(order: Order): ManagerLiveMapOrder {
  const pickupLat = toNumber(order.pickupLat);
  const pickupLng = toNumber(order.pickupLng);
  const dropoffLat = toNumber(order.dropoffLat);
  const dropoffLng = toNumber(order.dropoffLng);
  const warehouseId =
    (order.currentWarehouse as { id?: unknown } | null | undefined)?.id;
  const region =
    (order.currentWarehouse as { region?: unknown } | null | undefined)?.region;

  return {
    id: order.id,
    orderNumber: order.orderNumber ?? null,
    status: typeof order.status === "string" ? order.status : null,
    pickupLat: inLatRange(pickupLat) ? pickupLat : null,
    pickupLng: inLngRange(pickupLng) ? pickupLng : null,
    dropoffLat: inLatRange(dropoffLat) ? dropoffLat : null,
    dropoffLng: inLngRange(dropoffLng) ? dropoffLng : null,
    assignedDriverId: getAssignedDriverId(order),
    warehouseId: typeof warehouseId === "string" && warehouseId.trim() ? warehouseId : null,
    region: typeof region === "string" && region.trim() ? region : null,
  };
}

function deriveMockDriverState(args: {
  driver: DriverLite;
  index: number;
  orders: ManagerLiveMapOrder[];
  orderCoords: Array<{ lat: number; lng: number; orderId: string }>;
  warehouseRegionById: Map<string, string | null>;
  now: number;
}): ManagerLiveMapDriver {
  const { driver, index, orders, orderCoords, warehouseRegionById, now } = args;
  const seed = hashString(driver.id || `${driver.email}:${index}`);

  const assignedOrder = orders.find((order) => order.assignedDriverId === driver.id) ?? null;
  const assignedCoord =
    assignedOrder && inLatRange(assignedOrder.dropoffLat) && inLngRange(assignedOrder.dropoffLng)
      ? { lat: assignedOrder.dropoffLat as number, lng: assignedOrder.dropoffLng as number }
      : assignedOrder && inLatRange(assignedOrder.pickupLat) && inLngRange(assignedOrder.pickupLng)
        ? { lat: assignedOrder.pickupLat as number, lng: assignedOrder.pickupLng as number }
        : null;

  const fallbackCoord =
    orderCoords.length > 0 ? orderCoords[seed % orderCoords.length] : null;

  const anchor =
    assignedCoord ??
    (fallbackCoord ? { lat: fallbackCoord.lat, lng: fallbackCoord.lng } : LIVE_MAP_DEFAULT_CENTER);

  const timeFactor = now / 1000;
  const phase = timeFactor / 18 + (seed % 360) * (Math.PI / 180);
  const driftLat = Math.sin(phase) * 0.002 + Math.cos(phase * 0.45) * 0.0006;
  const driftLng = Math.cos(phase) * 0.002 + Math.sin(phase * 0.45) * 0.0006;
  const lat = anchor.lat + driftLat;
  const lng = anchor.lng + driftLng;

  const bucket = seed % 100;
  const lagSec =
    bucket < 68
      ? 8 + (seed % 38)
      : bucket < 84
        ? 45 + (seed % 95)
        : bucket < 94
          ? 160 + (seed % 210)
          : 480 + (seed % 900);

  const status: LiveMapDriverStatus =
    lagSec > 360 ? "offline" : lagSec > 150 ? "stale" : bucket < 80 ? "online" : "idle";
  const speedKmh =
    status === "online" ? 18 + (seed % 52) : status === "idle" ? 3 + (seed % 7) : 0;
  const headingDeg = Math.round((((phase * 180) / Math.PI) % 360 + 360) % 360);

  return {
    ...driver,
    warehouseIds: Array.from(
      new Set(
        [
          driver.warehouseId ?? null,
          ...(Array.isArray(driver.warehouseIds) ? driver.warehouseIds : []),
        ].filter((value): value is string => Boolean(value)),
      ),
    ),
    driverType: driver.driverType === "linehaul" ? "linehaul" : "local",
    liveEnabled: true,
    lat,
    lng,
    headingDeg,
    speedKmh,
    lastSeenAt: new Date(now - lagSec * 1000).toISOString(),
    status,
    region: driver.warehouseId ? (warehouseRegionById.get(driver.warehouseId) ?? null) : null,
    activeOrderId: assignedOrder?.id ?? null,
    seed,
  };
}

export async function updateDriverProfile(
  driverId: string,
  payload: {
    primaryWarehouseId?: string | null;
    warehouseIds?: string[];
    driverType?: "local" | "linehaul";
  },
) {
  const res = await api.put(`/api/drivers/${driverId}`, payload);
  return res.data as DriverLite & {
    warehouseIds: string[];
    driverType: "local" | "linehaul";
  };
}

export async function fetchManagerLiveMapSnapshot(
  viewport?: LiveMapViewport | null,
): Promise<ManagerLiveMapSnapshot> {
  const allowMockFallback =
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_LIVE_MAP_ALLOW_MOCK === "true";

  try {
    const res = await api.get("/api/live-map/snapshot", {
      params: viewport
        ? {
            minLat: viewport.minLat.toFixed(4),
            minLng: viewport.minLng.toFixed(4),
            maxLat: viewport.maxLat.toFixed(4),
            maxLng: viewport.maxLng.toFixed(4),
          }
        : undefined,
    });
    const payload = res.data as Partial<ManagerLiveMapSnapshot> | null | undefined;
    if (
      payload &&
      typeof payload === "object" &&
      Array.isArray(payload.drivers) &&
      Array.isArray(payload.orders) &&
      Array.isArray(payload.warehouses) &&
      typeof payload.generatedAt === "string"
    ) {
      return {
        generatedAt: payload.generatedAt,
        drivers: payload.drivers.map((driver) => ({
          ...driver,
          warehouseIds: Array.isArray(driver.warehouseIds) ? driver.warehouseIds : [],
          liveEnabled: driver.liveEnabled !== false,
        })),
        orders: payload.orders,
        warehouses: payload.warehouses,
        isMock: Boolean(payload.isMock),
        isPartial: Boolean(payload.isPartial),
        isStale: Boolean(payload.isStale),
      };
    }
  } catch (error) {
    // In production we do not fallback to legacy multi-query mock mode because it creates
    // extra DB load and slower page startup. Keep fallback only for local/dev usage.
    if (!allowMockFallback) {
      throw error;
    }
  }

  const now = Date.now();

  const [drivers, ordersResponse, warehousesRaw] = await Promise.all([
    fetchDrivers(),
    fetchOrders({
      mode: "cursor",
      scope: "fast",
      limit: 260,
    }),
    fetchWarehouses(),
  ]);

  const orders = (ordersResponse?.orders ?? []).map(mapOrderForLiveMap);
  const warehouseCoordSeed = new Map<string, { latSum: number; lngSum: number; count: number }>();
  for (const order of orders) {
    if (!order.warehouseId) continue;
    const coord =
      inLatRange(order.pickupLat) && inLngRange(order.pickupLng)
        ? { lat: order.pickupLat as number, lng: order.pickupLng as number }
        : inLatRange(order.dropoffLat) && inLngRange(order.dropoffLng)
          ? { lat: order.dropoffLat as number, lng: order.dropoffLng as number }
          : null;
    if (!coord) continue;

    const current = warehouseCoordSeed.get(order.warehouseId) ?? { latSum: 0, lngSum: 0, count: 0 };
    current.latSum += coord.lat;
    current.lngSum += coord.lng;
    current.count += 1;
    warehouseCoordSeed.set(order.warehouseId, current);
  }

  const orderCoords: Array<{ lat: number; lng: number; orderId: string }> = [];
  for (const order of orders) {
    if (inLatRange(order.pickupLat) && inLngRange(order.pickupLng)) {
      orderCoords.push({
        lat: order.pickupLat as number,
        lng: order.pickupLng as number,
        orderId: order.id,
      });
    }
    if (inLatRange(order.dropoffLat) && inLngRange(order.dropoffLng)) {
      orderCoords.push({
        lat: order.dropoffLat as number,
        lng: order.dropoffLng as number,
        orderId: order.id,
      });
    }
  }

  const warehouses = (Array.isArray(warehousesRaw) ? warehousesRaw : []).map((warehouse) => ({
    id: String((warehouse as { id?: unknown }).id ?? ""),
    name: String((warehouse as { name?: unknown }).name ?? "Warehouse"),
    location:
      typeof (warehouse as { location?: unknown }).location === "string"
        ? ((warehouse as { location?: string }).location ?? null)
        : null,
    region:
      typeof (warehouse as { region?: unknown }).region === "string"
        ? ((warehouse as { region?: string }).region ?? null)
        : null,
    type:
      typeof (warehouse as { type?: unknown }).type === "string"
        ? ((warehouse as { type?: string }).type ?? null)
        : null,
    lat: (() => {
      const id = String((warehouse as { id?: unknown }).id ?? "");
      const direct =
        toNumber((warehouse as { latitude?: unknown }).latitude) ??
        toNumber((warehouse as { lat?: unknown }).lat) ??
        toNumber((warehouse as { locationLat?: unknown }).locationLat);
      if (inLatRange(direct)) return direct;
      const seed = id ? warehouseCoordSeed.get(id) : null;
      if (seed && seed.count > 0) return seed.latSum / seed.count;
      return null;
    })(),
    lng: (() => {
      const id = String((warehouse as { id?: unknown }).id ?? "");
      const direct =
        toNumber((warehouse as { longitude?: unknown }).longitude) ??
        toNumber((warehouse as { lng?: unknown }).lng) ??
        toNumber((warehouse as { locationLng?: unknown }).locationLng);
      if (inLngRange(direct)) return direct;
      const seed = id ? warehouseCoordSeed.get(id) : null;
      if (seed && seed.count > 0) return seed.lngSum / seed.count;
      return null;
    })(),
  }));
  const warehouseRegionById = new Map<string, string | null>(
    warehouses
      .filter((warehouse) => warehouse.id)
      .map((warehouse) => [warehouse.id, warehouse.region ?? null]),
  );

  const liveDrivers = drivers.map((driver, index) =>
    deriveMockDriverState({
      driver,
      index,
      orders,
      orderCoords,
      warehouseRegionById,
      now,
    }),
  );

  return {
    generatedAt: new Date(now).toISOString(),
    drivers: liveDrivers,
    orders,
    warehouses,
    isMock: true,
  };
}

