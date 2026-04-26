"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Clock3,
  Flame,
  Gauge,
  Loader2,
  LocateFixed,
  Map,
  MapPinned,
  MapPin,
  Navigation,
  RefreshCw,
  Route,
  Search,
  Truck,
  Warehouse,
} from "lucide-react";

import {
  deriveLiveMapDriverStatus,
  fetchManagerLiveMapSnapshot,
  subscribeManagerLiveMapStream,
  type LiveMapDriverStatus,
  type LiveMapEvent,
  type ManagerLiveMapDriver,
  type ManagerLiveMapSnapshot,
} from "@/lib/manager";
import { getMapboxToken } from "@/lib/mapbox";
import { getStatusLabel } from "@/lib/i18n/labels";
import { usePageVisibility } from "@/lib/usePageVisibility";
import { cn } from "@/lib/utils";

import PageShell from "@/components/layout/PageShell";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type MapboxMapLike = {
  on: (event: "load" | "error", handler: (event?: { error?: Error }) => void) => void;
  addSource: (id: string, source: unknown) => void;
  addLayer: (layer: unknown) => void;
  getSource: (id: string) => { setData: (data: unknown) => void } | undefined;
  resize: () => void;
  fitBounds: (
    bounds: [[number, number], [number, number]],
    options?: { padding?: number; duration?: number },
  ) => void;
  flyTo: (options: { center: [number, number]; zoom?: number; duration?: number }) => void;
  remove: () => void;
};

type MapboxLike = {
  accessToken: string;
  Map: new (options: {
    container: HTMLElement;
    style: string;
    center: [number, number];
    zoom: number;
    attributionControl: boolean;
  }) => MapboxMapLike;
};

type DriverFeatureProps = {
  id: string;
  status: LiveMapDriverStatus;
  label: string;
};

type PointFeature<Props extends Record<string, unknown>> = {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: Props;
};

type LineFeature<Props extends Record<string, unknown>> = {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: Array<[number, number]>;
  };
  properties: Props;
};

type FeatureCollection<Feature> = {
  type: "FeatureCollection";
  features: Feature[];
};

const EMPTY_POINTS: FeatureCollection<PointFeature<Record<string, unknown>>> = {
  type: "FeatureCollection",
  features: [],
};
const EMPTY_LINES: FeatureCollection<LineFeature<Record<string, unknown>>> = {
  type: "FeatureCollection",
  features: [],
};

const DEFAULT_CENTER: [number, number] = [69.2401, 41.2995];

let mapboxModulePromise: Promise<MapboxLike> | null = null;
async function loadMapbox(token: string) {
  if (!mapboxModulePromise) {
    mapboxModulePromise = import("mapbox-gl").then((imported) => {
      return (imported.default ?? imported) as unknown as MapboxLike;
    });
  }
  const mapbox = await mapboxModulePromise;
  mapbox.accessToken = token;
  return mapbox;
}

function statusRank(status: LiveMapDriverStatus) {
  if (status === "online") return 3;
  if (status === "idle") return 2;
  if (status === "stale") return 1;
  return 0;
}

function driverLabel(driver: ManagerLiveMapDriver) {
  const name = driver.name?.trim() || driver.email?.trim() || driver.id;
  return name.length > 18 ? `${name.slice(0, 18)}...` : name;
}

function driverDisplay(driver: ManagerLiveMapDriver, tick: number) {
  if (driver.status === "offline") {
    return { ...driver, headingDeg: driver.headingDeg };
  }
  const phase = (tick + driver.seed) / 8;
  const driftLat = Math.sin(phase) * 0.00045;
  const driftLng = Math.cos(phase) * 0.00045;
  return {
    ...driver,
    lat: driver.lat + driftLat,
    lng: driver.lng + driftLng,
    headingDeg: Math.round((driver.headingDeg + tick * 9) % 360),
  };
}

function driverInitials(driver: ManagerLiveMapDriver) {
  const source = (driver.name || driver.email || "D").trim();
  const parts = source.split(/\s+/g).filter(Boolean);
  const joined = (parts[0]?.[0] ?? "D") + (parts[1]?.[0] ?? "");
  return joined.toUpperCase();
}

function statusClass(status: LiveMapDriverStatus) {
  if (status === "online") return "bg-teal-500";
  if (status === "idle") return "bg-indigo-400";
  if (status === "stale") return "bg-amber-400";
  return "bg-slate-400";
}

