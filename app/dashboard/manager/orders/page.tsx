"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { useI18n } from "@/components/i18n/I18nProvider";
import OrdersTable from "@/components/manager/orders/OrdersTable";
import PageShell from "@/components/layout/PageShell";
import type { ManagerOrderRow } from "@/components/manager/orders/columns";

import { exportOrdersCsv, fetchOrders } from "@/lib/orders";
import { getStatusLabel } from "@/lib/i18n/labels";
import { fetchDrivers } from "@/lib/manager";
import { fetchWarehouses } from "@/lib/warehouses";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Download,
  Filter,
  Package,
  RefreshCw,
  Save,
  Send,
  Truck,
  Warehouse,
  X,
} from "lucide-react";

type OrdersResponseLike = {
  orders: ManagerOrderRow[];
  total: number;
  page: number;
  limit: number;
  pageCount: number;
  hasMore: boolean;
  nextCursor?: string | null;
  mode?: "page" | "cursor";
  totalExact?: boolean;
};

type OrderStatus =
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

type FilterState = {
  statuses: OrderStatus[];
  createdFrom: string;
  createdTo: string;
  customerQuery: string;
  assignedDriverId: string;
  warehouseId: string;
  region: string;
};

type FilterPreset = {
  id: string;
  name: string;
  filters: FilterState;
};

const FILTER_PRESETS_STORAGE_KEY = "manager-orders-filter-presets-v1";
const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "assigned",
  "pickup_in_progress",
  "picked_up",
  "at_warehouse",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "exception",
  "return_in_progress",
  "returned",
  "cancelled",
];

const EMPTY_FILTERS: FilterState = {
  statuses: [],
  createdFrom: "",
  createdTo: "",
  customerQuery: "",
  assignedDriverId: "",
  warehouseId: "",
  region: "",
};

function cloneFilters(filters: FilterState): FilterState {
  return {
    statuses: [...filters.statuses],
    createdFrom: filters.createdFrom,
    createdTo: filters.createdTo,
    customerQuery: filters.customerQuery,
    assignedDriverId: filters.assignedDriverId,
    warehouseId: filters.warehouseId,
    region: filters.region,
  };
}

function countActiveFilters(filters: FilterState) {
  return [
    filters.statuses.length > 0,
    Boolean(filters.createdFrom),
    Boolean(filters.createdTo),
    Boolean(filters.customerQuery.trim()),
    Boolean(filters.assignedDriverId),
    Boolean(filters.warehouseId),
    Boolean(filters.region.trim()),
  ].filter(Boolean).length;
}

