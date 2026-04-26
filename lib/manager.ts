import { api } from "@/lib/api";
import { clearAuth, getToken } from "@/lib/auth";
import type { ServiceType } from "@/lib/orders/service-types";
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
    ruleBackedOrders?: number;
    fallbackBackedOrders?: number;
    trackedOpenOrders?: number;
    untrackedOpenOrders?: number;
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
  warnings?: {
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
    driverHeldOrders: Array<{
      orderId: string;
      orderNumber: string | null;
      status: string;
      amount: number;
      currency: string | null;
    }>;
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

function buildApiUrl(path: string) {
  const base = String(api.defaults.baseURL ?? "").trim();
  if (!base) return path;

  const normalizedBase = base.replace(/\/+$/, "");
  if (normalizedBase.endsWith("/api") && path.startsWith("/api/")) {
    return `${normalizedBase}${path.slice(4)}`;
  }
  return `${normalizedBase}${path.startsWith("/") ? path : `/${path}`}`;
}

function parseSseFrame(frameRaw: string) {
  const lines = frameRaw.split(/\r?\n/);
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      event = line.slice(6).trim() || "message";
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  return {
    event,
    data: dataLines.length > 0 ? dataLines.join("\n") : "",
  };
}

function shouldReconnectForStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
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
}) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const token = getToken();
  if (!token) {
    args.onError?.(new Error("Missing auth token for live-map stream"));
    return () => undefined;
  }

  const endpoint = buildApiUrl("/api/manager/live-map/stream");
  const abortController = new AbortController();
  const decoder = new TextDecoder();

  let closed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;

  const clearReconnect = () => {
    if (!reconnectTimer) return;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  };

  const connect = async () => {
    if (closed) return;

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache",
        },
        cache: "no-store",
        signal: abortController.signal,
      });

      if (response.status === 401) {
        clearAuth();
        throw new Error("Unauthorized live-map stream");
      }

      if (!response.ok) {
        const canRetry = shouldReconnectForStatus(response.status);
        throw new Error(canRetry ? `Live-map stream unavailable (${response.status})` : "LIVE_STREAM_NO_RETRY");
      }

      if (!response.body) {
        throw new Error("Live-map stream body is empty");
      }

      attempt = 0;
      let buffer = "";
      const reader = response.body.getReader();

      while (!closed) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let delimiterIndex = buffer.search(/\r?\n\r?\n/);

        while (delimiterIndex >= 0) {
          const frame = buffer.slice(0, delimiterIndex);
          const consumedLength =
            buffer[delimiterIndex] === "\r" && buffer[delimiterIndex + 1] === "\n"
              ? 4
              : 2;
          buffer = buffer.slice(delimiterIndex + consumedLength);

          const parsed = parseSseFrame(frame);
          if (parsed.event === "ready") {
            try {
              args.onReady?.(
                parsed.data ? (JSON.parse(parsed.data) as { connectedAt?: string }) : {},
              );
            } catch {
              args.onReady?.({});
            }
          } else if (parsed.event === "live-map" && parsed.data) {
            try {
              args.onEvent(JSON.parse(parsed.data) as LiveMapEvent);
            } catch (error) {
              args.onError?.(
                error instanceof Error ? error : new Error("Failed to parse live-map event"),
              );
            }
          }

          delimiterIndex = buffer.search(/\r?\n\r?\n/);
        }
      }

      if (!closed) {
        attempt += 1;
        const delay = Math.min(10_000, 800 + attempt * 500);
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          void connect();
        }, delay);
      }
    } catch (error) {
      if (closed) return;

      const err = error instanceof Error ? error : new Error("Live-map stream connection failed");
      if (err.message === "LIVE_STREAM_NO_RETRY") {
        return;
      }

      args.onError?.(err);
      attempt += 1;
      const delay = Math.min(12_000, 900 + attempt * 700);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, delay);
    }
  };

  void connect();

  return () => {
    closed = true;
    clearReconnect();
    abortController.abort();
  };
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

export async function fetchManagerLiveMapSnapshot(): Promise<ManagerLiveMapSnapshot> {
  try {
    const res = await api.get("/api/manager/live-map/snapshot");
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
      };
    }
  } catch {
    // Backend live-map endpoint not available yet. Continue with local mock snapshot fallback.
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