function statusAccent(status: LiveMapDriverStatus) {
  if (status === "online") {
    return {
      selectedRow: "border-teal-300 bg-gradient-to-r from-cyan-50 via-teal-50 to-sky-50 shadow-sm",
      avatar: "bg-teal-100 text-teal-700",
      panel: "border-teal-200 bg-gradient-to-br from-cyan-50/95 via-teal-50/95 to-sky-50/95",
      badge: "border-teal-300 bg-teal-100 text-teal-800",
    };
  }
  if (status === "idle") {
    return {
      selectedRow: "border-indigo-300 bg-gradient-to-r from-indigo-50 via-blue-50 to-cyan-50 shadow-sm",
      avatar: "bg-indigo-100 text-indigo-700",
      panel: "border-indigo-200 bg-gradient-to-br from-indigo-50/95 via-blue-50/95 to-cyan-50/95",
      badge: "border-indigo-300 bg-indigo-100 text-indigo-800",
    };
  }
  if (status === "stale") {
    return {
      selectedRow: "border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 shadow-sm",
      avatar: "bg-amber-100 text-amber-700",
      panel: "border-amber-200 bg-gradient-to-br from-amber-50/95 via-orange-50/95 to-yellow-50/95",
      badge: "border-amber-300 bg-amber-100 text-amber-800",
    };
  }
  return {
    selectedRow: "border-slate-300 bg-gradient-to-r from-slate-50 via-slate-100 to-zinc-100 shadow-sm",
    avatar: "bg-slate-200 text-slate-700",
    panel: "border-slate-300 bg-gradient-to-br from-slate-50/95 via-slate-100/95 to-zinc-100/95",
    badge: "border-slate-300 bg-slate-100 text-slate-700",
  };
}

function formatLastSeen(value: string) {
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) return "-";
  const diffMs = Date.now() - parsed;
  const diffMinutes = Math.max(0, Math.round(diffMs / 60_000));
  if (diffMinutes < 1) return "now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  return `${diffHours}h ago`;
}

function formatDriverStatus(status: LiveMapDriverStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function boundsFromCoords(coords: Array<[number, number]>) {
  let minLng = coords[0][0];
  let maxLng = coords[0][0];
  let minLat = coords[0][1];
  let maxLat = coords[0][1];

  for (const [lng, lat] of coords) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ] as [[number, number], [number, number]];
}

