"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Clock3, FilterX, RefreshCw, Route, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";

import PageShell from "@/components/layout/PageShell";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchManagerOpsMetrics,
  fetchDrivers,
  fetchManagerAnalyticsFinanceQueueV2,
  fetchManagerAnalyticsSummaryV2,
  fetchManagerAnalyticsTrendV2,
  fetchManagerAnalyticsWarningsV2,
  invalidateManagerAnalyticsV2,
  subscribeManagerAnalyticsStream,
  type ManagerAnalyticsV2FinanceQueue,
  type ManagerAnalyticsV2Summary,
  type ManagerAnalyticsV2Trend,
  type ManagerAnalyticsV2Warnings,
  type ManagerOpsMetrics,
} from "@/lib/manager";
import { handoffOrderCashBulk, settleOrderCashBulk } from "@/lib/orders";
import { fetchWarehouses } from "@/lib/warehouses";
import { getStatusLabel } from "@/lib/i18n/labels";
import { usePageVisibility } from "@/lib/usePageVisibility";

function formatMoney(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value || 0);
}

function formatPct(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value * 100)}%`;
}

function prettyEnum(value?: string | null) {
  if (!value) return "-";
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function prettyHolderType(
  value: string,
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  const key = `managerAnalytics.finance.holderTypes.${value}`;
  const translated = t(key);
  return translated === key ? prettyEnum(value) : translated;
}

function prettyCashKind(
  value: string,
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  const key = `orderDetails.cash.kind.${value}`;
  const translated = t(key);
  return translated === key ? prettyEnum(value) : translated;
}

function prettyCashStatus(
  value: string,
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  const key = `orderDetails.cash.status.${value}`;
  const translated = t(key);
  return translated === key ? prettyEnum(value) : translated;
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

type HandoffType = "driver" | "warehouse" | "pickup_point";
type AnalyticsInvalidateKey = "summary" | "trend" | "warnings" | "finance-queue" | "ops";

export function ManagerAnalyticsV2Page() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const isPageVisible = usePageVisibility();
  const searchParams = useSearchParams();
  const showDebugMetrics =
    process.env.NEXT_PUBLIC_ANALYTICS_DEBUG_METRICS === "true" &&
    searchParams.get("ops") === "1";

  const [rangeDays, setRangeDays] = useState("30");
  const [queueStatus, setQueueStatus] = useState<"all" | "expected" | "held">("all");
  const [queueKind, setQueueKind] = useState<"all" | "cod" | "service_charge">("all");
  const [queueHolderType, setQueueHolderType] = useState<
    "all" | "driver" | "warehouse" | "pickup_point" | "none"
  >("all");
  const [queuePage, setQueuePage] = useState(1);
  const [showQueue, setShowQueue] = useState(false);
  const [selectedQueueIds, setSelectedQueueIds] = useState<string[]>([]);
  const [handoffToType, setHandoffToType] = useState<HandoffType>("warehouse");
  const [handoffToDriverId, setHandoffToDriverId] = useState("");
  const [handoffToWarehouseId, setHandoffToWarehouseId] = useState("");
  const [streamConnectedAt, setStreamConnectedAt] = useState<string | null>(null);
  const lastScheduledRefreshAtRef = useRef(0);
  const lastInvalidateAtRef = useRef<Record<AnalyticsInvalidateKey, number>>({
    summary: 0,
    trend: 0,
    warnings: 0,
    "finance-queue": 0,
    ops: 0,
  });
  const pendingInvalidateKeysRef = useRef<Set<AnalyticsInvalidateKey>>(new Set());
  const invalidateFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const summaryQuery = useQuery<ManagerAnalyticsV2Summary, Error>({
    queryKey: ["manager-analytics-v2-summary", rangeDays],
    queryFn: () => fetchManagerAnalyticsSummaryV2({ rangeDays: Number(rangeDays) }),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const summaryStaleHours = summaryQuery.data?.period?.staleHours ?? 48;

  const trendQuery = useQuery<ManagerAnalyticsV2Trend, Error>({
    queryKey: ["manager-analytics-v2-trend", rangeDays],
    queryFn: () => fetchManagerAnalyticsTrendV2({ rangeDays: Number(rangeDays) }),
    enabled: Boolean(summaryQuery.data),
    staleTime: 90_000,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const warningsQuery = useQuery<ManagerAnalyticsV2Warnings, Error>({
    queryKey: ["manager-analytics-v2-warnings", rangeDays, summaryStaleHours],
    queryFn: () =>
      fetchManagerAnalyticsWarningsV2({
        rangeDays: Number(rangeDays),
        staleHours: summaryStaleHours,
      }),
    enabled: Boolean(summaryQuery.data),
    staleTime: 90_000,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const financeQueueQuery = useQuery<ManagerAnalyticsV2FinanceQueue, Error>({
    queryKey: [
      "manager-analytics-v2-finance-queue",
      queueStatus,
      queueKind,
      queueHolderType,
      queuePage,
    ],
    queryFn: () =>
      fetchManagerAnalyticsFinanceQueueV2({
        queuePage,
        queuePageSize: 20,
        queueStatuses: queueStatus === "all" ? [] : [queueStatus],
        queueKinds: queueKind === "all" ? [] : [queueKind],
        queueHolderTypes: queueHolderType === "all" ? [] : [queueHolderType],
      }),
    enabled: Boolean(summaryQuery.data) && showQueue,
    staleTime: 45_000,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const driversQuery = useQuery({
    queryKey: ["manager-drivers-for-cash-handoff"],
    queryFn: fetchDrivers,
    staleTime: 180_000,
    enabled: showQueue && handoffToType === "driver",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const warehousesQuery = useQuery({
    queryKey: ["manager-warehouses-for-cash-handoff"],
    queryFn: fetchWarehouses,
    staleTime: 180_000,
    enabled: showQueue && handoffToType !== "driver",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const opsMetricsQuery = useQuery<ManagerOpsMetrics, Error>({
    queryKey: ["manager-ops-metrics"],
    queryFn: fetchManagerOpsMetrics,
    enabled: showDebugMetrics,
    staleTime: 45_000,
    refetchInterval: isPageVisible ? 90_000 : false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    if (!isPageVisible) return;

    const flushPendingInvalidates = () => {
      if (invalidateFlushTimerRef.current) {
        clearTimeout(invalidateFlushTimerRef.current);
        invalidateFlushTimerRef.current = null;
      }
      if (pendingInvalidateKeysRef.current.size === 0) return;

      const keys = [...pendingInvalidateKeysRef.current];
      pendingInvalidateKeysRef.current.clear();

      for (const key of keys) {
        if (key === "summary") {
          queryClient.invalidateQueries({ queryKey: ["manager-analytics-v2-summary"] });
        } else if (key === "trend") {
          queryClient.invalidateQueries({ queryKey: ["manager-analytics-v2-trend"] });
        } else if (key === "warnings") {
          queryClient.invalidateQueries({ queryKey: ["manager-analytics-v2-warnings"] });
        } else if (key === "finance-queue") {
          queryClient.invalidateQueries({ queryKey: ["manager-analytics-v2-finance-queue"] });
        } else if (key === "ops") {
          queryClient.invalidateQueries({ queryKey: ["manager-ops-metrics"] });
        }
      }
    };

    const scheduleInvalidate = (key: AnalyticsInvalidateKey) => {
      pendingInvalidateKeysRef.current.add(key);
      if (invalidateFlushTimerRef.current) return;
      invalidateFlushTimerRef.current = setTimeout(flushPendingInvalidates, 220);
    };

    const maybeInvalidate = (key: AnalyticsInvalidateKey, minGapMs: number) => {
      const now = Date.now();
      if (now - lastInvalidateAtRef.current[key] < minGapMs) return;
      lastInvalidateAtRef.current[key] = now;
      scheduleInvalidate(key);
    };

    const unsubscribe = subscribeManagerAnalyticsStream({
      onReady: (payload) => {
        setStreamConnectedAt(payload.connectedAt ?? new Date().toISOString());
      },
      onRefresh: (payload) => {
        const reason = String(payload?.reason ?? "");
        const nowMs = Date.now();
        if (reason === "scheduled") {
          if (nowMs - lastScheduledRefreshAtRef.current < 120_000) {
            return;
          }
          lastScheduledRefreshAtRef.current = nowMs;
        }

        const keys =
          Array.isArray(payload?.keys) && payload.keys.length > 0
            ? payload.keys
            : (["summary", "trend", "warnings", "finance-queue"] as const);

        const effectiveKeys =
          reason === "scheduled"
            ? keys.filter((key) => key === "summary" || key === "trend")
            : keys;

        if (effectiveKeys.includes("summary")) {
          maybeInvalidate("summary", reason === "scheduled" ? 30_000 : 10_000);
        }
        if (effectiveKeys.includes("trend")) {
          maybeInvalidate("trend", reason === "scheduled" ? 30_000 : 10_000);
        }
        if (effectiveKeys.includes("warnings")) {
          maybeInvalidate("warnings", 15_000);
        }
        if (showQueue && effectiveKeys.includes("finance-queue")) {
          maybeInvalidate("finance-queue", 20_000);
        }
        if (reason !== "scheduled") {
          maybeInvalidate("ops", 20_000);
        }
      },
      onError: () => setStreamConnectedAt(null),
    });
    return () => {
      unsubscribe();
      flushPendingInvalidates();
    };
  }, [isPageVisible, queryClient, showQueue]);

  const data = summaryQuery.data;
  const trend = trendQuery.data?.trend;
  const warnings = warningsQuery.data;
  const queue = financeQueueQuery.data;
  const ops = opsMetricsQuery.data;
  const queueItems = useMemo(() => queue?.queue ?? [], [queue?.queue]);

  const selectedQueueItems = useMemo(() => {
    if (!queueItems.length) return [];
    const visible = new Set(queueItems.map((item) => item.id));
    const selected = new Set(selectedQueueIds);
    return queueItems.filter((item) => visible.has(item.id) && selected.has(item.id));
  }, [queueItems, selectedQueueIds]);

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

  const handoffDestinationReady =
    handoffToType === "driver" ? Boolean(handoffToDriverId) : Boolean(handoffToWarehouseId);

  const handoffWarehouses = useMemo(() => {
    const list = Array.isArray(warehousesQuery.data) ? warehousesQuery.data : [];
    return list.filter((warehouse) => {
      const normalizedType = String(warehouse?.type || "warehouse");
      return handoffToType === "pickup_point"
        ? normalizedType === "pickup_point"
        : normalizedType === "warehouse";
    });
  }, [handoffToType, warehousesQuery.data]);

  const canSettleSelected = selectedCashItems.length > 0;

  const settleSelectedMutation = useMutation({
    mutationFn: async () => settleOrderCashBulk({ items: selectedCashItems }),
    onSuccess: async (result) => {
      const success = Number(result?.count ?? 0);
      const failed = Number(result?.failedCount ?? 0);
      if (success > 0 && failed === 0) {
        toast.success(t("managerAnalytics.finance.settleSelectedSuccess", { count: success }));
      } else if (success > 0) {
        toast.warning(
          t("managerAnalytics.finance.settleSelectedPartial", { success, failed }),
        );
      } else {
        toast.error(t("managerAnalytics.finance.settleSelectedFailed"));
      }
      setSelectedQueueIds([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["manager-analytics-v2-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["manager-analytics-v2-finance-queue"] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
      ]);
    },
    onError: () => toast.error(t("managerAnalytics.finance.settleSelectedFailed")),
  });

  const handoffSelectedMutation = useMutation({
    mutationFn: async () =>
      handoffOrderCashBulk({
        items: selectedCashItems,
        toHolderType: handoffToType,
        toDriverId: handoffToType === "driver" ? handoffToDriverId : null,
        toWarehouseId: handoffToType === "driver" ? null : handoffToWarehouseId,
      }),
    onSuccess: async (result) => {
      const success = Number(result?.count ?? 0);
      const failed = Number(result?.failedCount ?? 0);
      if (success > 0 && failed === 0) {
        toast.success(t("managerAnalytics.finance.handoffSelectedSuccess", { count: success }));
      } else if (success > 0) {
        toast.warning(
          t("managerAnalytics.finance.handoffSelectedPartial", { success, failed }),
        );
      } else {
        toast.error(t("managerAnalytics.finance.handoffSelectedFailed"));
      }
      setSelectedQueueIds([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["manager-analytics-v2-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["manager-analytics-v2-finance-queue"] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
      ]);
    },
    onError: () => toast.error(t("managerAnalytics.finance.handoffSelectedFailed")),
  });

  const trendPeak = useMemo(() => {
    if (!trend?.created?.length) return 1;
    return Math.max(1, ...trend.created.flatMap((row, i) => [row.count, trend.delivered[i]?.count ?? 0]));
  }, [trend]);

  const trendCreated = useMemo(() => trend?.created?.slice(-14) ?? [], [trend?.created]);
  const trendDelivered = useMemo(() => trend?.delivered?.slice(-14) ?? [], [trend?.delivered]);

  const refreshAll = async () => {
    await invalidateManagerAnalyticsV2();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["manager-analytics-v2-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["manager-analytics-v2-trend"] }),
      queryClient.invalidateQueries({ queryKey: ["manager-analytics-v2-warnings"] }),
      queryClient.invalidateQueries({ queryKey: ["manager-analytics-v2-finance-queue"] }),
    ]);
  };

  const heldByDriver = queueItems
    .filter((item) => item.status === "held" && item.holderType === "driver")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const heldByWarehouse = queueItems
    .filter((item) => item.status === "held" && item.holderType === "warehouse")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const heldByPickup = queueItems
    .filter((item) => item.status === "held" && item.holderType === "pickup_point")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

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

          <div className="flex flex-wrap items-center gap-3">
            <Select value={rangeDays} onValueChange={setRangeDays}>
              <SelectTrigger className="w-[180px] bg-background/90"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">{t("managerAnalytics.filters.last7Days")}</SelectItem>
                <SelectItem value="30">{t("managerAnalytics.filters.last30Days")}</SelectItem>
                <SelectItem value="90">{t("managerAnalytics.filters.last90Days")}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={refreshAll} disabled={summaryQuery.isFetching}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("managerAnalytics.refresh")}
            </Button>
            <Badge variant="outline" className="rounded-full">
              {streamConnectedAt ? "SSE live" : "SSE reconnecting"}
            </Badge>
          </div>
        </div>
      </section>

      {!data && summaryQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <Skeleton key={idx} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : null}

      {data ? (
        <>
          {showDebugMetrics && ops ? (
            <section className="grid gap-4 xl:grid-cols-[1.05fr_1fr]">
              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle>Ops Metrics</CardTitle>
                  <CardDescription>
                    Generated {new Date(ops.generatedAt).toLocaleTimeString(locale)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border bg-background/80 p-3">
                    <div className="text-xs text-muted-foreground">Cache hit ratio</div>
                    <div className="mt-1 text-lg font-semibold">
                      {formatPct(ops.analytics.totals.cacheHitRatio)}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-background/80 p-3">
                    <div className="text-xs text-muted-foreground">Summary p95</div>
                    <div className="mt-1 text-lg font-semibold">
                      {Math.round(ops.analytics.summary.p95Ms)} ms
                    </div>
                  </div>
                  <div className="rounded-xl border bg-background/80 p-3">
                    <div className="text-xs text-muted-foreground">Worker lag</div>
                    <div className="mt-1 text-lg font-semibold">
                      {Math.round(ops.worker.lastLagMs)} ms
                    </div>
                  </div>
                  <div className="rounded-xl border bg-background/80 p-3">
                    <div className="text-xs text-muted-foreground">Analytics SSE</div>
                    <div className="mt-1 text-lg font-semibold">
                      {ops.sse.analytics.active} active
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle>Alert Signals</CardTitle>
                  <CardDescription>Realtime health flags for analytics and streams</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Badge variant={ops.alerts.cacheHitBelowThreshold ? "destructive" : "secondary"}>
                    Cache hit threshold
                  </Badge>
                  <Badge variant={ops.alerts.summaryP95Slow ? "destructive" : "secondary"}>
                    Summary p95
                  </Badge>
                  <Badge variant={ops.alerts.financeQueueP95Slow ? "destructive" : "secondary"}>
                    Finance queue p95
                  </Badge>
                  <Badge variant={ops.alerts.workerLagHigh ? "destructive" : "secondary"}>
                    Worker lag
                  </Badge>
                  <Badge variant={ops.alerts.analyticsReconnectSpike ? "destructive" : "secondary"}>
                    Analytics reconnects
                  </Badge>
                  <Badge variant={ops.alerts.liveMapReconnectSpike ? "destructive" : "secondary"}>
                    Live map reconnects
                  </Badge>
                </CardContent>
              </Card>
            </section>
          ) : null}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title={t("managerAnalytics.cards.createdInRange")} value={data.overview.createdInRange} icon={TrendingUp} tone="bg-sky-500/10 text-sky-600" />
            <StatCard title={t("managerAnalytics.cards.openOrders")} value={data.overview.openOrders} icon={Route} tone="bg-slate-900/10 text-slate-700" />
            <StatCard title={t("managerAnalytics.cards.deliveredInRange")} value={data.overview.deliveredInRange} icon={Clock3} tone="bg-emerald-500/10 text-emerald-600" />
            <StatCard title={t("managerAnalytics.cards.exceptionOpenOrders")} value={data.overview.exceptionOpenOrders} icon={AlertTriangle} tone="bg-amber-500/10 text-amber-700" />
            <StatCard title={t("managerAnalytics.finance.pendingInvoices")} value={data.finance.pendingInvoicesCount} icon={Wallet} tone="bg-rose-500/10 text-rose-600" />
            <StatCard title={t("managerAnalytics.finance.unpaidCodCount")} value={data.finance.unpaidCodCount} icon={Wallet} tone="bg-orange-500/10 text-orange-600" />
            <StatCard title={t("managerAnalytics.finance.unpaidServiceCount")} value={data.finance.unpaidServiceCount} icon={Wallet} tone="bg-violet-500/10 text-violet-600" />
            <StatCard title={t("managerAnalytics.cards.paidInvoiced")} value={formatMoney(data.finance.invoicedPaidAmount, locale)} icon={Wallet} tone="bg-emerald-500/10 text-emerald-700" />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-border/70">
              <CardHeader>
                <CardTitle>{t("managerAnalytics.sections.trend")}</CardTitle>
                <CardDescription>{data.period.rangeDays}d window</CardDescription>
              </CardHeader>
              <CardContent>
                {!trend ? (
                  <Skeleton className="h-40 rounded-2xl" />
                ) : (
                  <div className="overflow-x-auto rounded-2xl border bg-background/80 p-4">
                    <div className="grid h-28 min-w-[560px] grid-cols-14 items-end gap-2">
                      {trendCreated.map((item, idx) => {
                        const delivered = trendDelivered[idx]?.count ?? 0;
                        return (
                          <div key={item.date} className="space-y-1">
                            <div className="flex h-20 items-end gap-1">
                              <div className="w-1/2 rounded-t-md bg-sky-500/80" style={{ height: `${Math.max(8, (item.count / trendPeak) * 100)}%` }} />
                              <div className="w-1/2 rounded-t-md bg-emerald-500/80" style={{ height: `${Math.max(8, (delivered / trendPeak) * 100)}%` }} />
                            </div>
                            <div className="truncate text-center text-[10px] text-muted-foreground">{item.date.slice(5)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader>
                <CardTitle>{t("managerAnalytics.sections.guidance")}</CardTitle>
                <CardDescription>{t("managerAnalytics.subtitle")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!warnings ? (
                  <Skeleton className="h-36 rounded-2xl" />
                ) : (
                  <>
                    <div className="rounded-2xl border bg-background/80 px-4 py-3 text-sm">
                      {t("managerAnalytics.guidance.overdue", { count: warnings.overdueTotal })}
                    </div>
                    <div className="rounded-2xl border bg-background/80 px-4 py-3 text-sm">
                      {t("managerAnalytics.guidance.stale", { count: warnings.staleTotal })}
                    </div>
                    <div className="rounded-2xl border bg-background/80 px-4 py-3 text-sm">
                      {t("managerAnalytics.guidance.finance", { count: warnings.financeExposureTotal })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="space-y-4">
            <Card className="border-border/70">
              <CardHeader className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle>{t("managerAnalytics.sections.finance")}</CardTitle>
                    <CardDescription>{t("managerAnalytics.finance.snapshot")}</CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant={showQueue ? "outline" : "default"}
                    onClick={() => setShowQueue((value) => !value)}
                  >
                    {showQueue
                      ? t("common.close") === "common.close"
                        ? "Close"
                        : t("common.close")
                      : t("managerAnalytics.sections.cashQueue")}
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border bg-background/80 p-3">
                    <div className="text-xs text-muted-foreground">{t("managerAnalytics.finance.serviceChargeExpected")}</div>
                    <div className="mt-1 text-lg font-semibold">{formatMoney(data.finance.serviceChargeExpected, locale)}</div>
                  </div>
                  <div className="rounded-xl border bg-background/80 p-3">
                    <div className="text-xs text-muted-foreground">{t("managerAnalytics.finance.codExpected")}</div>
                    <div className="mt-1 text-lg font-semibold">{formatMoney(data.finance.codExpected, locale)}</div>
                  </div>
                  <div className="rounded-xl border bg-background/80 p-3">
                    <div className="text-xs text-muted-foreground">{t("managerAnalytics.finance.driverHeld")}</div>
                    <div className="mt-1 text-lg font-semibold">{formatMoney(heldByDriver, locale)}</div>
                  </div>
                  <div className="rounded-xl border bg-background/80 p-3">
                    <div className="text-xs text-muted-foreground">{t("managerAnalytics.finance.warehouseHeld")}</div>
                    <div className="mt-1 text-lg font-semibold">{formatMoney(heldByWarehouse + heldByPickup, locale)}</div>
                  </div>
                </div>
              </CardHeader>
              {showQueue ? (
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={queueStatus}
                      onValueChange={(value: "all" | "expected" | "held") => {
                        setQueueStatus(value);
                        setQueuePage(1);
                      }}
                    >
                      <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("managerAnalytics.finance.filterStatusAll")}</SelectItem>
                        <SelectItem value="expected">Expected</SelectItem>
                        <SelectItem value="held">Held</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={queueKind}
                      onValueChange={(value: "all" | "cod" | "service_charge") => {
                        setQueueKind(value);
                        setQueuePage(1);
                      }}
                    >
                      <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("managerAnalytics.finance.filterKindAll")}</SelectItem>
                        <SelectItem value="cod">COD</SelectItem>
                        <SelectItem value="service_charge">Service charge</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={queueHolderType}
                      onValueChange={(value: "all" | "driver" | "warehouse" | "pickup_point" | "none") => {
                        setQueueHolderType(value);
                        setQueuePage(1);
                      }}
                    >
                      <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("managerAnalytics.finance.filterHolderAll")}</SelectItem>
                        <SelectItem value="driver">{prettyHolderType("driver", t)}</SelectItem>
                        <SelectItem value="warehouse">{prettyHolderType("warehouse", t)}</SelectItem>
                        <SelectItem value="pickup_point">{prettyHolderType("pickup_point", t)}</SelectItem>
                        <SelectItem value="none">{prettyHolderType("none", t)}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" onClick={() => {
                      setQueueStatus("all");
                      setQueueKind("all");
                      setQueueHolderType("all");
                      setQueuePage(1);
                      setSelectedQueueIds([]);
                    }}>
                      <FilterX className="mr-2 h-4 w-4" />
                      {t("managerAnalytics.finance.clearFilters")}
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-background/80 p-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedQueueIds(queueItems.map((item) => item.id))}
                      disabled={!queueItems.length}
                    >
                      {t("managerAnalytics.finance.selectAllVisible")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedQueueIds([])}
                      disabled={!selectedQueueIds.length}
                    >
                      {t("managerAnalytics.finance.clearSelection")}
                    </Button>
                    <Badge variant="outline">
                      {t("managerAnalytics.finance.selectedCount", { count: selectedCashItems.length })}
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => settleSelectedMutation.mutate()}
                      disabled={!canSettleSelected || settleSelectedMutation.isPending}
                    >
                      {settleSelectedMutation.isPending
                        ? t("managerAnalytics.finance.settlingSelected")
                        : t("managerAnalytics.finance.settleSelected")}
                    </Button>
                    <Select
                      value={handoffToType}
                      onValueChange={(value: HandoffType) => {
                        setHandoffToType(value);
                        setHandoffToDriverId("");
                        setHandoffToWarehouseId("");
                      }}
                    >
                      <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="warehouse">{t("managerAnalytics.finance.handoffToWarehouse")}</SelectItem>
                        <SelectItem value="pickup_point">{t("managerAnalytics.finance.handoffToPickupPoint")}</SelectItem>
                        <SelectItem value="driver">{t("managerAnalytics.finance.handoffToDriver")}</SelectItem>
                      </SelectContent>
                    </Select>
                    {handoffToType === "driver" ? (
                      <Select value={handoffToDriverId} onValueChange={setHandoffToDriverId}>
                        <SelectTrigger className="w-[220px]"><SelectValue placeholder={t("managerAnalytics.finance.selectDriverPlaceholder")} /></SelectTrigger>
                        <SelectContent>
                          {(driversQuery.data ?? []).map((driver) => (
                            <SelectItem key={driver.id} value={driver.id}>{driver.name || driver.email}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Select value={handoffToWarehouseId} onValueChange={setHandoffToWarehouseId}>
                        <SelectTrigger className="w-[240px]"><SelectValue placeholder={t("managerAnalytics.finance.selectWarehousePlaceholder")} /></SelectTrigger>
                        <SelectContent>
                          {handoffWarehouses.map((warehouse) => (
                            <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handoffSelectedMutation.mutate()}
                      disabled={!canSettleSelected || !handoffDestinationReady || handoffSelectedMutation.isPending}
                    >
                      {handoffSelectedMutation.isPending
                        ? t("managerAnalytics.finance.handingOffSelected")
                        : t("managerAnalytics.finance.handoffSelected")}
                    </Button>
                  </div>

                  {!queue && financeQueueQuery.isLoading ? (
                    <Skeleton className="h-40 rounded-2xl" />
                  ) : queueItems.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                      {t("managerAnalytics.finance.noQueue")}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {queueItems.map((item) => (
                        <div key={item.id} className="rounded-2xl border bg-background/80 p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Checkbox
                                  checked={selectedQueueIds.includes(item.id)}
                                  onCheckedChange={(checked) => {
                                    setSelectedQueueIds((current) =>
                                      checked === true
                                        ? current.includes(item.id)
                                          ? current
                                          : [...current, item.id]
                                        : current.filter((id) => id !== item.id),
                                    );
                                  }}
                                  aria-label={`Select ${item.orderNumber || item.orderId}`}
                                />
                                <Badge variant="outline" className="rounded-full">
                                  {item.orderNumber ? `#${item.orderNumber}` : item.orderId.slice(0, 8)}
                                </Badge>
                                <Badge variant="secondary" className="rounded-full">
                                  {getStatusLabel(item.orderStatus, t)}
                                </Badge>
                                <Badge variant="outline" className="rounded-full">
                                  {prettyCashStatus(item.status, t)}
                                </Badge>
                              </div>
                              <div className="text-sm font-medium">
                                {prettyCashKind(item.kind, t)} - {item.holderLabel || prettyHolderType(item.holderType, t)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {t("managerAnalytics.finance.ageHours", { count: item.ageHours })}
                              </div>
                            </div>
                            <div className="flex flex-col items-start gap-3 lg:items-end">
                              <div className="text-right">
                                <div className="text-lg font-semibold">{formatMoney(item.amount, locale)}</div>
                                <div className="text-xs text-muted-foreground">{item.currency || "UZS"}</div>
                              </div>
                              <Button asChild size="sm" variant="outline">
                                <Link href={`/dashboard/manager/orders/${item.orderId}`}>{t("managerAnalytics.finance.openOrder")}</Link>
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center justify-between pt-1 text-sm">
                        <span>
                          {t("managerAnalytics.finance.pageOf", {
                            page: queue?.queueMeta?.page ?? 1,
                            pageCount: queue?.queueMeta?.pageCount ?? 1,
                          })}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setQueuePage((p) => Math.max(1, p - 1))}
                            disabled={!queue?.queueMeta?.hasPrev}
                          >
                            Prev
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setQueuePage((p) => p + 1)}
                            disabled={!queue?.queueMeta?.hasNext}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              ) : null}
            </Card>
          </section>
        </>
      ) : null}
    </PageShell>
  );
}
