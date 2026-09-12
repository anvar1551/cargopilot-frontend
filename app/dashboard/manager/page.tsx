"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchOrderById, fetchOrders } from "@/lib/orders";
import {
  fetchManagerOverview,
  subscribeManagerAnalyticsStream,
} from "@/lib/manager";
import { getStatusLabel } from "@/lib/i18n/labels";
import { usePageVisibility } from "@/lib/usePageVisibility";
import { useRealtimeFallbackInterval } from "@/lib/use-realtime-fallback";
import { cn } from "@/lib/utils";

import { useI18n } from "@/components/i18n/I18nProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import PageShell from "@/components/layout/PageShell";
import CreateOrderDialog from "@/components/orders/CreateOrderDialog";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Folder,
  Headset,
  Info,
  Route,
  Send,
  ShieldAlert,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";

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
  | "cancelled"
  | string;

type InvoiceLite = {
  status?: string | null;
  invoiceUrl?: string | null;
  paymentUrl?: string | null;
};

type OrderLite = {
  id: string;
  orderNumber?: string | number | null;
  status?: OrderStatus | null;
  createdAt?: string | null;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  customer?: { email?: string | null } | null;
  invoice?: InvoiceLite | null;
  Invoice?: InvoiceLite | null;
};

type OrdersResponseLike = {
  orders: OrderLite[];
  total: number;
  page: number;
  limit: number;
  pageCount: number;
  hasMore: boolean;
};

type ManagerOverview = {
  totalOrders?: number;
  pendingOrders?: number;
  assignedOrders?: number;
  activeDrivers?: number | string;
  overdueOpenOrders?: number;
  dueSoonOpenOrders?: number;
  staleOpenOrders?: number;
  exceptionOpenOrders?: number;
  slaRiskOrders?: number;
};

