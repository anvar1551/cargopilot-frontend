"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchOrderById, fetchOrders } from "@/lib/orders";
import { fetchManagerOverview } from "@/lib/manager";
import { getStatusLabel } from "@/lib/i18n/labels";
import { usePageVisibility } from "@/lib/usePageVisibility";

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
  Boxes,
  CheckCircle2,
  Clock3,
  FileText,
  Package,
  Send,
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
};

type StatusBarItem = {
  status: string;
  count: number;
  pct: number;
};

const copy = {
  en: {
    badge: "Control Center",
    title: "Manager Operations Dashboard",
    subtitle:
      "Real-time operational snapshot with queue pressure, delivery flow, and dispatch shortcuts.",
    openDispatch: "Open Dispatch",
    ordersQueue: "Orders Queue",
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
    badge: "Центр управления",
    title: "Операционная панель менеджера",
    subtitle:
      "Операционный срез в реальном времени: нагрузка очередей, поток доставки и быстрые переходы в диспетчерскую.",
    openDispatch: "Открыть диспетчерскую",
    ordersQueue: "Очередь заказов",
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
    badge: "Boshqaruv markazi",
    title: "Menejer operatsion dashboardi",
    subtitle:
      "Navbat bosimi, delivery oqimi va dispatch shortcutlari bilan real vaqt operatsion ko'rinishi.",
    openDispatch: "Dispatchni ochish",
    ordersQueue: "Buyurtmalar navbati",
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

function StatTile({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string;
  value: number | string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="rounded-2xl border-border/70">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {title}
            </p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </div>
          <div className="rounded-xl border bg-muted/40 p-2">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ManagerDashboardPage() {
  const { locale, t } = useI18n();
  const text = copy[locale];
  const queryClient = useQueryClient();
  const isPageVisible = usePageVisibility();

  const overviewQuery = useQuery<ManagerOverview>({
    queryKey: ["manager-overview"],
    queryFn: fetchManagerOverview,
    staleTime: 30_000,
    refetchInterval: isPageVisible ? 120_000 : false,
    refetchOnWindowFocus: false,
  });

  const ordersQuery = useQuery<OrdersResponseLike | OrderLite[]>({
    queryKey: ["manager-dashboard-orders"],
    queryFn: () =>
      fetchOrders({
        mode: "cursor",
        scope: "fast",
        limit: 80,
      }),
    staleTime: 20_000,
    refetchInterval: isPageVisible ? 90_000 : false,
    refetchOnWindowFocus: false,
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
  const kpis = {
    totalOrders: overview?.totalOrders ?? totalOrders,
    pendingOrders: overview?.pendingOrders ?? pending,
    assignedOrders: overview?.assignedOrders ?? assigned,
    activeDrivers: overview?.activeDrivers ?? "-",
  };

  const statusBars = useMemo<StatusBarItem[]>(() => {
    if (totalOrders === 0) return [];
    return Array.from(statusCounts.entries())
      .map(([status, count]) => ({
        status,
        count,
        pct: Math.max(2, Math.round((count / totalOrders) * 100)),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [statusCounts, totalOrders]);

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

    const max = Math.max(1, ...buckets.map((item) => item.count));
    return buckets.map((item) => ({
      ...item,
      heightPct: Math.max(8, Math.round((item.count / max) * 100)),
    }));
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

  const loading = overviewQuery.isLoading || ordersQuery.isLoading;
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

  return (
    <PageShell>
      <div className="w-full space-y-6">
        <Card className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-white">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan-400/15 blur-2xl" />
          <div className="absolute -left-14 -bottom-14 h-52 w-52 rounded-full bg-sky-300/10 blur-2xl" />
          <CardContent className="relative p-4 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs">
                  <Boxes className="h-3.5 w-3.5" />
                  {text.badge}
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {text.title}
                </h1>
                <p className="max-w-2xl text-sm text-slate-100/85">
                  {text.subtitle}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <CreateOrderDialog
                  mode="manager"
                  triggerClassName="h-10 rounded-md border-white/20 bg-white px-4 text-slate-950 shadow-none hover:bg-white/90"
                />
                <Button asChild variant="secondary" className="h-10">
                  <Link href="/dashboard/manager/dispatch" className="gap-2">
                    <Send className="h-4 w-4" />
                    {text.openDispatch}
                  </Link>
                </Button>
                <Button asChild variant="secondary" className="h-10">
                  <Link href="/dashboard/manager/orders" className="gap-2">
                    <Package className="h-4 w-4" />
                    {text.ordersQueue}
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {loading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="rounded-2xl">
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="mt-2 h-8 w-16" />
                  <Skeleton className="mt-2 h-3 w-24" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <StatTile
                title={text.totalOrders}
                value={kpis.totalOrders}
                hint={text.totalOrdersHint}
                icon={Package}
              />
              <StatTile
                title={text.activePipeline}
                value={activePipeline}
                hint={text.activePipelineHint}
                icon={Clock3}
              />
              <StatTile
                title={text.pending}
                value={kpis.pendingOrders}
                hint={text.pendingHint}
                icon={Truck}
              />
              <StatTile
                title={text.atWarehouse}
                value={atWarehouse}
                hint={text.atWarehouseHint}
                icon={Warehouse}
              />
              <StatTile
                title={text.deliveredToday}
                value={deliveredToday}
                hint={text.deliveredTodayHint}
                icon={CheckCircle2}
              />
              <StatTile
                title={text.activeDrivers}
                value={kpis.activeDrivers}
                hint={text.activeDriversHint}
                icon={Users}
              />
            </>
          )}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Card className="rounded-2xl border-border/70">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">{text.recentOrders}</CardTitle>
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard/manager/orders">{text.viewAll}</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {ordersQuery.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : recentOrders.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  {text.noOrders}
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border bg-background">
                  <div className="divide-y">
                    {recentOrders.map((order) => (
                      <Link
                        key={order.id}
                        href={`/dashboard/manager?order=${order.id}`}
                        onMouseEnter={() => prefetchOrderDetails(order.id)}
                        onFocus={() => prefetchOrderDetails(order.id)}
                        onTouchStart={() => prefetchOrderDetails(order.id)}
                        className="block p-4 transition hover:bg-muted/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant={statusVariant(
                                  String(order.status ?? ""),
                                )}
                                className="capitalize"
                              >
                                {getStatusLabel(
                                  String(order.status ?? "unknown"),
                                  t,
                                )}
                              </Badge>
                              <span className="text-xs font-mono text-muted-foreground">
                                {orderRef(order, text.unnumberedOrder)}
                              </span>
                              {hasInvoiceReady(order) ? (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                  <FileText className="h-3.5 w-3.5" />
                                  {text.invoice}
                                </span>
                              ) : null}
                              {hasPaymentPending(order) ? (
                                <span className="text-xs text-amber-600">
                                  {text.paymentPending}
                                </span>
                              ) : null}
                            </div>

                            <div className="truncate text-sm font-medium">
                              {order.pickupAddress || "-"}{" "}
                              <span className="text-muted-foreground">
                                {"->"}
                              </span>{" "}
                              {order.dropoffAddress || "-"}
                            </div>

                            <div className="text-xs text-muted-foreground">
                              {order.customer?.email
                                ? `${text.customerPrefix}: ${order.customer.email}`
                                : `${text.customerPrefix}: -`}
                              {order.createdAt
                                ? ` | ${formatShortDate(order.createdAt, locale)}`
                                : ""}
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            className="hidden gap-2 sm:inline-flex"
                          >
                            {text.details} <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{text.flowSnapshot}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {statusBars.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  {text.noStatusDistribution}
                </div>
              ) : (
                statusBars.map((item) => (
                  <div key={item.status} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="capitalize text-muted-foreground">
                        {getStatusLabel(item.status, t)}
                      </span>
                      <span className="font-medium">{item.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </div>
                ))
              )}

              <div className="rounded-xl border bg-muted/25 p-3 text-xs text-muted-foreground">
                {text.inTransit}:{" "}
                <span className="font-medium text-foreground">{inTransit}</span>
                {" | "}
                {text.outForDelivery}:{" "}
                <span className="font-medium text-foreground">
                  {outForDelivery}
                </span>
                {" | "}
                {text.exceptions}:{" "}
                <span className="font-medium text-foreground">
                  {exceptions}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Card className="rounded-2xl border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{text.throughput}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {last7Days.map((day) => (
                  <div
                    key={day.key}
                    className="rounded-xl border bg-background/70 p-2"
                  >
                    <div className="flex h-24 items-end">
                      <div
                        className="w-full rounded-md bg-gradient-to-t from-primary to-primary/40"
                        style={{ height: `${day.heightPct}%` }}
                      />
                    </div>
                    <div className="mt-2 text-center text-xs text-muted-foreground">
                      {day.label}
                    </div>
                    <div className="text-center text-sm font-medium">
                      {day.count}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {text.operationalRadar}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {alerts.map((alert) => (
                <div
                  key={alert}
                  className="flex items-start gap-2 rounded-xl border bg-background/70 px-3 py-2"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <span>{alert}</span>
                </div>
              ))}

              <div className="rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
                {text.suggestedNextStep}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