function triggerCsvDownload(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export default function ManagerOrdersPage() {
  const router = useRouter();
  const search = useSearchParams();
  const { t } = useI18n();
  const openId = search.get("open");

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [presetName, setPresetName] = useState("");
  const [presets, setPresets] = useState<FilterPreset[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(FILTER_PRESETS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [cursorStack, setCursorStack] = useState<Array<string | null>>([null]);
  const [cursorIndex, setCursorIndex] = useState(0);

  useEffect(() => {
    if (openId) router.push(`/dashboard/manager/orders/${openId}`);
  }, [openId, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      FILTER_PRESETS_STORAGE_KEY,
      JSON.stringify(presets),
    );
  }, [presets]);

  const filterSignature = JSON.stringify(filters);

  const driversQuery = useQuery({
    queryKey: ["manager-drivers", "orders-filters"],
    queryFn: fetchDrivers,
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouses", "orders-filters"],
    queryFn: fetchWarehouses,
  });

  const ordersQuery = useQuery<OrdersResponseLike | ManagerOrderRow[]>({
    queryKey: [
      "orders-cursor",
      cursorStack[cursorIndex] ?? null,
      filterSignature,
    ],
    queryFn: () =>
      fetchOrders({
        limit: 140,
        mode: "cursor",
        cursor: cursorStack[cursorIndex] ?? undefined,
        statuses: filters.statuses,
        createdFrom: filters.createdFrom || undefined,
        createdTo: filters.createdTo || undefined,
        customerQuery: filters.customerQuery.trim() || undefined,
        assignedDriverId: filters.assignedDriverId || undefined,
        warehouseId: filters.warehouseId || undefined,
        region: filters.region.trim() || undefined,
      }),
    placeholderData: (prev) => prev,
    refetchInterval: 30000,
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const blob = await exportOrdersCsv({
        statuses: filters.statuses,
        createdFrom: filters.createdFrom || undefined,
        createdTo: filters.createdTo || undefined,
        customerQuery: filters.customerQuery.trim() || undefined,
        assignedDriverId: filters.assignedDriverId || undefined,
        warehouseId: filters.warehouseId || undefined,
        region: filters.region.trim() || undefined,
      });

      const stamp = new Date().toISOString().slice(0, 10);
      triggerCsvDownload(blob, `orders-export-${stamp}.csv`);
    },
    onSuccess: () => {
      toast.success(t("managerOrdersPage.csvReady"));
    },
    onError: (error: unknown) => {
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: string }).message || t("managerOrdersPage.csvFailed"))
          : t("managerOrdersPage.csvFailed");
      toast.error(message);
    },
  });

  const orders = useMemo(() => {
    const raw = ordersQuery.data;
    return Array.isArray(raw) ? raw : (raw?.orders ?? []);
  }, [ordersQuery.data]);

  const meta = useMemo(() => {
    const raw = ordersQuery.data;
    return Array.isArray(raw) ? null : raw;
  }, [ordersQuery.data]);

  const page = cursorIndex + 1;
  const canPrev = page > 1;
  const canNext = Boolean(meta?.hasMore);
  const totalOrders = meta?.totalExact ? (meta.total ?? orders.length) : orders.length;
  const totalOrdersLabel =
    meta?.totalExact === false ? `Loaded ${orders.length}` : `${totalOrders}`;
  const lastSync = ordersQuery.dataUpdatedAt
    ? new Date(ordersQuery.dataUpdatedAt).toLocaleTimeString()
    : "-";
  const activeFilterCount = countActiveFilters(filters);

  const goPrev = () => {
    if (!canPrev) return;
    setCursorIndex((prev) => Math.max(0, prev - 1));
  };

  const goNext = () => {
    if (!canNext || !meta?.nextCursor) return;
    setCursorStack((prev) => {
      const nextIndex = cursorIndex + 1;
      const next = prev.slice(0, nextIndex);
      next[nextIndex] = meta.nextCursor ?? null;
      return next;
    });
    setCursorIndex((prev) => prev + 1);
  };

  const counts = useMemo(() => {
    let pending = 0;
    let assigned = 0;
    let inFlight = 0;
    let warehouse = 0;
    let delivered = 0;
    let exception = 0;

    for (const order of orders) {
      const s = String(order.status ?? "").toLowerCase();
      if (s === "pending") pending += 1;
      if (s === "assigned") assigned += 1;
      if (
        s === "pickup_in_progress" ||
        s === "picked_up" ||
        s === "in_transit" ||
        s === "out_for_delivery"
      ) {
        inFlight += 1;
      }
      if (s === "at_warehouse") warehouse += 1;
      if (s === "delivered") delivered += 1;
      if (s === "exception" || s === "return_in_progress") exception += 1;
    }

    return { pending, assigned, inFlight, warehouse, delivered, exception };
  }, [orders]);

  const queueMix = useMemo(() => {
    const map = new Map<string, number>();
    for (const order of orders) {
      const s = String(order.status ?? "unknown").toLowerCase();
      map.set(s, (map.get(s) ?? 0) + 1);
    }

    const total = Math.max(orders.length, 1);
    return ORDER_STATUSES.map((status) => {
      const count = map.get(status) ?? 0;
      return {
        status,
        count,
        pct: Math.round((count / total) * 100),
      };
    })
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [orders]);

  const completionRate =
    orders.length > 0 ? Math.round((counts.delivered / orders.length) * 100) : 0;

  const handleRefresh = async () => {
    await ordersQuery.refetch();
  };

  const updateFilters = (
    updater: FilterState | ((prev: FilterState) => FilterState),
  ) => {
    setFilters((prev) => {
      const next =
        typeof updater === "function"
          ? (updater as (prev: FilterState) => FilterState)(prev)
          : updater;

      setCursorStack([null]);
      setCursorIndex(0);
      return next;
    });
  };

  const toggleStatus = (status: OrderStatus) => {
    updateFilters((prev) => {
      const exists = prev.statuses.includes(status);
      return {
        ...prev,
        statuses: exists
          ? prev.statuses.filter((item) => item !== status)
          : [...prev.statuses, status],
      };
    });
  };

  const clearFilters = () => {
    updateFilters(cloneFilters(EMPTY_FILTERS));
  };

  const savePreset = () => {
    const name = presetName.trim();
    if (!name) return;

    const nextPreset: FilterPreset = {
      id: `${Date.now()}`,
      name,
      filters: cloneFilters(filters),
    };

    setPresets((prev) => [nextPreset, ...prev.filter((item) => item.name !== name)].slice(0, 8));
    setPresetName("");
  };

  const removePreset = (id: string) => {
    setPresets((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <PageShell>
      <div className="mx-auto max-w-[1500px] space-y-6">
        <Card className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 text-white">
          <div className="absolute -right-20 -top-14 h-60 w-60 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="absolute -left-16 -bottom-10 h-52 w-52 rounded-full bg-emerald-300/10 blur-3xl" />
          <CardContent className="relative space-y-6 p-4 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs">
                  <Filter className="h-3.5 w-3.5" />
                  {t("managerOrdersPage.deskPill")}
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">{t("managerOrdersPage.title")}</h1>
                <p className="max-w-3xl text-sm text-slate-100/85">
                  {t("managerOrdersPage.subtitle")}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  className="gap-2"
                  onClick={() => {
                    void exportMutation.mutateAsync();
                  }}
                  disabled={exportMutation.isPending}
                >
                  <Download className="h-4 w-4" />
                  {exportMutation.isPending
                    ? t("managerOrdersPage.preparingCsv")
                    : t("managerOrdersPage.exportCsv")}
                </Button>
                <Button
                  variant="secondary"
                  className="gap-2"
                  onClick={() => {
                    void handleRefresh();
                  }}
                  disabled={ordersQuery.isFetching}
                >
                  <RefreshCw className={`h-4 w-4 ${ordersQuery.isFetching ? "animate-spin" : ""}`} />
                  {t("managerOrdersPage.refresh")}
                </Button>
                <Button asChild variant="secondary" className="gap-2">
                  <Link href="/dashboard/manager/dispatch">
                    <Send className="h-4 w-4" />
                    {t("managerOrdersPage.dispatchCenter")}
                  </Link>
                </Button>
                <Button asChild variant="secondary" className="gap-2">
                  <Link href="/dashboard/manager">
                    <ArrowLeft className="h-4 w-4" />
                    {t("managerOrdersPage.dashboard")}
                  </Link>
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full border-white/20 bg-white/10 text-white">
                {t("managerOrdersPage.inView", { count: totalOrdersLabel })}
              </Badge>
              <Badge className="rounded-full border-white/20 bg-white/10 text-white">
                {t("managerOrdersPage.activeFilters", { count: activeFilterCount })}
              </Badge>
              <Badge className="rounded-full border-white/20 bg-white/10 text-white">
                {t("managerOrdersPage.delivered", { count: counts.delivered })}
              </Badge>
              <Badge className="rounded-full border-white/20 bg-white/10 text-white">
                {t("managerOrdersPage.exceptions", { count: counts.exception })}
              </Badge>
              <div className="ml-auto inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/90">
                <RefreshCw className={`h-3.5 w-3.5 ${ordersQuery.isFetching ? "animate-spin" : ""}`} />
                {t("managerOrdersPage.lastSync", { time: lastSync })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/70">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-base">{t("managerOrdersPage.filterExportTitle")}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("managerOrdersPage.filterExportSubtitle")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder={t("managerOrdersPage.presetName")}
                  className="w-full sm:w-[170px]"
                />
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={savePreset}
                  disabled={!presetName.trim()}
                >
                  <Save className="h-4 w-4" />
                  {t("managerOrdersPage.savePreset")}
                </Button>
                <Button variant="outline" className="gap-2" onClick={clearFilters}>
                  <X className="h-4 w-4" />
                  {t("managerOrdersPage.clearFilters")}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr_1fr_1fr]">
              <div className="space-y-1.5">
                <Label>{t("managerOrdersPage.customer")}</Label>
                <Input
                  value={filters.customerQuery}
                  onChange={(e) =>
                    updateFilters((prev) => ({ ...prev, customerQuery: e.target.value }))
                  }
                  placeholder={t("managerOrdersPage.customerPlaceholder")}
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t("managerOrdersPage.assignedDriver")}</Label>
                <Select
                  value={filters.assignedDriverId || "all"}
                  onValueChange={(value) =>
                    updateFilters((prev) => ({
                      ...prev,
                      assignedDriverId: value === "all" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("managerOrdersPage.allDrivers")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("managerOrdersPage.allDrivers")}</SelectItem>
                    {(driversQuery.data ?? []).map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name} - {driver.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{t("managerOrdersPage.warehouse")}</Label>
                <Select
                  value={filters.warehouseId || "all"}
                  onValueChange={(value) =>
                    updateFilters((prev) => ({
                      ...prev,
                      warehouseId: value === "all" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("managerOrdersPage.allWarehouses")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("managerOrdersPage.allWarehouses")}</SelectItem>
                    {(warehousesQuery.data ?? []).map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{t("managerOrdersPage.region")}</Label>
                <Input
                  value={filters.region}
                  onChange={(e) =>
                    updateFilters((prev) => ({ ...prev, region: e.target.value }))
                  }
                  placeholder={t("managerOrdersPage.regionPlaceholder")}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label>{t("managerOrdersPage.createdFrom")}</Label>
                <Input
                  type="date"
                  value={filters.createdFrom}
                  onChange={(e) =>
                    updateFilters((prev) => ({ ...prev, createdFrom: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t("managerOrdersPage.createdTo")}</Label>
                <Input
                  type="date"
                  value={filters.createdTo}
                  onChange={(e) =>
                    updateFilters((prev) => ({ ...prev, createdTo: e.target.value }))
                  }
                />
              </div>

              <div className="rounded-2xl border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                {t("managerOrdersPage.exportHint")}
              </div>

              <div className="rounded-2xl border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                {t("managerOrdersPage.presetsHint")}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("managerOrdersPage.statusMix")}</Label>
              <div className="flex flex-wrap gap-2">
                {ORDER_STATUSES.map((status) => {
                  const active = filters.statuses.includes(status);
                  return (
                    <Button
                      key={status}
                      type="button"
                      variant={active ? "default" : "outline"}
                      size="sm"
                      className="rounded-full capitalize"
                      onClick={() => toggleStatus(status)}
                    >
                      {getStatusLabel(status, t)}
                    </Button>
                  );
                })}
              </div>
            </div>

            {presets.length > 0 ? (
              <div className="space-y-2">
                <Label>{t("managerOrdersPage.savedPresets")}</Label>
                <div className="flex flex-wrap gap-2">
                  {presets.map((preset) => (
                    <div
                      key={preset.id}
                      className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-1"
                    >
                      <button
                        type="button"
                        className="text-sm font-medium"
                        onClick={() => updateFilters(cloneFilters(preset.filters))}
                      >
                        {preset.name}
                      </button>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => removePreset(preset.id)}
                        title={t("managerOrdersPage.deletePreset")}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <Card className="rounded-2xl border-border/70">
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("managerOrdersPage.filteredView")}
              </div>
              <div className="mt-1 text-2xl font-semibold">{totalOrdersLabel}</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/70">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" /> {t("managerOrdersPage.pending")}
              </div>
              <div className="mt-1 text-2xl font-semibold">{counts.pending}</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/70">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <Truck className="h-3.5 w-3.5" /> {t("managerOrdersPage.assigned")}
              </div>
              <div className="mt-1 text-2xl font-semibold">{counts.assigned}</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/70">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <Warehouse className="h-3.5 w-3.5" /> {t("managerOrdersPage.atWarehouse")}
              </div>
              <div className="mt-1 text-2xl font-semibold">{counts.warehouse}</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/70">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5" /> {t("managerOrdersPage.deliveredLabel")}
              </div>
              <div className="mt-1 text-2xl font-semibold">{counts.delivered}</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/70">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5" /> {t("managerOrdersPage.completion")}
              </div>
              <div className="mt-1 text-2xl font-semibold">{completionRate}%</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <Card className="rounded-2xl border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />
                {t("managerOrdersPage.queueBreakdown")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {queueMix.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t("managerOrdersPage.noOrdersForFilters")}</div>
              ) : (
                queueMix.map((item) => (
                  <div key={item.status} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="capitalize text-muted-foreground">
                        {getStatusLabel(item.status, t)}
                      </span>
                      <span className="font-medium text-foreground">{item.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-cyan-600 to-emerald-500"
                        style={{ width: `${Math.max(item.pct, 4)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("managerOrdersPage.exportReadiness")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-3 py-2">
                <span className="text-muted-foreground">{t("managerOrdersPage.activeFiltersLabel")}</span>
                <span className="font-medium">{activeFilterCount}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-3 py-2">
                <span className="text-muted-foreground">{t("managerOrdersPage.rowsCurrentView")}</span>
                <span className="font-medium">{orders.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-3 py-2">
                <span className="text-muted-foreground">{t("managerOrdersPage.lastSyncLabel")}</span>
                <span className="font-medium">{lastSync}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-3 py-2">
                <span className="text-muted-foreground">{t("managerOrdersPage.autoRefresh")}</span>
                <span className="font-medium">30s</span>
              </div>
              <Button
                className="w-full gap-2"
                onClick={() => {
                  void exportMutation.mutateAsync();
                }}
                disabled={exportMutation.isPending}
              >
                <Download className="h-4 w-4" />
                {exportMutation.isPending
                  ? t("managerOrdersPage.preparingCsv")
                  : t("managerOrdersPage.exportCurrentDataset")}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-border/70">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4" />
                {t("managerOrdersPage.ordersTable")}
              </CardTitle>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="rounded-full">
                  {t("managerOrdersPage.financeReadyExport")}
                </Badge>
                <Badge variant="outline" className="rounded-full">
                  {t("managerOrdersPage.page", { page })}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goPrev}
                  disabled={!canPrev || ordersQuery.isFetching}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goNext}
                  disabled={!canNext || ordersQuery.isFetching}
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {ordersQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-72" />
                <Skeleton className="h-52 w-full" />
              </div>
            ) : (
              <OrdersTable
                data={orders}
                hideQuickFilters
                onRefresh={() => {
                  void handleRefresh();
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