const copy = {
  en: {
    badge: "Live operations",
    title: "Operations Overview",
    subtitle: "Real-time command center for operations, dispatch, and support.",
    openDispatch: "Open Dispatch",
    ordersQueue: "Orders Queue",
    supportDesk: "Support Desk",
    livePulse: "Live Pulse",
    operationalHealth: "Operational Health",
    liveQueuePressure: "Live Queue Pressure",
    activeFlows: "Active Flows",
    slaSupportRisk: "SLA / Support Risk",
    todaysCompletion: "Today's Completion",
    shipmentFlowSnapshot: "Shipment Flow Snapshot",
    ordersInMotion: "Orders in Motion",
    completionRate: "Completion Rate",
    attentionQueue: "Attention Queue",
    exceptionShare: "Exception Share",
    totalOrders: "Total Orders",
    totalOrdersHint: "Loaded operational scope",
    activePipeline: "Active Pipeline",
    activePipelineHint: "Not final yet",
    pending: "Pending",
    pendingHint: "Awaiting first movement",
    atWarehouse: "At Warehouse",
    atWarehouseHint: "On floor and sorting",
    deliveredToday: "Delivered Today",
    deliveredTodayHint: "Closed today",
    activeDrivers: "Active Drivers",
    activeDriversHint: "From manager overview",
    recentOrders: "Recent Orders",
    viewAllOrders: "View all orders",
    throughput7Days: "Throughput (Last 7 Days)",
    statusDistribution: "Status Distribution",
    slaPerformance: "SLA Performance",
    viewAll: "View all",
    noOrders: "No orders yet.",
    invoice: "Invoice",
    paymentPending: "Payment pending",
    customerPrefix: "Customer",
    details: "Details",
    flowSnapshot: "Flow Snapshot",
    noStatusDistribution: "No status distribution yet.",
    inTransit: "In transit",
    outForDelivery: "Out for delivery",
    exceptions: "Exceptions",
    throughput: "Throughput (Last 7 Days)",
    operationalRadar: "Operational Radar",
    radarHealthy: "Operations look healthy. No immediate bottlenecks detected.",
    radarPending: "High pending backlog ({count}).",
    radarException: "{count} order(s) in exception flow.",
    radarWarehouse: "Warehouse queue is heavy ({count}).",
    radarDelivery: "Delivery wave is large ({count}).",
    suggestedNextStep:
      "Suggested next step: move pending and exception groups through Dispatch Center in controlled batches.",
    unnumberedOrder: "Unnumbered order",
  },
  ru: {
    badge: "Живые операции",
    title: "Операционный обзор",
    subtitle:
      "Командный обзор в реальном времени: нагрузка заказов, диспетчерский поток, риски поддержки и сегодняшнее движение.",
    openDispatch: "Открыть диспетчерскую",
    ordersQueue: "Очередь заказов",
    supportDesk: "Поддержка",
    livePulse: "Пульс",
    operationalHealth: "Операционное здоровье",
    liveQueuePressure: "Нагрузка очереди",
    activeFlows: "Активные потоки",
    slaSupportRisk: "SLA / Риск поддержки",
    todaysCompletion: "Сегодня закрыто",
    shipmentFlowSnapshot: "Снимок потока отправлений",
    ordersInMotion: "Заказы в движении",
    completionRate: "Процент закрытия",
    attentionQueue: "Требуют внимания",
    exceptionShare: "Доля исключений",
    totalOrders: "Всего заказов",
    totalOrdersHint: "Текущий операционный объем",
    activePipeline: "Активный поток",
    activePipelineHint: "Еще не в финальном статусе",
    pending: "Ожидают",
    pendingHint: "Ожидают первого движения",
    atWarehouse: "На складе",
    atWarehouseHint: "На площадке и в сортировке",
    deliveredToday: "Доставлено сегодня",
    deliveredTodayHint: "Закрыто сегодня",
    activeDrivers: "Активные водители",
    activeDriversHint: "По обзору менеджера",
    recentOrders: "Последние заказы",
    viewAllOrders: "Все заказы",
    throughput7Days: "Пропускная способность (7 дней)",
    statusDistribution: "Распределение статусов",
    slaPerformance: "SLA performance",
    viewAll: "Показать все",
    noOrders: "Заказов пока нет.",
    invoice: "Счет",
    paymentPending: "Ожидается оплата",
    customerPrefix: "Клиент",
    details: "Детали",
    flowSnapshot: "Снимок потока",
    noStatusDistribution: "Распределение по статусам пока отсутствует.",
    inTransit: "В транзите",
    outForDelivery: "На доставке",
    exceptions: "Исключения",
    throughput: "Пропускная способность (последние 7 дней)",
    operationalRadar: "Операционный радар",
    radarHealthy: "Операции выглядят стабильно. Узких мест сейчас не видно.",
    radarPending: "Высокий backlog в pending ({count}).",
    radarException: "{count} заказ(ов) в exception-потоке.",
    radarWarehouse: "Высокая нагрузка на склад ({count}).",
    radarDelivery: "Большая delivery-волна ({count}).",
    suggestedNextStep:
      "Следующий шаг: переведите pending и exception-группы через Dispatch Center контролируемыми пакетами.",
    unnumberedOrder: "Заказ без номера",
  },
  uz: {
    badge: "Jonli operatsiyalar",
    title: "Operatsion overview",
    subtitle:
      "Buyurtma bosimi, dispatch oqimi, support risklari va bugungi harakatlar uchun real vaqt command ko'rinishi.",
    openDispatch: "Dispatchni ochish",
    ordersQueue: "Buyurtmalar navbati",
    supportDesk: "Support desk",
    livePulse: "Jonli puls",
    operationalHealth: "Operatsion sog'liq",
    liveQueuePressure: "Navbat bosimi",
    activeFlows: "Faol oqimlar",
    slaSupportRisk: "SLA / Support riski",
    todaysCompletion: "Bugungi yakun",
    shipmentFlowSnapshot: "Shipment flow snapshot",
    ordersInMotion: "Harakatdagi buyurtmalar",
    completionRate: "Yopilish foizi",
    attentionQueue: "E'tibor kerak",
    exceptionShare: "Exception ulushi",
    totalOrders: "Jami buyurtmalar",
    totalOrdersHint: "Yuklangan operatsion hajm",
    activePipeline: "Faol oqim",
    activePipelineHint: "Hali final emas",
    pending: "Kutilmoqda",
    pendingHint: "Birinchi harakatni kutmoqda",
    atWarehouse: "Omborda",
    atWarehouseHint: "Maydonda va saralashda",
    deliveredToday: "Bugun yetkazilgan",
    deliveredTodayHint: "Bugun yopilgan",
    activeDrivers: "Faol haydovchilar",
    activeDriversHint: "Menejer overview dan",
    recentOrders: "So'nggi buyurtmalar",
    viewAllOrders: "Barcha buyurtmalar",
    throughput7Days: "Throughput (7 kun)",
    statusDistribution: "Status taqsimoti",
    slaPerformance: "SLA performance",
    viewAll: "Barchasini ko'rish",
    noOrders: "Hali buyurtmalar yo'q.",
    invoice: "Hisob-faktura",
    paymentPending: "To'lov kutilmoqda",
    customerPrefix: "Mijoz",
    details: "Tafsilotlar",
    flowSnapshot: "Oqim ko'rinishi",
    noStatusDistribution: "Hozircha status taqsimoti yo'q.",
    inTransit: "Tranzitda",
    outForDelivery: "Yetkazib berishda",
    exceptions: "Istisnolar",
    throughput: "O'tkazuvchanlik (oxirgi 7 kun)",
    operationalRadar: "Operatsion radar",
    radarHealthy:
      "Operatsiyalar sog'lom ko'rinmoqda. Hozircha jiddiy bottleneck yo'q.",
    radarPending: "Pending backlog yuqori ({count}).",
    radarException: "{count} ta buyurtma exception oqimida.",
    radarWarehouse: "Ombor navbati og'irlashgan ({count}).",
    radarDelivery: "Delivery to'lqini katta ({count}).",
    suggestedNextStep:
      "Keyingi qadam: pending va exception guruhlarini Dispatch Center orqali nazoratli batchlarda o'tkazing.",
    unnumberedOrder: "Raqamsiz buyurtma",
  },
} as const;

