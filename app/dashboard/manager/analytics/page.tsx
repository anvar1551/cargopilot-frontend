"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FilterX,
  PackageOpen,
  RefreshCw,
  Route,
  TimerReset,
  TrendingUp,
  Wallet,
} from "lucide-react";

import PageShell from "@/components/layout/PageShell";
import { useI18n } from "@/components/i18n/I18nProvider";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchDrivers,
  fetchManagerAnalyticsSummary,
  type ManagerAnalyticsSummary,
} from "@/lib/manager";
import { handoffOrderCashBulk, settleOrderCashBulk } from "@/lib/orders";
import { fetchWarehouses } from "@/lib/warehouses";
import { getServiceTypeLabel, getStatusLabel } from "@/lib/i18n/labels";

function formatMoney(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function prettyHolderType(value: string, t: (key: string, values?: Record<string, string | number>) => string) {
  const key = `managerAnalytics.finance.holderTypes.${value}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function prettyCashKind(value: string, t: (key: string, values?: Record<string, string | number>) => string) {
  const key = `orderDetails.cash.kind.${value}`;
  const translated = t(key);
  return translated === key ? prettyHolderType(value, t) : translated;
}

function prettyCashStatus(value: string, t: (key: string, values?: Record<string, string | number>) => string) {
  const key = `orderDetails.cash.status.${value}`;
  const translated = t(key);
  return translated === key ? prettyHolderType(value, t) : translated;
}

function StatCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <Card className="border-border/70">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
          <div className="text-3xl font-semibold tracking-tight">{value}</div>
        </div>
        <div className={`rounded-2xl p-3 ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function ManagerAnalyticsPage() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const [rangeDays, setRangeDays] = useState("30");
  const [queueStatus, setQueueStatus] = useState<"all" | "expected" | "held">("all");
  const [queueKind, setQueueKind] = useState<"all" | "cod" | "service_charge">("all");
  const [queueHolderType, setQueueHolderType] = useState<
    "all" | "driver" | "warehouse" | "pickup_point" | "none"
  >("all");
  const [queueFrom, setQueueFrom] = useState("");
  const [queueTo, setQueueTo] = useState("");
  const [queuePage, setQueuePage] = useState(1);
  const [handoffToType, setHandoffToType] = useState<
    "driver" | "warehouse" | "pickup_point"
  >("warehouse");
  const [handoffToDriverId, setHandoffToDriverId] = useState<string>("");
  const [handoffToWarehouseId, setHandoffToWarehouseId] = useState<string>("");
  const [selectedQueueIds, setSelectedQueueIds] = useState<string[]>([]);

  const analyticsQuery = useQuery<ManagerAnalyticsSummary, any>({
    queryKey: [
      "manager-analytics-summary",
      rangeDays,
      queueStatus,
      queueKind,
      queueHolderType,
      queueFrom,
      queueTo,
      queuePage,
    ],
    queryFn: () =>
      fetchManagerAnalyticsSummary({
        rangeDays: Number(rangeDays),
        queuePage,
        queuePageSize: 20,
        queueFrom: queueFrom || undefined,
        queueTo: queueTo || undefined,
        queueStatuses: queueStatus === "all" ? [] : [queueStatus],
        queueKinds: queueKind === "all" ? [] : [queueKind],
        queueHolderTypes: queueHolderType === "all" ? [] : [queueHolderType],
      }),
    refetchInterval: 60000,
    placeholderData: (previousData) => previousData,
  });

  const data = analyticsQuery.data;
  const analyticsErrorMessage =
    analyticsQuery.error?.response?.data?.error ||
    analyticsQuery.error?.message ||
    t("common.error.UNKNOWN_ERROR");
  const queueMeta = data?.finance.queueMeta;
  const locationThroughput = useMemo(() => {
    const fallback = {
      warehouse: {
        activeOrders: 0,
        atWarehouseOrders: 0,
        outForDeliveryOrders: 0,
        deliveredInRange: 0,
      },
      pickupPoint: {
        activeOrders: 0,
        atWarehouseOrders: 0,
        outForDeliveryOrders: 0,
        deliveredInRange: 0,
      },
    };

    if (!data?.operations?.locationThroughput) return fallback;

    return {
      warehouse: {
        activeOrders: data.operations.locationThroughput.warehouse?.activeOrders ?? 0,
        atWarehouseOrders:
          data.operations.locationThroughput.warehouse?.atWarehouseOrders ?? 0,
        outForDeliveryOrders:
          data.operations.locationThroughput.warehouse?.outForDeliveryOrders ?? 0,
        deliveredInRange:
          data.operations.locationThroughput.warehouse?.deliveredInRange ?? 0,
      },
      pickupPoint: {
        activeOrders: data.operations.locationThroughput.pickupPoint?.activeOrders ?? 0,
        atWarehouseOrders:
          data.operations.locationThroughput.pickupPoint?.atWarehouseOrders ?? 0,
        outForDeliveryOrders:
          data.operations.locationThroughput.pickupPoint?.outForDeliveryOrders ?? 0,
        deliveredInRange:
          data.operations.locationThroughput.pickupPoint?.deliveredInRange ?? 0,
      },
    };
  }, [data]);

  const driversQuery = useQuery({
    queryKey: ["manager-drivers-for-cash-handoff"],
    queryFn: fetchDrivers,
    staleTime: 60000,
  });

  const warehousesQuery = useQuery({
    queryKey: ["manager-warehouses-for-cash-handoff"],
    queryFn: fetchWarehouses,
    staleTime: 60000,
  });

  const handoffWarehouses = useMemo(() => {
    const list = Array.isArray(warehousesQuery.data) ? warehousesQuery.data : [];
    return list.filter((warehouse: any) => {
      if (!handoffToType) return false;
      if (handoffToType === "warehouse") {
        return String(warehouse?.type || "warehouse") === "warehouse";
      }
      return String(warehouse?.type || "warehouse") === "pickup_point";
    });
  }, [warehousesQuery.data, handoffToType]);

  useEffect(() => {
    if (!data?.finance.queue?.length) {
      setSelectedQueueIds([]);
      return;
    }
    const visible = new Set(data.finance.queue.map((item) => item.id));
    setSelectedQueueIds((current) => current.filter((id) => visible.has(id)));
  }, [data]);

  useEffect(() => {
    setHandoffToDriverId("");
    setHandoffToWarehouseId("");
  }, [handoffToType]);

  useEffect(() => {
    setQueuePage(1);
  }, [queueStatus, queueKind, queueHolderType, queueFrom, queueTo]);

  const selectedQueueItems = useMemo(() => {
    if (!data) return [];
    const selected = new Set(selectedQueueIds);
    return data.finance.queue.filter((item) => selected.has(item.id));
  }, [data, selectedQueueIds]);

  const allVisibleSelected =
    Boolean(data?.finance.queue.length) &&
    selectedQueueItems.length === data?.finance.queue.length;

  const selectedCashItems = useMemo(
    () =>
      selectedQueueItems
        .filter((item) => item.kind === "cod" || item.kind === "service_charge")
        .map((item) => ({
          orderId: item.orderId,
          kind: item.kind as "cod" | "service_charge",
        })),
    [selectedQueueItems],
  );

  const hasActiveQueueFilters =
    queueStatus !== "all" ||
    queueKind !== "all" ||
    queueHolderType !== "all" ||
    Boolean(queueFrom) ||
    Boolean(queueTo);

  const canQueuePrev = Boolean(queueMeta?.hasPrev);
  const canQueueNext = Boolean(queueMeta?.hasNext);

  const clearQueueFilters = () => {
    setQueueStatus("all");
    setQueueKind("all");
    setQueueHolderType("all");
    setQueueFrom("");
    setQueueTo("");
    setQueuePage(1);
  };

  const settleSelectedMutation = useMutation({
    mutationFn: async () =>
      settleOrderCashBulk({
        items: selectedCashItems,
      }),
    onSuccess: (result) => {
      const okCount = Number(result?.count ?? 0);
      const failedCount = Number(result?.failedCount ?? 0);

      if (okCount > 0 && failedCount === 0) {
        toast.success(
          t("managerAnalytics.finance.settleSelectedSuccess", { count: okCount }),
        );
      } else if (okCount > 0) {
        toast.warning(
          t("managerAnalytics.finance.settleSelectedPartial", {
            success: okCount,
            failed: failedCount,
          }),
        );
      } else {
        toast.error(t("managerAnalytics.finance.settleSelectedFailed"));
      }

      setSelectedQueueIds([]);
      analyticsQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order"] });
      queryClient.invalidateQueries({ queryKey: ["manager-analytics-summary"] });
    },
    onError: () => {
      toast.error(t("managerAnalytics.finance.settleSelectedFailed"));
    },
  });

  const handoffSelectedMutation = useMutation({
    mutationFn: async () =>
      handoffOrderCashBulk({
        items: selectedCashItems,
        toHolderType: handoffToType,
        toDriverId: handoffToType === "driver" ? handoffToDriverId : null,
        toWarehouseId:
          handoffToType === "driver" ? null : handoffToWarehouseId,
      }),
    onSuccess: (result) => {
      const okCount = Number(result?.count ?? 0);
      const failedCount = Number(result?.failedCount ?? 0);

      if (okCount > 0 && failedCount === 0) {
        toast.success(
          t("managerAnalytics.finance.handoffSelectedSuccess", {
            count: okCount,
          }),
        );
      } else if (okCount > 0) {
        toast.warning(
          t("managerAnalytics.finance.handoffSelectedPartial", {
            success: okCount,
            failed: failedCount,
          }),
        );
      } else {
        toast.error(t("managerAnalytics.finance.handoffSelectedFailed"));
      }

      setSelectedQueueIds([]);
      analyticsQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order"] });
      queryClient.invalidateQueries({ queryKey: ["manager-analytics-summary"] });
    },
    onError: () => {
      toast.error(t("managerAnalytics.finance.handoffSelectedFailed"));
    },
  });

  const handoffDestinationReady =
    handoffToType === "driver"
      ? Boolean(handoffToDriverId)
      : Boolean(handoffToWarehouseId);

  const trendViewport = useMemo(() => {
    if (!data) return [];
    const rows = data.trend.created.map((item, index) => {
      const delivered = data.trend.delivered[index]?.count ?? 0;
      return {
        date: item.date,
        label: item.date.slice(5),
        created: item.count,
        delivered,
      };
    });
    return rows.slice(-14);
  }, [data]);

  const trendViewportPeak = useMemo(() => {
    if (!trendViewport.length) return 1;
    return Math.max(
      1,
      ...trendViewport.flatMap((row) => [row.created, row.delivered]),
    );
  }, [trendViewport]);

  const trendTotals = useMemo(() => {
    if (!data) return { created: 0, delivered: 0 };
    return {
      created: data.trend.created.reduce((sum, item) => sum + item.count, 0),
      delivered: data.trend.delivered.reduce((sum, item) => sum + item.count, 0),
    };
  }, [data]);

  const guidance = useMemo(() => {
    if (!data) return [];
    const notes: string[] = [];
    if (data.sla.overdueOpenOrders > 0) {
      notes.push(t("managerAnalytics.guidance.overdue", { count: data.sla.overdueOpenOrders }));
    }
    if (data.operations.staleOpenOrders > 0) {
      notes.push(t("managerAnalytics.guidance.stale", { count: data.operations.staleOpenOrders }));
    }
    const financeExposure = data.finance.unpaidCodCount + data.finance.unpaidServiceCount;
    if (financeExposure > 0) {
      notes.push(t("managerAnalytics.guidance.finance", { count: financeExposure }));
    }
    if (data.finance.driverHeldAmount > 0) {
      notes.push(
        t("managerAnalytics.guidance.driverCash", {
          amount: formatMoney(data.finance.driverHeldAmount, locale),
        }),
      );
    }
    if (notes.length === 0) {
      notes.push(t("managerAnalytics.guidance.healthy"));
    }
    return notes;
  }, [data, locale, t]);

  const locationSplitText = useMemo(() => {
    if (locale === "ru") {
      return {
        title: "Пропускная способность по типу локации",
        subtitle:
          "Разделение операционного потока между классическими складами и ПВЗ.",
        active: "Активные",
        atWarehouse: "На локации",
        outForDelivery: "Готово к выдаче/последней миле",
        delivered: "Доставлено за период",
      };
    }
    if (locale === "uz") {
      return {
        title: "Lokatsiya turi bo'yicha throughput",
        subtitle:
          "Klassik omborlar va pickup pointlar o'rtasidagi operatsion oqim kesimi.",
        active: "Aktiv",
        atWarehouse: "Lokatsiyada",
        outForDelivery: "Topshirishga tayyor",
        delivered: "Davr ichida yetkazilgan",
      };
    }
    return {
      title: "Throughput by location type",
      subtitle:
        "Operational flow split between classic warehouses and pickup points.",
      active: "Active",
      atWarehouse: "At location",
      outForDelivery: "Ready for handover / last-mile",
      delivered: "Delivered in period",
    };
  }, [locale]);

  return (
    <PageShell className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-border/70 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.10),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(249,115,22,0.10),_transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] px-6 py-6 shadow-sm sm:px-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-3">
            <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.28em]">
              {t("managerAnalytics.badge")}
            </Badge>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">{t("managerAnalytics.title")}</h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{t("managerAnalytics.subtitle")}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{t("managerAnalytics.filters.rangeDays")}</div>
              <Select value={rangeDays} onValueChange={setRangeDays}>
                <SelectTrigger className="w-[180px] bg-background/90"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">{t("managerAnalytics.filters.last7Days")}</SelectItem>
                  <SelectItem value="30">{t("managerAnalytics.filters.last30Days")}</SelectItem>
                  <SelectItem value="90">{t("managerAnalytics.filters.last90Days")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                {t("managerAnalytics.filters.staleHours")}
              </div>
              <div className="h-10 min-w-[180px] rounded-md border bg-background/90 px-3 py-2 text-sm text-foreground">
                {data?.slaPolicy?.staleHoursApplied ?? "-"}h
              </div>
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={() => analyticsQuery.refetch()} disabled={analyticsQuery.isFetching} className="bg-background/90">
                <RefreshCw className="mr-2 h-4 w-4" />
                {t("managerAnalytics.refresh")}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {analyticsQuery.isError && !data ? (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle>{t("common.error.OOPS")}</CardTitle>
            <CardDescription>{analyticsErrorMessage}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => analyticsQuery.refetch()}
              disabled={analyticsQuery.isFetching}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("managerAnalytics.refresh")}
            </Button>
          </CardContent>
        </Card>
      ) : !data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title={t("managerAnalytics.cards.createdInRange")} value={data.overview.createdInRange} icon={TrendingUp} tone="bg-sky-500/10 text-sky-600" />
            <StatCard title={t("managerAnalytics.cards.openOrders")} value={data.overview.openOrders} icon={PackageOpen} tone="bg-slate-900/10 text-slate-700" />
            <StatCard title={t("managerAnalytics.cards.deliveredInRange")} value={data.overview.deliveredInRange} icon={Route} tone="bg-emerald-500/10 text-emerald-600" />
            <StatCard title={t("managerAnalytics.cards.paidInvoiced")} value={formatMoney(data.finance.invoicedPaidAmount, locale)} icon={CircleDollarSign} tone="bg-violet-500/10 text-violet-600" />
            <StatCard title={t("managerAnalytics.cards.overdue")} value={data.sla.overdueOpenOrders} icon={AlertTriangle} tone="bg-rose-500/10 text-rose-600" />
            <StatCard title={t("managerAnalytics.cards.stale")} value={data.operations.staleOpenOrders} icon={TimerReset} tone="bg-amber-500/10 text-amber-600" />
            <StatCard
              title={t("managerAnalytics.cards.dueToday")}
              value={data.sla.dueSoonOpenOrders ?? data.sla.dueTodayOpenOrders}
              icon={Clock3}
              tone="bg-cyan-500/10 text-cyan-600"
            />
            <StatCard title={t("managerAnalytics.cards.promiseBacked")} value={data.sla.promiseBackedOrders} icon={Route} tone="bg-fuchsia-500/10 text-fuchsia-600" />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <Card className="border-border/70">
              <CardHeader>
                <CardTitle>{t("managerAnalytics.sections.operations")}</CardTitle>
                <CardDescription>{data.period.from.slice(0, 10)} - {data.period.to.slice(0, 10)}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {[
                  { key: "pending", value: data.operations.pendingOrders },
                  { key: "atWarehouse", value: data.operations.atWarehouseOrders },
                  { key: "inTransit", value: data.operations.inTransitOrders },
                  { key: "outForDelivery", value: data.operations.outForDeliveryOrders },
                  { key: "exceptions", value: data.overview.exceptionOpenOrders },
                ].map((item) => (
                  <div key={item.key} className="rounded-2xl border bg-background/80 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t(`managerAnalytics.operations.${item.key}`)}</div>
                    <div className="mt-2 text-2xl font-semibold">{item.value}</div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader>
                <CardTitle>{t("managerAnalytics.sections.finance")}</CardTitle>
                <CardDescription>{t("managerAnalytics.finance.snapshot")}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border bg-background/80 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("managerAnalytics.finance.pendingInvoices")}</div>
                  <div className="mt-2 text-2xl font-semibold">{data.finance.pendingInvoicesCount}</div>
                </div>
                <div className="rounded-2xl border bg-background/80 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("managerAnalytics.finance.serviceChargeExpected")}</div>
                  <div className="mt-2 text-2xl font-semibold">{formatMoney(data.finance.serviceChargeExpected, locale)}</div>
                </div>
                <div className="rounded-2xl border bg-background/80 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("managerAnalytics.finance.codExpected")}</div>
                  <div className="mt-2 text-2xl font-semibold">{formatMoney(data.finance.codExpected, locale)}</div>
                </div>
                <div className="rounded-2xl border bg-background/80 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("managerAnalytics.finance.unpaidServiceCount")}</div>
                  <div className="mt-2 text-2xl font-semibold">{data.finance.unpaidServiceCount}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{t("managerAnalytics.finance.unpaidCodCount")}: {data.finance.unpaidCodCount}</div>
                </div>
                <div className="rounded-2xl border bg-background/80 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("managerAnalytics.finance.uncollectedExpected")}</div>
                  <div className="mt-2 text-2xl font-semibold">{formatMoney(data.finance.uncollectedExpectedAmount, locale)}</div>
                </div>
                <div className="rounded-2xl border bg-background/80 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("managerAnalytics.finance.driverHeld")}</div>
                  <div className="mt-2 text-2xl font-semibold">{formatMoney(data.finance.driverHeldAmount, locale)}</div>
                </div>
                <div className="rounded-2xl border bg-background/80 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("managerAnalytics.finance.warehouseHeld")}</div>
                  <div className="mt-2 text-2xl font-semibold">{formatMoney(data.finance.warehouseHeldAmount + data.finance.pickupPointHeldAmount, locale)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t("managerAnalytics.finance.pickupPointHeld")}: {formatMoney(data.finance.pickupPointHeldAmount, locale)}
                  </div>
                </div>
                <div className="rounded-2xl border bg-background/80 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t("managerAnalytics.finance.settled")}</div>
                  <div className="mt-2 text-2xl font-semibold">{formatMoney(data.finance.settledAmount, locale)}</div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="border-border/70 xl:col-span-2">
              <CardHeader>
                <CardTitle>{locationSplitText.title}</CardTitle>
                <CardDescription>{locationSplitText.subtitle}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {[
                  {
                    key: "warehouse",
                    label: t("managerAnalytics.finance.holderTypes.warehouse"),
                    values: locationThroughput.warehouse,
                  },
                  {
                    key: "pickup_point",
                    label: t("managerAnalytics.finance.holderTypes.pickup_point"),
                    values: locationThroughput.pickupPoint,
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="rounded-2xl border bg-background/80 p-4"
                  >
                    <div className="mb-3 text-sm font-medium">{item.label}</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border bg-background p-3">
                        <div className="text-xs text-muted-foreground">
                          {locationSplitText.active}
                        </div>
                        <div className="mt-1 text-xl font-semibold">
                          {item.values.activeOrders}
                        </div>
                      </div>
                      <div className="rounded-xl border bg-background p-3">
                        <div className="text-xs text-muted-foreground">
                          {locationSplitText.atWarehouse}
                        </div>
                        <div className="mt-1 text-xl font-semibold">
                          {item.values.atWarehouseOrders}
                        </div>
                      </div>
                      <div className="rounded-xl border bg-background p-3">
                        <div className="text-xs text-muted-foreground">
                          {locationSplitText.outForDelivery}
                        </div>
                        <div className="mt-1 text-xl font-semibold">
                          {item.values.outForDeliveryOrders}
                        </div>
                      </div>
                      <div className="rounded-xl border bg-background p-3">
                        <div className="text-xs text-muted-foreground">
                          {locationSplitText.delivered}
                        </div>
                        <div className="mt-1 text-xl font-semibold">
                          {item.values.deliveredInRange}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader>
                <CardTitle>{t("managerAnalytics.sections.cashHolders")}</CardTitle>
                <CardDescription>{t("managerAnalytics.finance.holdersHint")}</CardDescription>
              </CardHeader>
              <CardContent>
                {data.finance.holders.length ? (
                  <div className="space-y-3">
                    {data.finance.holders.map((holder) => (
                      <div
                        key={`${holder.holderType}:${holder.holderId ?? holder.holderLabel}`}
                        className="rounded-2xl border bg-background/80 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="font-medium">{holder.holderLabel}</div>
                            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                              {prettyHolderType(holder.holderType, t)}
                            </div>
                          </div>
                          <div className="rounded-full bg-slate-900/5 px-3 py-1 text-xs font-medium text-slate-700">
                            {holder.collectionCount} {t("managerAnalytics.finance.items")}
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="text-2xl font-semibold">
                            {formatMoney(holder.totalAmount, locale)}
                          </div>
                          <Wallet className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                    {t("managerAnalytics.finance.noHeldCash")}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader>
                <CardTitle>{t("managerAnalytics.sections.cashQueue")}</CardTitle>
                <CardDescription>{t("managerAnalytics.finance.queueHint")}</CardDescription>
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={queueStatus}
                      onValueChange={(value: "all" | "expected" | "held") =>
                        setQueueStatus(value)
                      }
                    >
                      <SelectTrigger className="h-8 w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t("managerAnalytics.finance.filterStatusAll")}
                        </SelectItem>
                        <SelectItem value="expected">
                          {t("orderDetails.cash.status.expected")}
                        </SelectItem>
                        <SelectItem value="held">
                          {t("orderDetails.cash.status.held")}
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={queueKind}
                      onValueChange={(value: "all" | "cod" | "service_charge") =>
                        setQueueKind(value)
                      }
                    >
                      <SelectTrigger className="h-8 w-[170px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t("managerAnalytics.finance.filterKindAll")}
                        </SelectItem>
                        <SelectItem value="cod">
                          {t("orderDetails.cash.kind.cod")}
                        </SelectItem>
                        <SelectItem value="service_charge">
                          {t("orderDetails.cash.kind.service_charge")}
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={queueHolderType}
                      onValueChange={(
                        value:
                          | "all"
                          | "driver"
                          | "warehouse"
                          | "pickup_point"
                          | "none",
                      ) => setQueueHolderType(value)}
                    >
                      <SelectTrigger className="h-8 w-[170px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t("managerAnalytics.finance.filterHolderAll")}
                        </SelectItem>
                        <SelectItem value="driver">
                          {t("managerAnalytics.finance.holderTypes.driver")}
                        </SelectItem>
                        <SelectItem value="warehouse">
                          {t("managerAnalytics.finance.holderTypes.warehouse")}
                        </SelectItem>
                        <SelectItem value="pickup_point">
                          {t("managerAnalytics.finance.holderTypes.pickup_point")}
                        </SelectItem>
                        <SelectItem value="none">
                          {t("managerAnalytics.finance.holderTypes.none")}
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {t("managerAnalytics.finance.from")}
                      </span>
                      <Input
                        type="date"
                        className="h-8 w-[150px]"
                        value={queueFrom}
                        onChange={(event) => setQueueFrom(event.target.value)}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {t("managerAnalytics.finance.to")}
                      </span>
                      <Input
                        type="date"
                        className="h-8 w-[150px]"
                        value={queueTo}
                        min={queueFrom || undefined}
                        onChange={(event) => setQueueTo(event.target.value)}
                      />
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={clearQueueFilters}
                      disabled={!hasActiveQueueFilters}
                    >
                      <FilterX className="mr-2 h-4 w-4" />
                      {t("managerAnalytics.finance.clearFilters")}
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {t("managerAnalytics.finance.queueShowing", {
                          shown: data.finance.queue.length,
                          total: queueMeta?.total ?? data.finance.queue.length,
                        })}
                      </span>
                      {analyticsQuery.isFetching ? (
                        <Badge variant="secondary" className="rounded-full text-[10px]">
                          {t("managerAnalytics.finance.updating")}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setQueuePage((current) => Math.max(1, current - 1))}
                        disabled={!canQueuePrev}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Badge variant="outline" className="rounded-full">
                        {t("managerAnalytics.finance.pageOf", {
                          page: queueMeta?.page ?? queuePage,
                          pageCount: queueMeta?.pageCount ?? 1,
                        })}
                      </Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setQueuePage((current) => current + 1)}
                        disabled={!canQueueNext}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!data) return;
                        if (allVisibleSelected) {
                          setSelectedQueueIds([]);
                          return;
                        }
                        setSelectedQueueIds(data.finance.queue.map((item) => item.id));
                      }}
                    >
                      {allVisibleSelected
                        ? t("managerAnalytics.finance.clearSelection")
                        : t("managerAnalytics.finance.selectAllVisible")}
                    </Button>
                    <Badge variant="outline" className="rounded-full">
                      {t("managerAnalytics.finance.selectedCount", {
                        count: selectedCashItems.length,
                      })}
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => settleSelectedMutation.mutate()}
                      disabled={
                        selectedCashItems.length === 0 ||
                        settleSelectedMutation.isPending
                      }
                    >
                      <Wallet className="mr-2 h-4 w-4" />
                      {settleSelectedMutation.isPending
                        ? t("managerAnalytics.finance.settlingSelected")
                        : t("managerAnalytics.finance.settleSelected")}
                    </Button>

                    <Select
                      value={handoffToType}
                      onValueChange={(
                        value: "driver" | "warehouse" | "pickup_point",
                      ) => setHandoffToType(value)}
                    >
                      <SelectTrigger className="h-8 w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="warehouse">
                          {t("managerAnalytics.finance.handoffToWarehouse")}
                        </SelectItem>
                        <SelectItem value="pickup_point">
                          {t("managerAnalytics.finance.handoffToPickupPoint")}
                        </SelectItem>
                        <SelectItem value="driver">
                          {t("managerAnalytics.finance.handoffToDriver")}
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    {handoffToType === "driver" ? (
                      <Select
                        value={handoffToDriverId}
                        onValueChange={setHandoffToDriverId}
                      >
                        <SelectTrigger className="h-8 w-[220px]">
                          <SelectValue
                            placeholder={t(
                              "managerAnalytics.finance.selectDriverPlaceholder",
                            )}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {(driversQuery.data ?? []).map((driver) => (
                            <SelectItem key={driver.id} value={driver.id}>
                              {driver.name || driver.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Select
                        value={handoffToWarehouseId}
                        onValueChange={setHandoffToWarehouseId}
                      >
                        <SelectTrigger className="h-8 w-[240px]">
                          <SelectValue
                            placeholder={t(
                              "managerAnalytics.finance.selectWarehousePlaceholder",
                            )}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {handoffWarehouses.map((warehouse: any) => (
                            <SelectItem key={warehouse.id} value={warehouse.id}>
                              {warehouse.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handoffSelectedMutation.mutate()}
                      disabled={
                        selectedCashItems.length === 0 ||
                        !handoffDestinationReady ||
                        handoffSelectedMutation.isPending
                      }
                    >
                      <Wallet className="mr-2 h-4 w-4" />
                      {handoffSelectedMutation.isPending
                        ? t("managerAnalytics.finance.handingOffSelected")
                        : t("managerAnalytics.finance.handoffSelected")}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {data.finance.queue.length ? (
                  <div className="space-y-3">
                    {data.finance.queue.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border bg-background/80 p-4"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Checkbox
                                checked={selectedQueueIds.includes(item.id)}
                                onCheckedChange={(checked) => {
                                  setSelectedQueueIds((current) => {
                                    if (checked === true) {
                                      if (current.includes(item.id)) return current;
                                      return [...current, item.id];
                                    }
                                    return current.filter((id) => id !== item.id);
                                  });
                                }}
                                aria-label={`Select ${item.orderNumber || item.orderId}`}
                              />
                              <Badge variant="outline" className="rounded-full">
                                {item.orderNumber || item.orderId.slice(0, 8)}
                              </Badge>
                              <Badge variant="secondary" className="rounded-full">
                                {getStatusLabel(item.orderStatus, t)}
                              </Badge>
                              <Badge variant="outline" className="rounded-full">
                                {prettyCashStatus(item.status, t)}
                              </Badge>
                            </div>

                            <div className="text-sm font-medium">
                              {`${prettyCashKind(item.kind, t)} - ${
                                item.holderLabel || prettyHolderType(item.holderType, t)
                              }`}
                            </div>

                            <div className="text-xs text-muted-foreground">
                              {t("managerAnalytics.finance.ageHours", { count: item.ageHours })}
                            </div>
                          </div>

                          <div className="flex flex-col items-start gap-3 lg:items-end">
                            <div className="text-right">
                              <div className="text-lg font-semibold">
                                {formatMoney(item.amount, locale)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {item.currency || "EUR"}
                              </div>
                            </div>

                            <Button asChild size="sm" variant="outline">
                              <Link href={`/dashboard/manager/orders/${item.orderId}`}>
                                {t("managerAnalytics.finance.openOrder")}
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                    {t("managerAnalytics.finance.noQueue")}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="border-border/70">
              <CardHeader>
                <CardTitle>{t("managerAnalytics.sections.trend")}</CardTitle>
                <CardDescription>{data.period.rangeDays}d window</CardDescription>
              </CardHeader>
              <CardContent>
                {trendViewport.length ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border bg-background/80 px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          {t("managerAnalytics.trend.created")}
                        </div>
                        <div className="mt-1 text-2xl font-semibold">
                          {formatMoney(trendTotals.created, locale)}
                        </div>
                      </div>
                      <div className="rounded-2xl border bg-background/80 px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          {t("managerAnalytics.trend.delivered")}
                        </div>
                        <div className="mt-1 text-2xl font-semibold">
                          {formatMoney(trendTotals.delivered, locale)}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-background/80 p-4">
                      <div className="grid h-28 grid-cols-14 items-end gap-2">
                        {trendViewport.map((item) => {
                          return (
                          <div key={item.date} className="space-y-1">
                            <div className="flex h-20 items-end gap-1">
                              <div
                                className="w-1/2 rounded-t-md bg-sky-500/80"
                                style={{
                                  height: `${Math.max(
                                    8,
                                    (item.created / trendViewportPeak) * 100,
                                  )}%`,
                                }}
                                title={`${item.label} · ${t("managerAnalytics.trend.created")}: ${item.created}`}
                              />
                              <div
                                className="w-1/2 rounded-t-md bg-emerald-500/80"
                                style={{
                                  height: `${Math.max(
                                    8,
                                    (item.delivered / trendViewportPeak) * 100,
                                  )}%`,
                                }}
                                title={`${item.label} · ${t("managerAnalytics.trend.delivered")}: ${item.delivered}`}
                              />
                            </div>
                            <div className="truncate text-center text-[10px] text-muted-foreground">
                              {item.label}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-sky-500/80" />
                        {t("managerAnalytics.trend.created")}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                        {t("managerAnalytics.trend.delivered")}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">{t("managerAnalytics.trend.noData")}</div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader>
                <CardTitle>{t("managerAnalytics.sections.guidance")}</CardTitle>
                <CardDescription>{t("managerAnalytics.subtitle")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {guidance.map((note) => (
                  <div key={note} className="rounded-2xl border bg-background/80 px-4 py-3 text-sm text-foreground">
                    {note}
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <Card className="border-border/70">
              <CardHeader>
                <CardTitle>{t("managerAnalytics.breakdowns.status")}</CardTitle>
              </CardHeader>
              <CardContent>
                {data.breakdowns.status.length ? (
                  <div className="space-y-3">
                    {data.breakdowns.status
                      .sort((a, b) => b.count - a.count)
                      .map((item) => {
                        const pct = Math.max(4, Math.round((item.count / Math.max(1, data.overview.totalOrders)) * 100));
                        return (
                          <div key={item.status} className="space-y-1.5">
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <span>{getStatusLabel(item.status, t)}</span>
                              <span className="text-muted-foreground">{item.count}</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-slate-900" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">{t("managerAnalytics.breakdowns.noData")}</div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader>
                <CardTitle>{t("managerAnalytics.breakdowns.serviceType")}</CardTitle>
              </CardHeader>
              <CardContent>
                {data.breakdowns.serviceType.length ? (
                  <div className="space-y-3">
                    {data.breakdowns.serviceType
                      .sort((a, b) => b.count - a.count)
                      .map((item) => {
                        const pct = Math.max(4, Math.round((item.count / Math.max(1, data.overview.createdInRange)) * 100));
                        return (
                          <div key={item.serviceType} className="space-y-1.5">
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <span>{getServiceTypeLabel(item.serviceType, t)}</span>
                              <span className="text-muted-foreground">{item.count}</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-sky-500" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">{t("managerAnalytics.breakdowns.noData")}</div>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </PageShell>
  );
}
