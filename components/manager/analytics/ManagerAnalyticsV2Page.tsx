"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  FileText,
  FolderOpen,
  Info,
  MoreVertical,
  RadioTower,
  RefreshCw,
  Route,
  Send,
  Wallet,
  WalletCards,
} from "lucide-react";
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
import { cn } from "@/lib/utils";

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
  delta,
  trend = "up",
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  delta?: string;
  trend?: "up" | "down" | "flat";
}) {
  return (
    <Card className="group gap-0 rounded-lg border-border/70 bg-white py-0 shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <CardContent className="flex min-h-[94px] items-center gap-3 p-3">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", tone)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-slate-600">{title}</p>
          <div className="mt-1 text-xl font-semibold leading-none tracking-tight text-slate-950">{value}</div>
          <p className="mt-2 truncate text-[11px] text-slate-500">
            <span
              className={cn(
                "mr-1 font-semibold",
                trend === "down" ? "text-emerald-600" : trend === "flat" ? "text-slate-500" : "text-red-600",
              )}
            >
              {trend === "down" ? "↓" : trend === "flat" ? "→" : "↑"}
            </span>
            {delta ?? "vs prior 7d"}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-slate-700" />
      </CardContent>
    </Card>
  );
}

function BottleneckCard({
  title,
  value,
  icon: Icon,
  tone,
  delta,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "red" | "orange";
  delta: string;
}) {
  const palette =
    tone === "red"
      ? "border-red-200 bg-red-50/55 text-red-700"
      : "border-orange-200 bg-orange-50/55 text-orange-700";

  return (
    <Card className={cn("group gap-0 rounded-lg py-0 shadow-sm transition hover:shadow-md", palette)}>
      <CardContent className="flex min-h-[86px] items-center gap-4 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/75">
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-700">{title}</p>
          <div className="mt-1 flex items-end gap-3">
            <span className="text-2xl font-semibold leading-none text-slate-950">{value}</span>
            <span className="pb-0.5 text-xs font-medium text-red-600">↑ {delta}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">vs prior 7d</p>
        </div>
        <ChevronRight className="h-4 w-4 text-slate-900" />
      </CardContent>
    </Card>
  );
}

function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("gap-0 overflow-hidden rounded-lg border-border/70 bg-white py-0 shadow-sm", className)}>
      <CardHeader className="border-b bg-white !px-4 !py-0">
        <div className="flex h-12 items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              {title}
              <Info className="h-3.5 w-3.5 text-slate-400" />
            </CardTitle>
            {description ? (
              <CardDescription className="mt-1 truncate text-xs">{description}</CardDescription>
            ) : null}
          </div>
          {action}
        </div>
      </CardHeader>
      {children}
    </Card>
  );
}

function FinanceMetricTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <div className="flex min-h-[70px] items-center justify-between rounded-lg border bg-white px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-[11px] text-slate-500">{label}</p>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-xl font-semibold tracking-tight text-slate-950">{value}</span>
          <span className="text-[10px] font-medium text-slate-500">UZS</span>
        </div>
      </div>
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", tone)}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
  );
}

function RiskPill({ score }: { score: number }) {
  const tone =
    score >= 85
      ? "border-red-200 bg-red-50 text-red-700"
      : score >= 65
        ? "border-orange-200 bg-orange-50 text-orange-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", tone)}>{score}</span>;
}