function statusVariant(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "delivered") return "default" as const;
  if (
    s === "exception" ||
    s === "return_in_progress" ||
    s === "returned" ||
    s === "cancelled"
  ) {
    return "destructive" as const;
  }
  if (s === "out_for_delivery" || s === "at_warehouse") {
    return "secondary" as const;
  }
  return "outline" as const;
}

function sameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatShortDate(value: string | null | undefined, locale: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(locale);
}

function hasInvoiceReady(order: OrderLite) {
  const invoice = order.invoice ?? order.Invoice;
  return Boolean(invoice?.invoiceUrl);
}

function hasPaymentPending(order: OrderLite) {
  const invoice = order.invoice ?? order.Invoice;
  return Boolean(invoice?.paymentUrl) && invoice?.status !== "paid";
}

function orderRef(order: OrderLite, fallback: string) {
  return order.orderNumber ? `#${order.orderNumber}` : fallback;
}

function statusDotClass(status: string | null | undefined) {
  const s = String(status ?? "").toLowerCase();
  if (s === "delivered") return "bg-emerald-500";
  if (s === "pending") return "bg-orange-500";
  if (s === "assigned") return "bg-blue-500";
  if (s === "pickup_in_progress" || s === "picked_up") return "bg-amber-500";
  if (s === "at_warehouse") return "bg-cyan-600";
  if (s === "in_transit") return "bg-teal-600";
  if (s === "out_for_delivery") return "bg-emerald-600";
  if (
    s === "exception" ||
    s === "return_in_progress" ||
    s === "returned" ||
    s === "cancelled"
  ) {
    return "bg-red-500";
  }
  return "bg-slate-400";
}

function SectionHeader({
  title,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  tone?: "teal" | "blue" | "orange" | "emerald" | "red";
  className?: string;
}) {
  return (
    <CardHeader className={cn("border-b bg-white !px-4 !py-0", className)}>
      <div className="flex h-14 items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          {title}
          {icon}
        </CardTitle>
        {action}
      </div>
    </CardHeader>
  );
}