function isFiniteCoord(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

export default function ManagerLiveMapPage() {
  const { t } = useI18n();
  const token = React.useMemo(() => getMapboxToken(), []);
  const queryClient = useQueryClient();
  const isPageVisible = usePageVisibility();

  const [warehouseFilter, setWarehouseFilter] = React.useState("all");
  const [regionFilter, setRegionFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [showOrders, setShowOrders] = React.useState(true);
  const [showDrivers, setShowDrivers] = React.useState(true);
  const [showRoutes, setShowRoutes] = React.useState(true);
  const [showHeatmap, setShowHeatmap] = React.useState(false);
  const [showWarehouses, setShowWarehouses] = React.useState(true);
  const [driverQuery, setDriverQuery] = React.useState("");
  const [selectedDriverId, setSelectedDriverId] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  const [mapError, setMapError] = React.useState<string | null>(null);
  const [mapContainerEl, setMapContainerEl] = React.useState<HTMLDivElement | null>(null);
  const [mapReadyTick, setMapReadyTick] = React.useState(0);
  const mapRef = React.useRef<MapboxMapLike | null>(null);
  const isMapReadyRef = React.useRef(false);
  const fittedInitiallyRef = React.useRef(false);
  const lastAutoFocusedDriverIdRef = React.useRef<string | null>(null);

  const snapshotQuery = useQuery({
    queryKey: ["manager-live-map-snapshot"],
    queryFn: fetchManagerLiveMapSnapshot,
    refetchInterval: isPageVisible ? 90_000 : false,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  React.useEffect(() => {
    const unsubscribe = subscribeManagerLiveMapStream({
      onEvent: (event: LiveMapEvent) => {
        queryClient.setQueryData<ManagerLiveMapSnapshot>(["manager-live-map-snapshot"], (current) => {
          if (!current) return current;

          if (event.type === "driver_location_upsert") {
            const payload = event.payload;
            if (!isFiniteCoord(payload.lat) || !isFiniteCoord(payload.lng)) return current;

            let changed = false;
            const nextDrivers = current.drivers.map((driver) => {
              if (driver.id !== payload.driverId) return driver;
              changed = true;
              const nextLiveEnabled = payload.liveEnabled ?? driver.liveEnabled ?? true;
              const nextStatus =
                payload.status ??
                deriveLiveMapDriverStatus(payload.heartbeatAt ?? payload.recordedAt, nextLiveEnabled);
              return {
                ...driver,
                liveEnabled: nextLiveEnabled,
                lat: payload.lat,
                lng: payload.lng,
                speedKmh: payload.speedKmh,
                headingDeg: payload.headingDeg,
                lastSeenAt: payload.heartbeatAt ?? payload.recordedAt,
                status: nextStatus,
                warehouseId: payload.warehouseId ?? driver.warehouseId,
                activeOrderId: payload.orderId ?? null,
              };
            });

            if (!changed) return current;
            return {
              ...current,
              generatedAt: event.at,
              isMock: false,
              drivers: nextDrivers,
            };
          }

          if (event.type === "driver_presence_update") {
            const payload = event.payload;
            let changed = false;
            const nextDrivers = current.drivers.map((driver) => {
              if (driver.id !== payload.driverId) return driver;
              changed = true;
              return {
                ...driver,
                liveEnabled: payload.enabled,
                lastSeenAt: payload.heartbeatAt ?? driver.lastSeenAt,
                status: deriveLiveMapDriverStatus(payload.heartbeatAt ?? driver.lastSeenAt, payload.enabled),
              };
            });
            if (!changed) return current;
            return {
              ...current,
              generatedAt: event.at,
              isMock: false,
              drivers: nextDrivers,
            };
          }

          if (event.type === "driver_presence_heartbeat") {
            const payload = event.payload;
            let changed = false;
            const nextDrivers = current.drivers.map((driver) => {
              if (driver.id !== payload.driverId) return driver;
              changed = true;
              const nextLiveEnabled = driver.liveEnabled ?? true;
              return {
                ...driver,
                lastSeenAt: payload.heartbeatAt,
                status: deriveLiveMapDriverStatus(payload.heartbeatAt, nextLiveEnabled),
              };
            });
            if (!changed) return current;
            return {
              ...current,
              generatedAt: event.at,
              isMock: false,
              drivers: nextDrivers,
            };
          }

          return current;
        });
      },
    });

    return unsubscribe;
  }, [queryClient]);

  React.useEffect(() => {
    if (!isPageVisible) return;
    const id = setInterval(() => setTick((value) => value + 1), 1800);
    return () => clearInterval(id);
  }, [isPageVisible]);

  const warehouses = React.useMemo(() => snapshotQuery.data?.warehouses ?? [], [snapshotQuery.data?.warehouses]);
  const regions = React.useMemo(() => {
    const unique = new Set<string>();
    for (const warehouse of warehouses) {
      if (warehouse.region) unique.add(warehouse.region);
    }
    return [...unique].sort((a, b) => a.localeCompare(b));
  }, [warehouses]);
  const orderStatuses = React.useMemo(() => {
    const unique = new Set<string>();
    for (const order of snapshotQuery.data?.orders ?? []) {
      if (order.status) unique.add(order.status);
    }
    return [...unique].sort((a, b) => a.localeCompare(b));
  }, [snapshotQuery.data?.orders]);

  const filteredOrders = React.useMemo(() => {
    const source = snapshotQuery.data?.orders ?? [];
    return source.filter((order) => {
      if (warehouseFilter !== "all" && order.warehouseId !== warehouseFilter) return false;
      if (regionFilter !== "all" && order.region !== regionFilter) return false;
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      return true;
    });
  }, [regionFilter, snapshotQuery.data?.orders, statusFilter, warehouseFilter]);

  const filteredDrivers = React.useMemo(() => {
    const source = snapshotQuery.data?.drivers ?? [];
    return source
      .filter((driver) => {
        if (warehouseFilter !== "all") {
          if (driver.driverType !== "linehaul") {
            const attachedWarehouses = new Set([
              driver.warehouseId,
              ...(Array.isArray(driver.warehouseIds) ? driver.warehouseIds : []),
            ]);
            if (!attachedWarehouses.has(warehouseFilter)) return false;
          }
        }
        if (regionFilter !== "all" && driver.region !== regionFilter) return false;
        return true;
      })
      .map((driver) => driverDisplay(driver, tick))
      .sort((a, b) => statusRank(b.status) - statusRank(a.status));
  }, [regionFilter, snapshotQuery.data?.drivers, tick, warehouseFilter]);

  const visibleDrivers = React.useMemo(() => {
    const q = driverQuery.trim().toLowerCase();
    if (!q) return filteredDrivers;
    return filteredDrivers.filter((driver) => {
      const haystack = `${driver.name ?? ""} ${driver.email ?? ""} ${driver.id}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [driverQuery, filteredDrivers]);

  React.useEffect(() => {
    if (visibleDrivers.length === 0) {
      setSelectedDriverId(null);
      return;
    }
    if (!selectedDriverId) {
      setSelectedDriverId(visibleDrivers[0].id);
      return;
    }
    if (!visibleDrivers.some((driver) => driver.id === selectedDriverId)) {
      setSelectedDriverId(visibleDrivers[0].id);
    }
  }, [selectedDriverId, visibleDrivers]);

  const selectedDriver = React.useMemo(
    () => visibleDrivers.find((driver) => driver.id === selectedDriverId) ?? null,
    [selectedDriverId, visibleDrivers],
  );

  const driverFeatures = React.useMemo<FeatureCollection<PointFeature<DriverFeatureProps>>>(() => {
    return {
      type: "FeatureCollection",
      features: filteredDrivers.map((driver) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [driver.lng, driver.lat],
        },
        properties: {
          id: driver.id,
          status: driver.status,
          label: driverLabel(driver),
        },
      })),
    };
  }, [filteredDrivers]);

  const selectedDriverFeature = React.useMemo<FeatureCollection<PointFeature<Record<string, unknown>>>>(() => {
    if (!selectedDriver) return EMPTY_POINTS;
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [selectedDriver.lng, selectedDriver.lat],
          },
          properties: {
            id: selectedDriver.id,
            status: selectedDriver.status,
            label: driverLabel(selectedDriver),
          },
        },
      ],
    };
  }, [selectedDriver]);

  const pickupFeatures = React.useMemo<FeatureCollection<PointFeature<Record<string, unknown>>>>(() => {
    return {
      type: "FeatureCollection",
      features: filteredOrders
        .filter((order) => order.pickupLat != null && order.pickupLng != null)
        .map((order) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [order.pickupLng as number, order.pickupLat as number],
          },
          properties: {
            orderId: order.id,
            kind: "pickup",
            status: order.status ?? "unknown",
          },
        })),
    };
  }, [filteredOrders]);

  const dropoffFeatures = React.useMemo<FeatureCollection<PointFeature<Record<string, unknown>>>>(() => {
    return {
      type: "FeatureCollection",
      features: filteredOrders
        .filter((order) => order.dropoffLat != null && order.dropoffLng != null)
        .map((order) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [order.dropoffLng as number, order.dropoffLat as number],
          },
          properties: {
            orderId: order.id,
            kind: "dropoff",
            status: order.status ?? "unknown",
          },
        })),
    };
  }, [filteredOrders]);

  const routeFeatures = React.useMemo<FeatureCollection<LineFeature<Record<string, unknown>>>>(() => {
    return {
      type: "FeatureCollection",
      features: filteredOrders
        .filter(
          (order) =>
            order.pickupLat != null &&
            order.pickupLng != null &&
            order.dropoffLat != null &&
            order.dropoffLng != null,
        )
        .map((order) => ({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [
              [order.pickupLng as number, order.pickupLat as number],
              [order.dropoffLng as number, order.dropoffLat as number],
            ],
          },
          properties: {
            orderId: order.id,
          },
        })),
    };
  }, [filteredOrders]);

  const heatmapFeatures = React.useMemo<FeatureCollection<PointFeature<Record<string, unknown>>>>(() => {
    return {
      type: "FeatureCollection",
      features: [...pickupFeatures.features, ...dropoffFeatures.features].map((feature) => ({
        ...feature,
        properties: {
          ...(feature.properties ?? {}),
          weight: 1,
        },
      })),
    };
  }, [dropoffFeatures.features, pickupFeatures.features]);

  const warehouseFeatures = React.useMemo<FeatureCollection<PointFeature<Record<string, unknown>>>>(() => {
    return {
      type: "FeatureCollection",
      features: warehouses
        .filter((warehouse) => {
          if (warehouse.lat == null || warehouse.lng == null) return false;
          if (warehouseFilter !== "all" && warehouse.id !== warehouseFilter) return false;
          if (regionFilter !== "all" && warehouse.region !== regionFilter) return false;
          return true;
        })
        .map((warehouse) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [warehouse.lng as number, warehouse.lat as number],
          },
          properties: {
            id: warehouse.id,
            label: warehouse.name,
            region: warehouse.region ?? "",
          },
        })),
    };
  }, [regionFilter, warehouseFilter, warehouses]);

  const allVisibleCoords = React.useMemo(() => {
    const coords: Array<[number, number]> = [];

    if (showDrivers) {
      for (const feature of driverFeatures.features) {
        coords.push(feature.geometry.coordinates);
      }
      for (const feature of selectedDriverFeature.features) {
        coords.push(feature.geometry.coordinates);
      }
    }

    if (showOrders) {
      for (const feature of pickupFeatures.features) {
        coords.push(feature.geometry.coordinates);
      }
      for (const feature of dropoffFeatures.features) {
        coords.push(feature.geometry.coordinates);
      }
    }

    if (showHeatmap) {
      for (const feature of heatmapFeatures.features) {
        coords.push(feature.geometry.coordinates);
      }
    }

    if (showWarehouses) {
      for (const feature of warehouseFeatures.features) {
        coords.push(feature.geometry.coordinates);
      }
    }

    return coords;
  }, [
    driverFeatures.features,
    dropoffFeatures.features,
    heatmapFeatures.features,
    pickupFeatures.features,
    selectedDriverFeature.features,
    showDrivers,
    showHeatmap,
    showOrders,
    showWarehouses,
    warehouseFeatures.features,
  ]);

  const recenterMap = React.useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (allVisibleCoords.length === 0) {
      map.flyTo({ center: DEFAULT_CENTER, zoom: 10, duration: 260 });
      return;
    }

    if (allVisibleCoords.length === 1) {
      map.flyTo({ center: allVisibleCoords[0], zoom: 13, duration: 260 });
      return;
    }

    map.fitBounds(boundsFromCoords(allVisibleCoords), { padding: 86, duration: 260 });
  }, [allVisibleCoords]);

  const centerOnSelectedDriver = React.useCallback(() => {
    if (!selectedDriver || !mapRef.current || !isMapReadyRef.current) return;
    mapRef.current.flyTo({ center: [selectedDriver.lng, selectedDriver.lat], zoom: 13.2, duration: 240 });
  }, [selectedDriver]);

  React.useEffect(() => {
    if (!token) {
      setMapError(t("managerLiveMap.mapTokenMissing"));
      return;
    }
    if (!mapContainerEl || mapRef.current) return;

    let disposed = false;

    const init = async () => {
      try {
        const mapbox = await loadMapbox(token);
        if (disposed || !mapContainerEl) return;

        const map = new mapbox.Map({
          container: mapContainerEl,
          style: "mapbox://styles/mapbox/light-v11",
          center: DEFAULT_CENTER,
          zoom: 10,
          attributionControl: true,
        });
        mapRef.current = map;
        isMapReadyRef.current = false;
        setMapError(null);

        map.on("load", () => {
          if (disposed) return;
          isMapReadyRef.current = true;
          setMapReadyTick((value) => value + 1);

          map.addSource("cp-live-heat", { type: "geojson", data: EMPTY_POINTS });
          map.addSource("cp-live-routes", { type: "geojson", data: EMPTY_LINES });
          map.addSource("cp-live-pickups", { type: "geojson", data: EMPTY_POINTS });
          map.addSource("cp-live-dropoffs", { type: "geojson", data: EMPTY_POINTS });
          map.addSource("cp-live-warehouses", { type: "geojson", data: EMPTY_POINTS });
          map.addSource("cp-live-drivers", { type: "geojson", data: EMPTY_POINTS });
          map.addSource("cp-live-driver-selected", { type: "geojson", data: EMPTY_POINTS });

          map.addLayer({
            id: "cp-live-heatmap-layer",
            type: "heatmap",
            source: "cp-live-heat",
            maxzoom: 16,
            paint: {
              "heatmap-weight": ["coalesce", ["get", "weight"], 1],
              "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 0.3, 16, 1.4],
              "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 3, 10, 16, 40],
              "heatmap-opacity": 0.7,
              "heatmap-color": [
                "interpolate",
                ["linear"],
                ["heatmap-density"],
                0,
                "rgba(34,211,238,0)",
                0.2,
                "rgba(34,211,238,0.35)",
                0.45,
                "rgba(56,189,248,0.45)",
                0.7,
                "rgba(99,102,241,0.58)",
                1,
                "rgba(147,51,234,0.72)",
              ],
            },
          });

          map.addLayer({
            id: "cp-live-routes-layer",
            type: "line",
            source: "cp-live-routes",
            paint: {
              "line-color": "#6366f1",
              "line-width": 2.4,
              "line-dasharray": [1.2, 1.2],
              "line-opacity": 0.8,
            },
          });

          map.addLayer({
            id: "cp-live-pickups-layer",
            type: "circle",
            source: "cp-live-pickups",
            paint: {
              "circle-radius": 4.8,
              "circle-color": "#38bdf8",
              "circle-stroke-width": 1.3,
              "circle-stroke-color": "#ffffff",
              "circle-opacity": 0.95,
            },
          });

          map.addLayer({
            id: "cp-live-dropoffs-layer",
            type: "circle",
            source: "cp-live-dropoffs",
            paint: {
              "circle-radius": 4.8,
              "circle-color": "#22c55e",
              "circle-stroke-width": 1.3,
              "circle-stroke-color": "#ffffff",
              "circle-opacity": 0.95,
            },
          });

          map.addLayer({
            id: "cp-live-warehouses-layer",
            type: "circle",
            source: "cp-live-warehouses",
            paint: {
              "circle-radius": 7.2,
              "circle-color": "#fbbf24",
              "circle-stroke-width": 2,
              "circle-stroke-color": "#111827",
              "circle-opacity": 0.9,
            },
          });

          map.addLayer({
            id: "cp-live-warehouse-labels",
            type: "symbol",
            source: "cp-live-warehouses",
            layout: {
              "text-field": ["get", "label"],
              "text-size": 11,
              "text-offset": [0, 1.4],
              "text-anchor": "top",
            },
            paint: {
              "text-color": "#0f172a",
              "text-halo-color": "#ffffff",
              "text-halo-width": 1.1,
            },
          });

          map.addLayer({
            id: "cp-live-drivers-layer",
            type: "circle",
            source: "cp-live-drivers",
            paint: {
              "circle-radius": 7,
              "circle-color": [
                "match",
                ["get", "status"],
                "online",
                "#14b8a6",
                "idle",
                "#818cf8",
                "stale",
                "#f59e0b",
                "#94a3b8",
              ],
              "circle-stroke-width": 1.6,
              "circle-stroke-color": "#ffffff",
              "circle-opacity": 0.95,
            },
          });

          map.addLayer({
            id: "cp-live-driver-selected-ring",
            type: "circle",
            source: "cp-live-driver-selected",
            paint: {
              "circle-radius": 13,
              "circle-color": [
                "match",
                ["get", "status"],
                "online",
                "rgba(20,184,166,0.18)",
                "idle",
                "rgba(129,140,248,0.18)",
                "stale",
                "rgba(245,158,11,0.18)",
                "rgba(148,163,184,0.18)",
              ],
              "circle-stroke-width": 1.8,
              "circle-stroke-color": [
                "match",
                ["get", "status"],
                "online",
                "#0d9488",
                "idle",
                "#6366f1",
                "stale",
                "#f59e0b",
                "#94a3b8",
              ],
            },
          });

          map.addLayer({
            id: "cp-live-driver-labels",
            type: "symbol",
            source: "cp-live-driver-selected",
            layout: {
              "text-field": ["get", "label"],
              "text-size": 12,
              "text-offset": [0, 1.4],
              "text-anchor": "top",
            },
            paint: {
              "text-color": "#111827",
              "text-halo-color": "#ffffff",
              "text-halo-width": 1.1,
            },
          });
        });

        map.on("error", (event) => {
          if (disposed) return;
          const message = event?.error?.message ?? t("managerLiveMap.mapLoadFailed");
          setMapError(message);
        });
      } catch (error) {
        if (disposed) return;
        const message = error instanceof Error ? error.message : t("managerLiveMap.mapLoadFailed");
        setMapError(message);
      }
    };

    void init();

    return () => {
      disposed = true;
      isMapReadyRef.current = false;
      fittedInitiallyRef.current = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapContainerEl, t, token]);

  React.useEffect(() => {
    if (!mapContainerEl || !isMapReadyRef.current || !mapRef.current) return;

    const map = mapRef.current;
    let rafId = 0;
    const queueResize = () => {
      if (typeof window === "undefined") return;
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        map.resize();
      });
    };

    queueResize();

    const onWindowResize = () => queueResize();
    window.addEventListener("resize", onWindowResize);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => queueResize());
      observer.observe(mapContainerEl);
    }

    return () => {
      window.removeEventListener("resize", onWindowResize);
      observer?.disconnect();
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [mapContainerEl, mapReadyTick]);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReadyRef.current) return;

    map.getSource("cp-live-heat")?.setData(showHeatmap ? heatmapFeatures : EMPTY_POINTS);
    map.getSource("cp-live-routes")?.setData(showRoutes ? routeFeatures : EMPTY_LINES);
    map.getSource("cp-live-pickups")?.setData(showOrders ? pickupFeatures : EMPTY_POINTS);
    map.getSource("cp-live-dropoffs")?.setData(showOrders ? dropoffFeatures : EMPTY_POINTS);
    map.getSource("cp-live-warehouses")?.setData(showWarehouses ? warehouseFeatures : EMPTY_POINTS);
    map.getSource("cp-live-drivers")?.setData(showDrivers ? driverFeatures : EMPTY_POINTS);
    map
      .getSource("cp-live-driver-selected")
      ?.setData(showDrivers && selectedDriver ? selectedDriverFeature : EMPTY_POINTS);

    if (!fittedInitiallyRef.current && allVisibleCoords.length) {
      fittedInitiallyRef.current = true;
      recenterMap();
    }
  }, [
    allVisibleCoords.length,
    driverFeatures,
    dropoffFeatures,
    heatmapFeatures,
    pickupFeatures,
    recenterMap,
    routeFeatures,
    selectedDriver,
    selectedDriverFeature,
    showDrivers,
    showHeatmap,
    showOrders,
    showRoutes,
    showWarehouses,
    warehouseFeatures,
  ]);

  React.useEffect(() => {
    if (!mapRef.current || !isMapReadyRef.current || !showDrivers) return;

    if (!selectedDriverId) {
      lastAutoFocusedDriverIdRef.current = null;
      return;
    }

    if (lastAutoFocusedDriverIdRef.current === selectedDriverId) return;

    const target = filteredDrivers.find((driver) => driver.id === selectedDriverId);
    if (!target) return;

    lastAutoFocusedDriverIdRef.current = selectedDriverId;
    mapRef.current.flyTo({ center: [target.lng, target.lat], zoom: 12.2, duration: 260 });
  }, [filteredDrivers, selectedDriverId, showDrivers]);

  const onlineDrivers = filteredDrivers.filter((driver) => driver.status === "online").length;
  const staleDrivers = filteredDrivers.filter((driver) => driver.status === "stale").length;
  const ordersWithCoords = filteredOrders.filter(
    (order) =>
      (order.pickupLat != null && order.pickupLng != null) ||
      (order.dropoffLat != null && order.dropoffLng != null),
  ).length;

  return (
    <PageShell>
      <div className="space-y-4">
        <Card className="border-border/70 bg-gradient-to-r from-cyan-50/70 via-background to-indigo-50/50">
          <CardHeader className="pb-2 pt-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="w-fit">
                    <Map className="mr-1 h-3.5 w-3.5" />
                    {t("managerLiveMap.badge")}
                  </Badge>
                  {snapshotQuery.data?.isMock ? (
                    <Badge variant="outline" className="rounded-full">
                      {t("managerLiveMap.live")}
                    </Badge>
                  ) : null}
                </div>
                <CardTitle className="text-xl leading-tight">{t("managerLiveMap.title")}</CardTitle>
                <CardDescription className="max-w-2xl text-xs">{t("managerLiveMap.subtitle")}</CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => snapshotQuery.refetch()}
                disabled={snapshotQuery.isFetching}
              >
                {snapshotQuery.isFetching ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {t("managerLiveMap.refresh")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid gap-2 lg:grid-cols-[minmax(150px,1fr)_minmax(150px,1fr)_minmax(150px,1fr)_minmax(280px,1.4fr)]">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t("managerLiveMap.controls.warehouse")}</Label>
                <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={t("managerLiveMap.controls.allWarehouses")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("managerLiveMap.controls.allWarehouses")}</SelectItem>
                    {warehouses.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t("managerLiveMap.controls.region")}</Label>
                <Select value={regionFilter} onValueChange={setRegionFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={t("managerLiveMap.controls.allRegions")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("managerLiveMap.controls.allRegions")}</SelectItem>
                    {regions.map((region) => (
                      <SelectItem key={region} value={region}>
                        {region}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t("managerLiveMap.controls.status")}</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={t("managerLiveMap.controls.allStatuses")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("managerLiveMap.controls.allStatuses")}</SelectItem>
                    {orderStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {getStatusLabel(status, t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border/60 px-3 py-2 text-xs">
                <label className="inline-flex items-center gap-2">
                  <Checkbox checked={showDrivers} onCheckedChange={(checked) => setShowDrivers(checked === true)} />
                  <span>{t("managerLiveMap.controls.showDrivers")}</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <Checkbox checked={showOrders} onCheckedChange={(checked) => setShowOrders(checked === true)} />
                  <span>{t("managerLiveMap.controls.showOrders")}</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <Checkbox checked={showRoutes} onCheckedChange={(checked) => setShowRoutes(checked === true)} />
                  <span>{t("managerLiveMap.controls.showRoutes")}</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <Checkbox
                    checked={showHeatmap}
                    onCheckedChange={(checked) => setShowHeatmap(checked === true)}
                  />
                  <span>{t("managerLiveMap.controls.showHeatmap")}</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <Checkbox
                    checked={showWarehouses}
                    onCheckedChange={(checked) => setShowWarehouses(checked === true)}
                  />
                  <span>{t("managerLiveMap.controls.showWarehouses")}</span>
                </label>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pb-1 text-xs">
              <Badge variant="outline" className="bg-white/85">
                {t("managerLiveMap.stats.drivers")}: {filteredDrivers.length}
              </Badge>
              <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-700">
                {t("managerLiveMap.stats.online")}: {onlineDrivers}
              </Badge>
              <Badge variant="outline" className="bg-white/85">
                {t("managerLiveMap.stats.orders")}: {ordersWithCoords}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/70 bg-gradient-to-br from-slate-50/70 via-background to-indigo-50/45 text-foreground">
          <CardContent className="p-0">
            <div className="grid h-[78vh] min-h-[620px] grid-rows-[320px_minmax(0,1fr)] lg:grid-cols-[360px_minmax(0,1fr)] lg:grid-rows-1">
              <div className="border-b border-border/60 bg-gradient-to-b from-cyan-50/40 via-background to-indigo-50/40 lg:border-b-0 lg:border-r">
                <div className="border-b border-border/60 px-4 py-3">
                  <p className="text-sm font-semibold">{t("managerLiveMap.panel.title")}</p>
                  <div className="relative mt-2">
                    <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={driverQuery}
                      onChange={(event) => setDriverQuery(event.target.value)}
                      placeholder={t("managerLiveMap.panel.searchPlaceholder")}
                      className="h-9 border-indigo-200 bg-white/90 pl-8"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">
                      <Truck className="mr-1 h-3 w-3" />
                      {filteredDrivers.length}
                    </Badge>
                    <Badge className="border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-50">
                      {onlineDrivers}
                    </Badge>
                    <Badge className="border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
                      {staleDrivers}
                    </Badge>
                  </div>
                </div>

                <ScrollArea className="h-[calc(320px-116px)] lg:h-[calc(78vh-116px)] lg:min-h-[504px]">
                  <div className="space-y-2 p-3">
                    {visibleDrivers.length === 0 ? (
                      <div className="rounded-lg border border-border/60 bg-background p-3 text-sm text-muted-foreground">
                        {t("managerLiveMap.panel.empty")}
                      </div>
                    ) : null}
                    {visibleDrivers.map((driver) => {
                      const isSelected = selectedDriver?.id === driver.id;
                      const accent = statusAccent(driver.status);
                      return (
                        <button
                          key={driver.id}
                          type="button"
                          onClick={() => setSelectedDriverId(driver.id)}
                          className={cn(
                            "w-full rounded-xl border px-3 py-2.5 text-left transition",
                            isSelected
                              ? accent.selectedRow
                              : "border-border/70 bg-background hover:bg-muted/40",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span
                                className={cn(
                                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold",
                                  isSelected ? accent.avatar : "bg-slate-100 text-slate-700",
                                )}
                              >
                                {driverInitials(driver)}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">
                                  {driver.name || driver.email || driver.id}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">{driver.email || driver.id}</p>
                              </div>
                            </div>
                            <span className={cn("mt-1 h-2.5 w-2.5 rounded-full", statusClass(driver.status))} />
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                            <p className="inline-flex items-center gap-1">
                              <Gauge className="h-3 w-3" />
                              {t("managerLiveMap.panel.speed")}: {driver.speedKmh} km/h
                            </p>
                            <p className="inline-flex items-center gap-1">
                              <Clock3 className="h-3 w-3" />
                              {t("managerLiveMap.panel.lastSeen")}: {formatLastSeen(driver.lastSeenAt)}
                            </p>
                            <p className="col-span-2 inline-flex items-center gap-1 truncate">
                              <Building2 className="h-3 w-3" />
                              {t("managerLiveMap.panel.warehouse")}: {driver.warehouseId || "-"}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>

              <div className="relative h-full w-full">
                <div ref={setMapContainerEl} className="h-full w-full bg-slate-100" />

                {snapshotQuery.isLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
                    <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/95 px-4 py-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("managerLiveMap.loading")}
                    </div>
                  </div>
                ) : null}

                {mapError ? (
                  <div className="absolute inset-x-4 top-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {mapError}
                  </div>
                ) : null}

                {!snapshotQuery.isLoading && !mapError && allVisibleCoords.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                    {t("managerLiveMap.noData")}
                  </div>
                ) : null}

                <div className="absolute right-4 top-4 z-10 flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 bg-background/90"
                    onClick={recenterMap}
                  >
                    <Navigation className="mr-1.5 h-3.5 w-3.5" />
                    {t("managerLiveMap.controls.recenter")}
                  </Button>
                </div>

                {selectedDriver ? (
                  <div
                    className={cn(
                      "absolute bottom-4 left-4 z-10 max-w-[95%] rounded-2xl border p-3 shadow-xl backdrop-blur",
                      statusAccent(selectedDriver.status).panel,
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                          {t("managerLiveMap.panel.summaryTitle")}
                        </p>
                        <p className="truncate text-sm font-semibold">
                          {selectedDriver.name || selectedDriver.email || selectedDriver.id}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {selectedDriver.email || selectedDriver.id}
                        </p>
                      </div>
                      <Badge variant="outline" className={statusAccent(selectedDriver.status).badge}>
                        {formatDriverStatus(selectedDriver.status)}
                      </Badge>
                    </div>
                    <div className="my-2 h-px bg-gradient-to-r from-transparent via-border/70 to-transparent" />
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg border border-border/60 bg-white/70 px-2.5 py-2">
                        <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock3 className="h-3 w-3" />
                          {t("managerLiveMap.panel.lastSeen")}
                        </p>
                        <p className="mt-1 font-medium text-foreground">{formatLastSeen(selectedDriver.lastSeenAt)}</p>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-white/70 px-2.5 py-2">
                        <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Gauge className="h-3 w-3" />
                          {t("managerLiveMap.panel.speed")}
                        </p>
                        <p className="mt-1 font-medium text-foreground">{selectedDriver.speedKmh} km/h</p>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-white/70 px-2.5 py-2">
                        <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          {t("managerLiveMap.panel.warehouse")}
                        </p>
                        <p className="mt-1 truncate font-medium text-foreground">{selectedDriver.warehouseId || "-"}</p>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-white/70 px-2.5 py-2">
                        <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {t("managerLiveMap.panel.coordinates")}
                        </p>
                        <p className="mt-1 font-medium text-foreground">
                          {selectedDriver.lat.toFixed(5)}, {selectedDriver.lng.toFixed(5)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 bg-white/75"
                        onClick={centerOnSelectedDriver}
                      >
                        <LocateFixed className="mr-1.5 h-3.5 w-3.5" />
                        {t("managerLiveMap.panel.focus")}
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="absolute bottom-4 right-4 grid gap-1 rounded-xl border border-border/70 bg-background/95 p-2 text-xs text-foreground shadow-sm">
                  <div className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
                    {t("managerLiveMap.legend.driversOnline")}
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-400" />
                    {t("managerLiveMap.legend.driversIdle")}
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    {t("managerLiveMap.legend.driversStale")}
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                    {t("managerLiveMap.legend.driversOffline")}
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                    {t("managerLiveMap.legend.route")}
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                    {t("managerLiveMap.legend.warehouse")}
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                    {t("managerLiveMap.legend.pickup")}
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                    {t("managerLiveMap.legend.dropoff")}
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-violet-500/80" />
                    {t("managerLiveMap.legend.heat")}
                  </div>
                </div>

                <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
                  <Badge variant="outline" className="bg-background/95">
                    <Truck className="mr-1 h-3 w-3" />
                    {t("managerLiveMap.stats.stale")}: {staleDrivers}
                  </Badge>
                  <Badge variant="outline" className="bg-background/95">
                    <Warehouse className="mr-1 h-3 w-3" />
                    {warehouseFeatures.features.length}
                  </Badge>
                  <Badge variant="outline" className="bg-background/95">
                    <MapPinned className="mr-1 h-3 w-3" />
                    {ordersWithCoords}
                  </Badge>
                  <Badge variant="outline" className="bg-background/95">
                    <Route className="mr-1 h-3 w-3" />
                    {routeFeatures.features.length}
                  </Badge>
                  <Badge variant="outline" className="bg-background/95">
                    <Flame className="mr-1 h-3 w-3" />
                    {heatmapFeatures.features.length}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {snapshotQuery.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}