function statusTone(status?: string | null) {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized === "delivered") return "bg-emerald-500";
  if (normalized === "pending") return "bg-orange-500";
  if (normalized === "assigned") return "bg-blue-500";
  if (normalized === "at_warehouse") return "bg-cyan-600";
  if (normalized === "exception" || normalized === "cancelled") return "bg-red-500";
  return "bg-teal-500";
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
  const [showQueue] = useState(true);
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
    enabled: showQueue,
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
          maybeInvalidate("summary", reason === "scheduled" ? 30_000 : 1_500);
        }
        if (effectiveKeys.includes("trend")) {
          maybeInvalidate("trend", reason === "scheduled" ? 30_000 : 5_000);
        }
        if (effectiveKeys.includes("warnings")) {
          maybeInvalidate("warnings", reason === "scheduled" ? 15_000 : 3_000);
        }
        if (showQueue && effectiveKeys.includes("finance-queue")) {
          maybeInvalidate("finance-queue", reason === "scheduled" ? 20_000 : 4_000);
        }
        if (reason !== "scheduled") {
          maybeInvalidate("ops", 10_000);
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

  const selectedTotal = selectedQueueItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const selectedServiceChargeCount = selectedQueueItems.filter((item) => item.kind === "service_charge").length;
  const selectedCodCount = selectedQueueItems.filter((item) => item.kind === "cod").length;

  const riskScoreForQueueItem = (item: (typeof queueItems)[number]) => {
    const ageScore = Math.min(45, Math.round(Number(item.ageHours || 0) / 6));
    const statusScore = item.orderStatus === "exception" ? 35 : item.orderStatus === "at_warehouse" ? 18 : 10;
    const moneyScore = Number(item.amount || 0) > 100_000 ? 22 : Number(item.amount || 0) > 30_000 ? 14 : 6;
    return Math.max(30, Math.min(98, ageScore + statusScore + moneyScore));
  };

  const queueGroups = [
    {
      key: "expected",
      title: "Expected",
      items: queueItems.filter((item) => item.status === "expected"),
    },
    {
      key: "held-driver",
      title: "Held by driver",
      items: queueItems.filter((item) => item.status === "held" && item.holderType === "driver"),
    },
    {
      key: "held-network",
      title: "Held by warehouse / pickup point",
      items: queueItems.filter(
        (item) =>
          item.status === "held" &&
          (item.holderType === "warehouse" || item.holderType === "pickup_point"),
      ),
    },
  ];

  const riskPriorityItems = [
    ...(warnings?.overdueOrders ?? []).map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      score: 92,
      reason: "SLA risk",
    })),
    ...(warnings?.financeExposureOrders ?? []).map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      score: 74,
      reason: "Payment risk",
    })),
    ...(warnings?.staleOrders ?? []).map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      score: 61,
      reason: "Stale movement",
    })),
  ].slice(0, 4);

  const latestTrendIndex = Math.max(0, trendCreated.length - 1);
  const latestCreated = trendCreated[latestTrendIndex]?.count ?? 0;
  const latestDelivered = trendDelivered[latestTrendIndex]?.count ?? 0;
  const latestTrendDate = trendCreated[latestTrendIndex]?.date ?? "";
  const trendChartRows = useMemo(() => {
    return trendCreated.map((item, idx) => ({
      date: item.date,
      label: item.date.slice(5),
      created: item.count,
      delivered: trendDelivered[idx]?.count ?? 0,
      exceptions: idx === latestTrendIndex ? data?.overview?.exceptionOpenOrders ?? 0 : 0,
    }));
  }, [data?.overview?.exceptionOpenOrders, latestTrendIndex, trendCreated, trendDelivered]);
  const trendChartMax = Math.max(
    1,
    ...trendChartRows.flatMap((row) => [row.created, row.delivered, row.exceptions]),
  );
  const chartLeft = 44;
  const chartTop = 22;
  const chartWidth = 690;
  const chartHeight = 220;
  const chartBottom = chartTop + chartHeight;
  const chartStep = trendChartRows.length > 1 ? chartWidth / (trendChartRows.length - 1) : chartWidth;
  const chartY = (value: number) => chartBottom - (value / trendChartMax) * chartHeight;
  const deliveredPolyline = trendChartRows
    .map((row, idx) => `${chartLeft + idx * chartStep},${chartY(row.delivered)}`)
    .join(" ");
  const exceptionPolyline = trendChartRows
    .map((row, idx) => `${chartLeft + idx * chartStep},${chartY(row.exceptions)}`)
    .join(" ");
  const financeExposureTotal = data
    ? data.finance.codExpected + data.finance.serviceChargeExpected + heldByDriver + heldByWarehouse + heldByPickup
    : 0;
  const warehousePressure = data
    ? Math.round((data.operations.atWarehouseOrders / Math.max(1, data.overview.openOrders)) * 100)
    : 0;
  const queueTotal = queue?.queueMeta?.total ?? queueItems.length;
  const activityRows = [
    {
      title: selectedCashItems.length ? "Settlement ready" : "Settlement completed",
      detail: selectedCashItems.length
        ? `${formatMoney(selectedTotal, locale)} UZS selected for settlement`
        : `${formatMoney(Math.max(0, data?.finance.serviceChargeExpected ?? 0), locale)} UZS monitored for finance`,
      time: "5m ago",
      icon: CheckCircle2,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      title: "Handoff created",
      detail: handoffDestinationReady ? "Cash handoff destination selected" : "Cash queue waiting for custody action",
      time: "18m ago",
      icon: Send,
      tone: "bg-violet-50 text-violet-700",
    },
    {
      title: "Redis stream refresh",
      detail: "manager.analytics · summary + finance",
      time: streamConnectedAt ? "32m ago" : "pending",
      icon: RadioTower,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      title: "Order opened",
      detail: `${queueTotal} finance queue item(s) visible`,
      time: "45m ago",
      icon: Activity,
      tone: "bg-blue-50 text-blue-700",
    },
  ];

  return (
    <PageShell className="bg-white">
      <div className="space-y-4">
        <section className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Analytics</h1>
            <p className="mt-1 text-sm text-slate-500">
              Redis-streamed operational metrics, finance exposure, and guidance.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex h-9 overflow-hidden rounded-md border bg-white shadow-sm">
              {[
                ["7", "7d"],
                ["30", "30d"],
                ["90", "90d"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRangeDays(value)}
                  className={cn(
                    "min-w-14 px-4 text-sm font-medium transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                    rangeDays === value ? "bg-slate-100 text-slate-950" : "text-slate-500",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              onClick={refreshAll}
              disabled={summaryQuery.isFetching}
              className="h-9 rounded-md bg-white shadow-sm hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 focus-visible:ring-blue-500"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("managerAnalytics.refresh")}
            </Button>
            <Badge className="h-9 rounded-md border border-emerald-200 bg-emerald-50 px-4 text-sm font-medium text-emerald-700 hover:bg-emerald-50">
              <span className="mr-2 h-2.5 w-2.5 rounded-full bg-emerald-500" />
              SSE Live
            </Badge>
          </div>
        </section>

        <section className="flex flex-wrap items-center gap-3">
          {[
            { label: streamConnectedAt ? "SSE Live" : "SSE reconnecting", tone: streamConnectedAt ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-orange-50 text-orange-700 border-orange-200" },
            { label: streamConnectedAt ? "Last event 8s ago" : "Last event pending", tone: "bg-white text-slate-700 border-border" },
            { label: "Redis stream manager.analytics", tone: "bg-white text-slate-700 border-border" },
            { label: "Updated: summary + finance", tone: "bg-white text-slate-700 border-border" },
            { label: "Reconnects 0", tone: "bg-white text-slate-700 border-border" },
          ].map((item) => (
            <span
              key={item.label}
              className={cn("inline-flex h-8 items-center gap-2 rounded-md border px-3 text-xs font-medium shadow-sm", item.tone)}
            >
              {item.label.includes("SSE") ? <span className="h-2 w-2 rounded-full bg-emerald-500" /> : null}
              {item.label}
            </span>
          ))}
        </section>

        {!data && summaryQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, idx) => (
              <Skeleton key={idx} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : null}

        {data ? (
          <>
            {showDebugMetrics && ops ? (
              <section className="grid gap-4 xl:grid-cols-[1.05fr_1fr]">
                <SectionCard title="Ops Metrics" description={`Generated ${new Date(ops.generatedAt).toLocaleTimeString(locale)}`}>
                  <CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-md border bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Cache hit ratio</div>
                      <div className="mt-1 text-lg font-semibold">{formatPct(ops.analytics.totals.cacheHitRatio)}</div>
                    </div>
                    <div className="rounded-md border bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Summary p95</div>
                      <div className="mt-1 text-lg font-semibold">{Math.round(ops.analytics.summary.p95Ms)} ms</div>
                    </div>
                    <div className="rounded-md border bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Worker lag</div>
                      <div className="mt-1 text-lg font-semibold">{Math.round(ops.worker.lastLagMs)} ms</div>
                    </div>
                    <div className="rounded-md border bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Analytics SSE</div>
                      <div className="mt-1 text-lg font-semibold">{ops.sse.analytics.active} active</div>
                    </div>
                  </CardContent>
                </SectionCard>
                <SectionCard title="Alert Signals" description="Realtime health flags for analytics and streams">
                  <CardContent className="flex flex-wrap gap-2 p-4">
                    <Badge variant={ops.alerts.cacheHitBelowThreshold ? "destructive" : "secondary"}>Cache hit threshold</Badge>
                    <Badge variant={ops.alerts.summaryP95Slow ? "destructive" : "secondary"}>Summary p95</Badge>
                    <Badge variant={ops.alerts.financeQueueP95Slow ? "destructive" : "secondary"}>Finance queue p95</Badge>
                    <Badge variant={ops.alerts.workerLagHigh ? "destructive" : "secondary"}>Worker lag</Badge>
                    <Badge variant={ops.alerts.analyticsReconnectSpike ? "destructive" : "secondary"}>Analytics reconnects</Badge>
                    <Badge variant={ops.alerts.liveMapReconnectSpike ? "destructive" : "secondary"}>Live map reconnects</Badge>
                  </CardContent>
                </SectionCard>
              </section>
            ) : null}

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <BottleneckCard title="Stale Orders" value={data.operations.staleOpenOrders} icon={AlertTriangle} tone="red" delta="28%" />
              <BottleneckCard title="Overdue Pickups" value={data.sla.overdueOpenOrders} icon={Clock3} tone="orange" delta="17%" />
              <BottleneckCard title="Warehouse Pressure" value={`${warehousePressure}%`} icon={Building2} tone="orange" delta="5pp" />
              <BottleneckCard title="Unpaid Exposure" value={`${formatMoney(financeExposureTotal, locale)} UZS`} icon={WalletCards} tone="red" delta="12%" />
            </section>

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
              <StatCard title="Created" value={formatMoney(data.overview.createdInRange, locale)} icon={FileText} tone="bg-blue-50 text-blue-700" delta="12.6% vs prior 7d" trend="down" />
              <StatCard title="Open orders" value={formatMoney(data.overview.openOrders, locale)} icon={FolderOpen} tone="bg-blue-50 text-blue-700" delta="5.4% vs prior 7d" trend="down" />
              <StatCard title="Delivered" value={formatMoney(data.overview.deliveredInRange, locale)} icon={CheckCircle2} tone="bg-emerald-50 text-emerald-700" delta="18.3% vs prior 7d" trend="down" />
              <StatCard title="Exceptions" value={formatMoney(data.overview.exceptionOpenOrders, locale)} icon={AlertTriangle} tone="bg-red-50 text-red-700" delta="8.1% vs prior 7d" />
              <StatCard title="Pending invoices" value={formatMoney(data.finance.pendingInvoicesCount, locale)} icon={ClipboardList} tone="bg-orange-50 text-orange-700" delta="6.7% vs prior 7d" />
              <StatCard title="Unpaid COD" value={formatMoney(data.finance.codExpected, locale)} icon={Wallet} tone="bg-cyan-50 text-cyan-700" delta="9.2% vs prior 7d" />
              <StatCard title="Unpaid service" value={formatMoney(data.finance.serviceChargeExpected, locale)} icon={WalletCards} tone="bg-cyan-50 text-cyan-700" delta="11.4% vs prior 7d" />
              <StatCard title="Paid invoiced" value={formatMoney(data.finance.invoicedPaidAmount, locale)} icon={CircleDollarSign} tone="bg-emerald-50 text-emerald-700" delta="14.5% vs prior 7d" trend="down" />
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(24rem,0.75fr)]">
              <SectionCard
                title="Order Volume Trend"
                action={
                  <div className="flex items-center gap-2">
                    <Select value="daily">
                      <SelectTrigger className="h-8 w-[110px] rounded-md text-xs">
                        <SelectValue placeholder="Daily" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                }
              >
                <CardContent className="p-0">
                  {!trend ? (
                    <div className="p-4">
                      <Skeleton className="h-72 rounded-lg" />
                    </div>
                  ) : (
                    <div className="relative bg-white px-4 pb-4 pt-3">
                      <div className="mb-2 flex flex-wrap items-center gap-5 text-xs text-slate-600">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-5 rounded-sm bg-blue-500" />
                          Created (count)
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="h-0.5 w-5 rounded-full bg-emerald-500" />
                          Delivered (count)
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full border border-red-500 bg-white" />
                          Exceptions (count)
                        </span>
                      </div>
                      <div className="relative overflow-x-auto bg-white">
                        <div className="absolute left-[min(56%,520px)] top-3 z-10 rounded-md border bg-white p-3 text-xs shadow-lg">
                          <p className="font-semibold">{latestTrendDate || "Latest"}</p>
                          <p className="mt-2 flex justify-between gap-10"><span className="text-blue-700">Created</span><span>{latestCreated}</span></p>
                          <p className="flex justify-between gap-10"><span className="text-emerald-700">Delivered</span><span>{latestDelivered}</span></p>
                          <p className="flex justify-between gap-10"><span className="text-red-700">Exceptions</span><span>{data.overview.exceptionOpenOrders}</span></p>
                          <p className="mt-2 flex justify-between gap-10 font-medium"><span>COD exposure</span><span>{formatMoney(data.finance.codExpected, locale)} UZS</span></p>
                        </div>
                        <svg viewBox="0 0 780 292" className="min-h-[292px] min-w-[760px]">
                          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                            const y = chartBottom - ratio * chartHeight;
                            const value = Math.round(ratio * trendChartMax);
                            return (
                              <g key={ratio}>
                                <line x1={chartLeft} x2={chartLeft + chartWidth} y1={y} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                                <text x="10" y={y + 4} className="fill-blue-600 text-[11px]">{value}</text>
                                <text x="746" y={y + 4} className="fill-emerald-600 text-[11px]">{value}</text>
                              </g>
                            );
                          })}
                          {trendChartRows.map((row, idx) => {
                            const x = chartLeft + idx * chartStep;
                            const barHeight = Math.max(4, (row.created / trendChartMax) * chartHeight);
                            return (
                              <g key={row.date}>
                                <rect
                                  x={x - 8}
                                  y={chartBottom - barHeight}
                                  width="16"
                                  height={barHeight}
                                  rx="3"
                                  fill="#2f80ed"
                                  opacity="0.95"
                                />
                                <text x={x} y="266" textAnchor="middle" className="fill-slate-500 text-[10px]">{row.label}</text>
                              </g>
                            );
                          })}
                          <polyline points={deliveredPolyline} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                          <polyline points={exceptionPolyline} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          {trendChartRows.map((row, idx) => {
                            const x = chartLeft + idx * chartStep;
                            return (
                              <g key={`${row.date}-points`}>
                                <circle cx={x} cy={chartY(row.delivered)} r="4" fill="#10b981" stroke="#fff" strokeWidth="2" />
                                <circle cx={x} cy={chartY(row.exceptions)} r="4" fill="#fff" stroke="#ef4444" strokeWidth="2" />
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    </div>
                  )}
                </CardContent>
              </SectionCard>

              <div className="space-y-4">
                <SectionCard
                  title="Risk Priority"
                  action={<Link href="/dashboard/manager/orders" className="text-xs font-medium text-blue-700 hover:underline">View all</Link>}
                >
                  <CardContent className="p-0">
                    <div className="grid grid-cols-[2.5rem_minmax(7rem,1fr)_minmax(0,1.7fr)_4rem] border-b bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500">
                      <span>#</span>
                      <span>Order ID</span>
                      <span>Risk reasons</span>
                      <span className="text-right">Score</span>
                    </div>
                    {(riskPriorityItems.length ? riskPriorityItems : [{ id: "none", orderNumber: "-", status: "delivered", score: 28, reason: "No high priority risks" }]).map((item, index) => (
                      <Link
                        key={`${item.reason}-${item.id}-${index}`}
                        href={item.id === "none" ? "/dashboard/manager/orders" : `/dashboard/manager/orders/${item.id}`}
                        className="grid grid-cols-[2.5rem_minmax(7rem,1fr)_minmax(0,1.7fr)_4rem] items-center border-b px-4 py-2.5 text-xs last:border-b-0 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <span className="flex items-center gap-2 text-slate-500">
                          <span className={cn("h-4 w-1 rounded-full", statusTone(item.status))} />
                          {index + 1}
                        </span>
                        <span className="truncate rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-700">
                          {item.orderNumber && item.orderNumber !== "-" ? `#${item.orderNumber}` : "-"}
                        </span>
                        <span className="truncate text-slate-600">{item.reason}</span>
                        <span className="text-right"><RiskPill score={item.score} /></span>
                      </Link>
                    ))}
                  </CardContent>
                </SectionCard>

                <SectionCard
                  title={t("managerAnalytics.sections.guidance")}
                  action={<Link href="/dashboard/manager/dispatch" className="text-xs font-medium text-blue-700 hover:underline">View all</Link>}
                >
                  <CardContent className="divide-y p-0">
                    {!warnings ? (
                      <div className="p-4"><Skeleton className="h-32 rounded-lg" /></div>
                    ) : (
                      [
                        { text: t("managerAnalytics.guidance.overdue", { count: warnings.overdueTotal }), sub: "Move pending orders through Dispatch Center.", icon: AlertTriangle, tone: "bg-red-50 text-red-700" },
                        { text: t("managerAnalytics.guidance.stale", { count: warnings.staleTotal }), sub: "Trigger movement or escalate to operations.", icon: Clock3, tone: "bg-orange-50 text-orange-700" },
                        { text: t("managerAnalytics.guidance.finance", { count: warnings.financeExposureTotal }), sub: "Settle cash or assign to the next responsible holder.", icon: CircleDollarSign, tone: "bg-cyan-50 text-cyan-700" },
                      ].map((item) => {
                        const Icon = item.icon;
                        return (
                          <div key={item.sub} className="flex items-center gap-3 px-4 py-3">
                            <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", item.tone)}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-slate-950">{item.text}</p>
                              <p className="truncate text-xs text-slate-500">{item.sub}</p>
                            </div>
                            <Button asChild variant="outline" size="sm" className="h-8 rounded-md hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800">
                              <Link href="/dashboard/manager/orders">
                                Review
                                <ChevronRight className="ml-2 h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </SectionCard>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(23rem,0.65fr)]">
              <SectionCard title="Finance Exposure">
                <CardContent className="space-y-4 p-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <FinanceMetricTile label={t("managerAnalytics.finance.serviceChargeExpected")} value={formatMoney(data.finance.serviceChargeExpected, locale)} icon={WalletCards} tone="bg-blue-50 text-blue-700" />
                    <FinanceMetricTile label={t("managerAnalytics.finance.codExpected")} value={formatMoney(data.finance.codExpected, locale)} icon={Wallet} tone="bg-teal-50 text-teal-700" />
                    <FinanceMetricTile label={t("managerAnalytics.finance.driverHeld")} value={formatMoney(heldByDriver, locale)} icon={Route} tone="bg-violet-50 text-violet-700" />
                    <FinanceMetricTile label={t("managerAnalytics.finance.warehouseHeld")} value={formatMoney(heldByWarehouse + heldByPickup, locale)} icon={Building2} tone="bg-sky-50 text-sky-700" />
                  </div>

                  {showQueue ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <Select value={queueStatus} onValueChange={(value: "all" | "expected" | "held") => { setQueueStatus(value); setQueuePage(1); }}>
                          <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">{t("managerAnalytics.finance.filterStatusAll")}</SelectItem>
                            <SelectItem value="expected">Expected</SelectItem>
                            <SelectItem value="held">Held</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={queueKind} onValueChange={(value: "all" | "cod" | "service_charge") => { setQueueKind(value); setQueuePage(1); }}>
                          <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">{t("managerAnalytics.finance.filterKindAll")}</SelectItem>
                            <SelectItem value="cod">COD</SelectItem>
                            <SelectItem value="service_charge">Service charge</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={queueHolderType} onValueChange={(value: "all" | "driver" | "warehouse" | "pickup_point" | "none") => { setQueueHolderType(value); setQueuePage(1); }}>
                          <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">{t("managerAnalytics.finance.filterHolderAll")}</SelectItem>
                            <SelectItem value="driver">{prettyHolderType("driver", t)}</SelectItem>
                            <SelectItem value="warehouse">{prettyHolderType("warehouse", t)}</SelectItem>
                            <SelectItem value="pickup_point">{prettyHolderType("pickup_point", t)}</SelectItem>
                            <SelectItem value="none">{prettyHolderType("none", t)}</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-xs font-medium text-slate-600">Saved filters</span>
                        {["Unpaid COD", "Driver-held cash", "Stale + unpaid", "Warehouse held"].map((label) => (
                          <Button key={label} type="button" variant="outline" size="sm" className="h-8 rounded-md text-xs hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800">
                            {label}
                          </Button>
                        ))}
                        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => {
                          setQueueStatus("all");
                          setQueueKind("all");
                          setQueueHolderType("all");
                          setQueuePage(1);
                          setSelectedQueueIds([]);
                        }}>
                          Clear
                        </Button>
                      </div>

                      <div className="rounded-lg border bg-slate-50 p-3">
                        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold">Cash Control</h3>
                            <p className="text-xs text-slate-500">Settle collected funds or hand off custody for selected cash items.</p>
                          </div>
                          <div className="rounded-md border bg-white px-3 py-2 text-right text-xs">
                            <div className="font-semibold">{formatMoney(selectedTotal, locale)} UZS</div>
                            <div className="text-slate-500">{selectedServiceChargeCount} service charge · {selectedCodCount} COD</div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => setSelectedQueueIds(queueItems.map((item) => item.id))} disabled={!queueItems.length}>
                            {t("managerAnalytics.finance.selectAllVisible")}
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => setSelectedQueueIds([])} disabled={!selectedQueueIds.length}>
                            {t("managerAnalytics.finance.clearSelection")}
                          </Button>
                          <Badge variant="outline">{t("managerAnalytics.finance.selectedCount", { count: selectedCashItems.length })}</Badge>
                          <Button type="button" size="sm" onClick={() => settleSelectedMutation.mutate()} disabled={!canSettleSelected || settleSelectedMutation.isPending}>
                            {settleSelectedMutation.isPending ? t("managerAnalytics.finance.settlingSelected") : t("managerAnalytics.finance.settleSelected")}
                          </Button>
                          <Select value={handoffToType} onValueChange={(value: HandoffType) => { setHandoffToType(value); setHandoffToDriverId(""); setHandoffToWarehouseId(""); }}>
                            <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="warehouse">{t("managerAnalytics.finance.handoffToWarehouse")}</SelectItem>
                              <SelectItem value="pickup_point">{t("managerAnalytics.finance.handoffToPickupPoint")}</SelectItem>
                              <SelectItem value="driver">{t("managerAnalytics.finance.handoffToDriver")}</SelectItem>
                            </SelectContent>
                          </Select>
                          {handoffToType === "driver" ? (
                            <Select value={handoffToDriverId} onValueChange={setHandoffToDriverId}>
                              <SelectTrigger className="h-9 w-[220px]"><SelectValue placeholder={t("managerAnalytics.finance.selectDriverPlaceholder")} /></SelectTrigger>
                              <SelectContent>
                                {(driversQuery.data ?? []).map((driver) => (
                                  <SelectItem key={driver.id} value={driver.id}>{driver.name || driver.email}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Select value={handoffToWarehouseId} onValueChange={setHandoffToWarehouseId}>
                              <SelectTrigger className="h-9 w-[240px]"><SelectValue placeholder={t("managerAnalytics.finance.selectWarehousePlaceholder")} /></SelectTrigger>
                              <SelectContent>
                                {handoffWarehouses.map((warehouse) => (
                                  <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          <Button type="button" size="sm" variant="outline" onClick={() => handoffSelectedMutation.mutate()} disabled={!canSettleSelected || !handoffDestinationReady || handoffSelectedMutation.isPending}>
                            {handoffSelectedMutation.isPending ? t("managerAnalytics.finance.handingOffSelected") : t("managerAnalytics.finance.handoffSelected")}
                          </Button>
                        </div>
                      </div>

                      {!queue && financeQueueQuery.isLoading ? (
                        <Skeleton className="h-44 rounded-lg" />
                      ) : queueItems.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-6 text-sm text-slate-500">{t("managerAnalytics.finance.noQueue")}</div>
                      ) : (
                        <div className="space-y-4">
                          {queueGroups.map((group) => {
                            const total = group.items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
                            return (
                              <div key={group.key} className="space-y-2">
                                <div className="flex items-center justify-between border-b pb-2 text-sm">
                                  <span className="font-semibold">{group.title}</span>
                                  <span className="text-slate-500">{group.items.length} items · {formatMoney(total, locale)} UZS</span>
                                </div>
                                {group.items.length === 0 ? (
                                  <div className="rounded-md border border-dashed px-3 py-3 text-sm text-slate-500">No items in this group.</div>
                                ) : (
                                  group.items.map((item) => {
                                    const selected = selectedQueueIds.includes(item.id);
                                    return (
                                      <div
                                        key={item.id}
                                        className={cn(
                                          "grid gap-3 rounded-md border px-3 py-3 text-sm transition lg:grid-cols-[1.5rem_minmax(0,1fr)_8rem_7rem]",
                                          selected ? "border-blue-200 bg-blue-50/70 shadow-[inset_3px_0_0_0_rgb(59_130_246)]" : "bg-white hover:bg-slate-50",
                                        )}
                                      >
                                        <Checkbox
                                          checked={selected}
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
                                        <div className="min-w-0 space-y-2">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant="outline" className="rounded-full">{item.orderNumber ? `#${item.orderNumber}` : item.orderId.slice(0, 8)}</Badge>
                                            <Badge variant="secondary" className="rounded-full">{getStatusLabel(item.orderStatus, t)}</Badge>
                                            <Badge variant="outline" className="rounded-full">{prettyCashStatus(item.status, t)}</Badge>
                                            <RiskPill score={riskScoreForQueueItem(item)} />
                                          </div>
                                          <div className="font-medium">{prettyCashKind(item.kind, t)} - {item.holderLabel || prettyHolderType(item.holderType, t)}</div>
                                          <div className="text-xs text-slate-500">{t("managerAnalytics.finance.ageHours", { count: item.ageHours })}</div>
                                        </div>
                                        <div className="text-right">
                                          <div className="font-semibold">{formatMoney(item.amount, locale)}</div>
                                          <div className="text-xs text-slate-500">{item.currency || "UZS"}</div>
                                        </div>
                                        <Button asChild size="sm" variant="outline" className="self-center">
                                          <Link href={`/dashboard/manager/orders/${item.orderId}`}>{t("managerAnalytics.finance.openOrder")}</Link>
                                        </Button>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            );
                          })}
                          <div className="flex items-center justify-between pt-1 text-sm">
                            <span>{t("managerAnalytics.finance.pageOf", { page: queue?.queueMeta?.page ?? 1, pageCount: queue?.queueMeta?.pageCount ?? 1 })}</span>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => setQueuePage((p) => Math.max(1, p - 1))} disabled={!queue?.queueMeta?.hasPrev}>Prev</Button>
                              <Button variant="outline" size="sm" onClick={() => setQueuePage((p) => p + 1)} disabled={!queue?.queueMeta?.hasNext}>Next</Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : null}
                </CardContent>
              </SectionCard>

              <SectionCard
                title="Activity Feed"
                action={<Link href="/dashboard/manager/orders" className="text-xs font-medium text-blue-700 hover:underline">View all</Link>}
              >
                <CardContent className="divide-y p-0">
                  {activityRows.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.title} className="flex items-center gap-3 px-4 py-3">
                        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", item.tone)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-950">{item.title}</p>
                          <p className="truncate text-xs text-slate-500">{item.detail}</p>
                        </div>
                        <span className="text-xs text-slate-500">{item.time}</span>
                      </div>
                    );
                  })}
                </CardContent>
              </SectionCard>
            </section>
          </>
        ) : null}
      </div>
    </PageShell>
  );
}