function SlaDonut({
  onTime,
  atRisk,
  missed,
}: {
  onTime: number;
  atRisk: number;
  missed: number;
}) {
  const measuredTotal = onTime + atRisk + missed;
  const total = Math.max(1, measuredTotal);
  const rate = measuredTotal > 0 ? Math.round((onTime / total) * 100) : 100;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const gap = measuredTotal > 0 ? 2 : 0;
  let offsetPct = 0;

  const segments = [
    { key: "on-time", value: measuredTotal > 0 ? onTime : 1, color: "#10b981" },
    { key: "at-risk", value: atRisk, color: "#f59e0b" },
    { key: "missed", value: missed, color: "#ef4444" },
  ].filter((segment) => segment.value > 0);

  return (
    <div className="relative h-36 w-36">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#eef2f7"
          strokeWidth="12"
        />
        {segments.map((segment) => {
          const pct = (segment.value / total) * 100;
          const dash = Math.max(0, (pct / 100) * circumference - gap);
          const offset = (offsetPct / 100) * circumference * -1;
          offsetPct += pct;
          return (
            <circle
              key={segment.key}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
              strokeDashoffset={offset}
              className="transition-all duration-700 ease-out"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="text-2xl font-semibold text-slate-950">{rate}%</p>
        <p className="text-xs text-slate-500">On Time</p>
      </div>
    </div>
  );
}

export default function ManagerDashboardPage() {
  const { locale, t } = useI18n();
  const text = copy[locale];
  const queryClient = useQueryClient();
  const isPageVisible = usePageVisibility();
  const dashboardInvalidateTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [analyticsStreamConnectedAt, setAnalyticsStreamConnectedAt] = useState<
    string | null
  >(null);
  const realtimeFallbackInterval = useRealtimeFallbackInterval({
    isPageVisible,
    realtimeConnected: Boolean(analyticsStreamConnectedAt),
  });

  const overviewQuery = useQuery<ManagerOverview>({
    queryKey: ["manager-overview"],
    queryFn: fetchManagerOverview,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    retry: false,
    refetchInterval: realtimeFallbackInterval,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const ordersQuery = useQuery<OrdersResponseLike | OrderLite[]>({
    queryKey: ["orders", "manager-dashboard"],
    queryFn: () =>
      fetchOrders({
        mode: "cursor",
        scope: "fast",
        limit: 80,
      }),
    staleTime: 20_000,
    placeholderData: (prev) => prev,
    retry: false,
    refetchInterval: realtimeFallbackInterval,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const orders = useMemo(() => {
    const raw = ordersQuery.data;
    return Array.isArray(raw) ? raw : (raw?.orders ?? []);
  }, [ordersQuery.data]);

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const leftDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const rightDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return rightDate - leftDate;
    });
  }, [orders]);

  const recentOrders = useMemo(() => sortedOrders.slice(0, 8), [sortedOrders]);

  const statusCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const order of orders) {
      const status = String(order.status ?? "unknown").toLowerCase();
      map.set(status, (map.get(status) ?? 0) + 1);
    }
    return map;
  }, [orders]);

  const totalOrders = orders.length;
  const delivered = statusCounts.get("delivered") ?? 0;
  const pending = statusCounts.get("pending") ?? 0;
  const assigned = statusCounts.get("assigned") ?? 0;
  const atWarehouse = statusCounts.get("at_warehouse") ?? 0;
  const inTransit = statusCounts.get("in_transit") ?? 0;
  const outForDelivery = statusCounts.get("out_for_delivery") ?? 0;
  const exceptions =
    (statusCounts.get("exception") ?? 0) +
    (statusCounts.get("return_in_progress") ?? 0);
  const activePipeline =
    totalOrders -
    delivered -
    (statusCounts.get("cancelled") ?? 0) -
    (statusCounts.get("returned") ?? 0);

  const deliveredToday = useMemo(() => {
    const today = new Date();
    return orders.filter((order) => {
      if (String(order.status ?? "").toLowerCase() !== "delivered")
        return false;
      if (!order.createdAt) return false;
      const date = new Date(order.createdAt);
      if (Number.isNaN(date.getTime())) return false;
      return sameLocalDay(date, today);
    }).length;
  }, [orders]);

  const overview = overviewQuery.data;
  const managerTotalOrders = overview?.totalOrders ?? totalOrders;
  const last7Days = useMemo(() => {
    const buckets: Array<{ key: string; label: string; count: number }> = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      buckets.push({
        key,
        label: date.toLocaleDateString(locale, { weekday: "short" }),
        count: 0,
      });
    }

    for (const order of orders) {
      if (!order.createdAt) continue;
      const date = new Date(order.createdAt);
      if (Number.isNaN(date.getTime())) continue;
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const bucket = buckets.find((item) => item.key === key);
      if (bucket) bucket.count += 1;
    }

    return buckets;
  }, [locale, orders]);

  const alerts = useMemo(() => {
    const list: string[] = [];
    if (pending > 40) {
      list.push(text.radarPending.replace("{count}", String(pending)));
    }
    if (exceptions > 0) {
      list.push(text.radarException.replace("{count}", String(exceptions)));
    }
    if (atWarehouse > 60) {
      list.push(text.radarWarehouse.replace("{count}", String(atWarehouse)));
    }
    if (outForDelivery > 80) {
      list.push(text.radarDelivery.replace("{count}", String(outForDelivery)));
    }
    if (list.length === 0) {
      list.push(text.radarHealthy);
    }
    return list;
  }, [atWarehouse, exceptions, outForDelivery, pending, text]);

  const completionRate =
    totalOrders > 0 ? Math.round((delivered / totalOrders) * 100) : 0;
  const attentionQueue = pending + exceptions + atWarehouse;
  const slaAtRisk = pending + atWarehouse;
  const slaMissed = exceptions;
  const slaMeasuredTotal = delivered + slaAtRisk + slaMissed;
  const exceptionShare =
    totalOrders > 0 ? Math.round((exceptions / totalOrders) * 100) : 0;
  const ordersInMotion = assigned + inTransit + outForDelivery;
  const staleOpenOrders = Number(overview?.staleOpenOrders ?? 0);
  const overdueOpenOrders = Number(overview?.overdueOpenOrders ?? 0);
  const dueSoonOpenOrders = Number(overview?.dueSoonOpenOrders ?? 0);
  const exceptionOpenOrders = Number(
    overview?.exceptionOpenOrders ?? exceptions,
  );
  const slaSupportRiskOrders = Number(
    overview?.slaRiskOrders ??
      overdueOpenOrders + staleOpenOrders + exceptionOpenOrders,
  );
  const flowHealth = Math.max(
    0,
    Math.min(
      100,
      100 -
        exceptionShare * 3 -
        Math.min(35, pending) -
        Math.min(25, staleOpenOrders * 4),
    ),
  );
  const pipeline = [
    {
      key: "pending",
      label: text.pending,
      count: pending,
      tone: "bg-amber-500",
    },
    { key: "assigned", label: "Assigned", count: assigned, tone: "bg-sky-500" },
    {
      key: "pickup_in_progress",
      label: "Pickup",
      count: statusCounts.get("pickup_in_progress") ?? 0,
      tone: "bg-blue-500",
    },
    {
      key: "at_warehouse",
      label: text.atWarehouse,
      count: atWarehouse,
      tone: "bg-cyan-600",
    },
    {
      key: "in_transit",
      label: text.inTransit,
      count: inTransit,
      tone: "bg-teal-600",
    },
    {
      key: "out_for_delivery",
      label: text.outForDelivery,
      count: outForDelivery,
      tone: "bg-emerald-600",
    },
    {
      key: "delivered",
      label: "Delivered",
      count: delivered,
      tone: "bg-emerald-500",
    },
    {
      key: "exception",
      label: text.exceptions,
      count: exceptions,
      tone: "bg-red-500",
    },
  ];
  const pipelineMax = Math.max(1, ...pipeline.map((item) => item.count));
  const throughputMax = Math.max(1, ...last7Days.map((item) => item.count));
  const throughputPoints = last7Days
    .map((day, index) => {
      const x = 18 + index * (264 / Math.max(1, last7Days.length - 1));
      const y = 112 - (day.count / throughputMax) * 92;
      return `${x},${y}`;
    })
    .join(" ");
  const throughputAreaPoints = `18,112 ${throughputPoints} 282,112`;
  const prefetchOrderDetails = useCallback(
    (id: string) => {
      if (!id) return;
      void queryClient.prefetchQuery({
        queryKey: ["order", id],
        queryFn: () => fetchOrderById(id),
        staleTime: 60_000,
      });
    },
    [queryClient],
  );

  useEffect(() => {
    if (!isPageVisible) return;

    const scheduleDashboardRefresh = () => {
      if (dashboardInvalidateTimerRef.current) return;
      dashboardInvalidateTimerRef.current = setTimeout(() => {
        dashboardInvalidateTimerRef.current = null;
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ["manager-overview"] }),
          queryClient.invalidateQueries({
            queryKey: ["orders", "manager-dashboard"],
          }),
        ]);
      }, 300);
    };

    const unsubscribe = subscribeManagerAnalyticsStream({
      onReady: (payload) =>
        setAnalyticsStreamConnectedAt(
          payload.connectedAt ?? new Date().toISOString(),
        ),
      onRefresh: () => scheduleDashboardRefresh(),
      onError: () => setAnalyticsStreamConnectedAt(null),
    });

    return () => {
      unsubscribe();
      setAnalyticsStreamConnectedAt(null);
      if (dashboardInvalidateTimerRef.current) {
        clearTimeout(dashboardInvalidateTimerRef.current);
        dashboardInvalidateTimerRef.current = null;
      }
    };
  }, [isPageVisible, queryClient]);

  return (
    <PageShell className="bg-white">
      <div className="w-full space-y-4">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              {text.title}
            </h1>
            <p className="mt-1 text-sm text-slate-500">{text.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <CreateOrderDialog
              mode="operations"
              triggerClassName="h-10 rounded-md bg-slate-950 px-5 text-white shadow-sm hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            />
            <Button
              asChild
              variant="outline"
              className="h-10 rounded-md bg-white px-5 shadow-sm hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800 focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2"
            >
              <Link href="/dashboard/manager/dispatch" className="gap-2">
                <Send className="h-4 w-4" />
                {text.openDispatch}
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-10 rounded-md bg-white px-5 shadow-sm hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800 focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:ring-offset-2"
            >
              <Link href="/dashboard/manager/support" className="gap-2">
                <Headset className="h-4 w-4" />
                {text.supportDesk}
              </Link>
            </Button>
          </div>
        </section>

        <section className="grid overflow-hidden rounded-lg border bg-white shadow-sm lg:grid-cols-5">
          {[
            {
              title: text.operationalHealth,
              value: `${flowHealth}%`,
              sub:
                flowHealth >= 80
                  ? "Excellent"
                  : flowHealth >= 60
                    ? "Stable"
                    : "Needs review",
              hint:
                flowHealth >= 80
                  ? "All systems normal"
                  : text.suggestedNextStep,
              icon: ShieldAlert,
              color: "text-emerald-600",
              bg: "bg-emerald-50",
            },
            {
              title: text.liveQueuePressure,
              value: pending > 50 ? "High" : pending > 0 ? "Medium" : "Low",
              sub: `${pending} waiting / ${exceptions} urgent`,
              hint: text.pendingHint,
              icon: Clock3,
              color: pending > 0 ? "text-orange-600" : "text-emerald-600",
              bg: pending > 0 ? "bg-orange-50" : "bg-emerald-50",
            },
            {
              title: text.activeFlows,
              value: String(
                Math.max(activePipeline, managerTotalOrders - delivered),
              ),
              sub: "Shipments in progress",
              hint: `${ordersInMotion} moving now`,
              icon: Truck,
              color: "text-slate-700",
              bg: "bg-slate-50",
            },
            {
              title: text.slaSupportRisk,
              value: String(slaSupportRiskOrders),
              sub:
                slaSupportRiskOrders > 0
                  ? `${staleOpenOrders} stale / ${overdueOpenOrders} overdue`
                  : "No open risk",
              hint:
                dueSoonOpenOrders > 0
                  ? `${dueSoonOpenOrders} due soon`
                  : text.exceptions,
              icon: ShieldAlert,
              color:
                overdueOpenOrders > 0 || exceptionOpenOrders > 0
                  ? "text-red-600"
                  : slaSupportRiskOrders > 0
                    ? "text-orange-600"
                    : "text-emerald-600",
              bg:
                overdueOpenOrders > 0 || exceptionOpenOrders > 0
                  ? "bg-red-50"
                  : slaSupportRiskOrders > 0
                    ? "bg-orange-50"
                    : "bg-emerald-50",
            },
            {
              title: text.todaysCompletion,
              value: `${completionRate}%`,
              sub: `${delivered} / ${managerTotalOrders || 0} delivered`,
              hint: text.deliveredToday,
              icon: CheckCircle2,
              color: "text-emerald-600",
              bg: "bg-emerald-50",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="border-b p-4 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0"
              >
                <div className="flex gap-3">
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      item.bg,
                    )}
                  >
                    <Icon className={cn("h-4 w-4", item.color)} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-500">
                      {item.title}
                    </p>
                    <div className="mt-2 flex items-end gap-2">
                      <span
                        className={cn(
                          "text-2xl font-semibold tracking-tight",
                          item.color,
                        )}
                      >
                        {item.value}
                      </span>
                      <span className="pb-1 text-xs font-medium text-slate-500">
                        {item.sub}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-xs text-slate-500">
                      {item.hint}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <Card className="gap-0 overflow-hidden rounded-lg border-border/70 bg-white py-0 shadow-sm">
          <SectionHeader
            title={text.shipmentFlowSnapshot}
            icon={<Info className="h-3.5 w-3.5 text-slate-400" />}
            tone="teal"
            action={
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-xs text-blue-700 hover:bg-blue-100/80 hover:text-blue-900 focus-visible:ring-2 focus-visible:ring-blue-300"
              >
                <Link href="/dashboard/manager/orders">
                  View full flow <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            }
          />
          <CardContent className="px-4 py-5">
            <div className="relative grid gap-2 md:grid-cols-4 xl:grid-cols-8">
              <div className="pointer-events-none absolute left-10 right-10 top-5 hidden h-px border-t border-slate-200 xl:block" />
              {pipeline.map((item) => (
                <div key={item.key} className="relative min-w-0 text-center">
                  <div
                    className={cn(
                      "relative z-10 mx-auto flex h-10 w-10 items-center justify-center rounded-full border bg-white shadow-[0_0_0_6px_white]",
                      item.key === "pickup_in_progress" &&
                        "border-amber-300 bg-amber-50",
                      item.key === "in_transit" && "border-teal-200 bg-teal-50",
                      item.key === "out_for_delivery" &&
                        "border-teal-200 bg-teal-50",
                      item.key === "delivered" &&
                        "border-emerald-200 bg-emerald-50",
                      item.key === "exception" && "border-red-200 bg-red-50",
                    )}
                  >
                    {item.key === "pending" ? (
                      <Folder className="h-4 w-4" />
                    ) : null}
                    {item.key === "assigned" ? (
                      <Users className="h-4 w-4" />
                    ) : null}
                    {item.key === "pickup_in_progress" ? (
                      <Truck className="h-4 w-4" />
                    ) : null}
                    {item.key === "at_warehouse" ? (
                      <Warehouse className="h-4 w-4" />
                    ) : null}
                    {item.key === "in_transit" ? (
                      <Truck className="h-4 w-4 text-teal-700" />
                    ) : null}
                    {item.key === "out_for_delivery" ? (
                      <Route className="h-4 w-4 text-teal-700" />
                    ) : null}
                    {item.key === "delivered" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                    ) : null}
                    {item.key === "exception" ? (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    ) : null}
                  </div>
                  <div className="mt-3 border-l border-slate-200 px-2 first:border-l-0">
                    <p className="text-xs font-medium text-slate-600">
                      {item.label}
                    </p>
                    <div className="mt-2 flex items-center justify-center gap-2">
                      <span className="text-lg font-semibold text-slate-950">
                        {item.count}
                      </span>
                      <span
                        className={cn(
                          "text-xs",
                          item.count > 0
                            ? "text-orange-600"
                            : "text-emerald-600",
                        )}
                      >
                        {item.count > 0 ? "↗" : "↘"}{" "}
                        {Math.max(
                          1,
                          Math.round(
                            (item.count / Math.max(1, pipelineMax)) * 24,
                          ),
                        )}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[11px] text-slate-500">
                      {item.key === "pending"
                        ? "Awaiting assignment"
                        : item.key === "assigned"
                          ? "Driver / carrier assigned"
                          : item.key === "pickup_in_progress"
                            ? "Awaiting collection"
                            : item.key === "at_warehouse"
                              ? "At origin facility"
                              : item.key === "in_transit"
                                ? "On the move"
                                : item.key === "out_for_delivery"
                                  ? "With delivery driver"
                                  : item.key === "delivered"
                                    ? "Completed today"
                                    : "Require attention"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(24rem,0.9fr)]">
          <div className="space-y-4">
            <Card className="gap-0 overflow-hidden rounded-lg border-border/70 bg-white py-0 shadow-sm">
              <SectionHeader
                title={text.recentOrders}
                tone="blue"
                action={
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs text-blue-700 hover:bg-blue-100/80 hover:text-blue-900 focus-visible:ring-2 focus-visible:ring-blue-300"
                  >
                    <Link href="/dashboard/manager/orders">
                      {text.viewAllOrders}{" "}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                }
              />
              <CardContent className="p-0">
                {ordersQuery.isLoading ? (
                  <div className="space-y-2 p-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : recentOrders.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">
                    {text.noOrders}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="min-w-[760px]">
                      <div className="grid grid-cols-[6rem_1.2fr_1fr_6rem_5rem_6rem_7rem_4rem] gap-3 border-b bg-slate-50 px-4 py-2 text-[11px] font-medium text-slate-500">
                        <span>Shipment ID</span>
                        <span>Route</span>
                        <span>Customer</span>
                        <span>Status</span>
                        <span>Payment</span>
                        <span>Invoice</span>
                        <span>Est. Delivery</span>
                        <span>Actions</span>
                      </div>
                      {recentOrders.slice(0, 5).map((order) => (
                        <Link
                          key={order.id}
                          href={`/dashboard/manager?order=${order.id}`}
                          onMouseEnter={() => prefetchOrderDetails(order.id)}
                          onFocus={() => prefetchOrderDetails(order.id)}
                          onTouchStart={() => prefetchOrderDetails(order.id)}
                          className="grid grid-cols-[6rem_1.2fr_1fr_6rem_5rem_6rem_7rem_4rem] items-center gap-3 border-b px-4 py-2.5 text-xs transition last:border-b-0 hover:bg-slate-50"
                        >
                          <span className="flex items-center gap-2 font-mono font-medium text-slate-900">
                            <span
                              className={cn(
                                "h-2 w-2 shrink-0 rounded-full shadow-[0_0_0_3px_rgba(255,255,255,0.95)]",
                                statusDotClass(order.status),
                              )}
                            />
                            {orderRef(order, text.unnumberedOrder)}
                          </span>
                          <span className="truncate">
                            {order.pickupAddress || "-"} →{" "}
                            {order.dropoffAddress || "-"}
                          </span>
                          <span className="truncate">
                            {order.customer?.email || "-"}
                          </span>
                          <Badge
                            variant={statusVariant(String(order.status ?? ""))}
                            className="w-fit rounded-md capitalize"
                          >
                            {getStatusLabel(
                              String(order.status ?? "unknown"),
                              t,
                            )}
                          </Badge>
                          <span className="w-fit rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                            {hasPaymentPending(order) ? "COD" : "Prepaid"}
                          </span>
                          <span className="inline-flex items-center gap-1 text-slate-500">
                            <FileText className="h-3.5 w-3.5" />
                            {hasInvoiceReady(order) ? text.invoice : "-"}
                          </span>
                          <span>
                            {order.createdAt
                              ? formatShortDate(order.createdAt, locale)
                              : "-"}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium">
                            View <ExternalLink className="h-3 w-3" />
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
              <Card className="gap-0 overflow-hidden rounded-lg border-border/70 bg-white py-0 shadow-sm">
                <SectionHeader
                  title={text.throughput7Days}
                  icon={<Info className="h-3.5 w-3.5 text-slate-400" />}
                  tone="emerald"
                />
                <CardContent className="p-4">
                  <div className="h-40 border-b border-l">
                    <svg
                      viewBox="0 0 300 132"
                      role="img"
                      aria-label={text.throughput7Days}
                      className="h-full w-full overflow-visible"
                    >
                      {[20, 43, 66, 89, 112].map((y) => (
                        <line
                          key={y}
                          x1="18"
                          x2="282"
                          y1={y}
                          y2={y}
                          stroke="#e5e7eb"
                          strokeWidth="1"
                        />
                      ))}
                      <polygon
                        points={throughputAreaPoints}
                        fill="#0f766e"
                        opacity="0.06"
                      />
                      <polyline
                        points={throughputPoints}
                        fill="none"
                        stroke="#0f766e"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {last7Days.map((day, index) => {
                        const x =
                          18 +
                          index * (264 / Math.max(1, last7Days.length - 1));
                        const y = 112 - (day.count / throughputMax) * 92;
                        return (
                          <g key={day.key}>
                            <circle
                              cx={x}
                              cy={y}
                              r="3.5"
                              fill="#0f766e"
                              stroke="#fff"
                              strokeWidth="2"
                            />
                            <text
                              x={x}
                              y="129"
                              textAnchor="middle"
                              className="fill-slate-500 text-[9px]"
                            >
                              {day.label}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                  <div className="mt-4 grid grid-cols-3 divide-x text-center">
                    <div>
                      <p className="text-xl font-semibold">{delivered}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Total Delivered
                      </p>
                    </div>
                    <div>
                      <p className="text-xl font-semibold">
                        {Math.round(delivered / 7)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Daily Average
                      </p>
                    </div>
                    <div>
                      <p className="text-xl font-semibold">{completionRate}%</p>
                      <p className="text-[11px] text-muted-foreground">
                        On-Time Delivery
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="gap-0 overflow-hidden rounded-lg border-border/70 bg-white py-0 shadow-sm">
                <SectionHeader
                  title={text.statusDistribution}
                  icon={<Info className="h-3.5 w-3.5 text-slate-400" />}
                  tone="teal"
                />
                <CardContent className="space-y-3 p-4">
                  {pipeline.map((item) => (
                    <div
                      key={item.key}
                      className="grid grid-cols-[6rem_minmax(0,1fr)_4rem] items-center gap-3 text-xs"
                    >
                      <span className="truncate text-slate-600">
                        {item.label}
                      </span>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div
                          className={cn("h-2 rounded-full", item.tone)}
                          style={{
                            width: `${Math.max(3, (item.count / Math.max(1, totalOrders)) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-right text-slate-500">
                        {item.count}
                      </span>
                    </div>
                  ))}
                  <div className="border-t pt-3 text-right text-xs text-slate-500">
                    Total {totalOrders || 0} (100%)
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <aside className="space-y-4">
            <Card className="gap-0 overflow-hidden rounded-lg border-border/70 bg-white py-0 shadow-sm">
              <SectionHeader
                title={
                  <>
                    {text.operationalRadar}
                    <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white">
                      {alerts.length}
                    </span>
                  </>
                }
                tone="orange"
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-blue-700 hover:bg-orange-100/80 hover:text-orange-900 focus-visible:ring-2 focus-visible:ring-orange-300"
                  >
                    View all
                  </Button>
                }
              />
              <CardContent className="p-0">
                <div className="divide-y">
                  {alerts.map((alert, index) => (
                    <div
                      key={alert}
                      className="flex items-start gap-3 px-4 py-3 text-xs"
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white",
                          index === 0 && exceptions > 0
                            ? "bg-red-500"
                            : "bg-orange-500",
                        )}
                      >
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-800">{alert}</p>
                        <p className="mt-1 text-orange-600">Action suggested</p>
                      </div>
                      <span className="text-slate-400">{index + 1}h ago</span>
                    </div>
                  ))}
                </div>
                <div className="border-t bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-600">
                    Suggested next step
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-md border bg-white p-2 text-xs text-slate-500">
                    <span>{text.suggestedNextStep}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-md text-xs"
                    >
                      Review Suggestions
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="gap-0 overflow-hidden rounded-lg border-border/70 bg-white py-0 shadow-sm">
              <SectionHeader
                title={text.slaPerformance}
                icon={<Info className="h-3.5 w-3.5 text-slate-400" />}
                tone={
                  slaMissed > 0 ? "red" : slaAtRisk > 0 ? "orange" : "emerald"
                }
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-blue-700 hover:bg-emerald-100/80 hover:text-emerald-900 focus-visible:ring-2 focus-visible:ring-emerald-300"
                  >
                    View report
                  </Button>
                }
              />
              <CardContent className="p-4">
                <div className="grid grid-cols-[9.5rem_minmax(0,1fr)] items-center gap-4">
                  <SlaDonut
                    onTime={delivered}
                    atRisk={slaAtRisk}
                    missed={slaMissed}
                  />
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        On Time
                      </span>
                      <span>{delivered}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-orange-400" />
                        At Risk
                      </span>
                      <span>{slaAtRisk}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        Missed
                      </span>
                      <span>{slaMissed}</span>
                    </div>
                    <div className="border-t pt-3 text-[11px] text-slate-500">
                      {slaMeasuredTotal > 0
                        ? `${slaMeasuredTotal} shipments measured`
                        : "No SLA exposure in current view"}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs">
                  <span>SLA breaches today</span>
                  <span className="font-semibold text-red-600">
                    {slaMissed}
                  </span>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </PageShell>
  );
}
