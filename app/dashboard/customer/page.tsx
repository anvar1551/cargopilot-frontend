"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  FileSpreadsheet,
  Headphones,
  Mail,
  MapPinned,
  Upload,
  Package,
  Phone,
  ShieldCheck,
  Truck,
} from "lucide-react";

import { getUser } from "@/lib/auth";
import { getStatusLabel } from "@/lib/i18n/labels";
import { fetchOrders, type OrderStatus, type OrdersResponse } from "@/lib/orders";

import { useI18n } from "@/components/i18n/I18nProvider";
import BulkOrderImportDialog from "@/components/orders/BulkOrderImportDialog";
import CreateOrderDialog from "@/components/orders/CreateOrderDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

type InvoiceState = {
  invoiceUrl?: string | null;
  paymentUrl?: string | null;
  status?: string | null;
};

type CustomerOrder = {
  id: string;
  orderNumber?: string | number | null;
  status?: OrderStatus | string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  destinationCity?: string | null;
  labelUrl?: string | null;
  invoice?: InvoiceState | null;
  Invoice?: InvoiceState | null;
};

const copy = {
  en: {
    badge: "Customer Control Center",
    title: "Customer Dashboard",
    subtitle:
      "Create shipments, upload bulk CSVs, track live delivery movement, and reach support from one place.",
    activeShipments: "Active shipments",
    activeShipmentsHint: "Not in a final state",
    delivered: "Delivered",
    deliveredHint: "Closed successfully",
    paymentPending: "Payment pending",
    paymentPendingHint: "Invoice or payment link requires action",
    exceptions: "Needs attention",
    exceptionsHint: "Shipment has an issue or return flow",
    newShipment: "New shipment",
    bulkImport: "Bulk import",
    viewOrders: "View all orders",
    support: "Support",
    supportTitle: "Customer support",
    supportSubtitle:
      "Need help with pickup, invoice, address correction, or delivery timing? Use the fastest channel below.",
    supportHours: "Support hours",
    supportHoursValue: "Mon-Fri, 08:00-18:00",
    callSupport: "Call support",
    emailSupport: "Email support",
    recentActivity: "Recent activity",
    recentActivitySubtitle: "Latest shipment movement and customer-facing events.",
    noActivity: "No shipment activity yet.",
    spotlightTitle: "Attention required",
    spotlightEmpty: "No exception shipments right now.",
    spotlightHint: "Open the affected order and contact support if a manual decision is needed.",
    recentOrders: "Recent orders",
    recentOrdersSubtitle: "Your latest shipments with the most important next actions.",
    noOrders: "No shipments yet.",
    noOrdersHint: "Create your first shipment or upload a CSV batch to get started.",
    openDetails: "Open details",
    from: "From",
    to: "To",
    created: "Created",
    docsReady: "Docs ready",
    paymentAction: "Payment action",
    paymentDone: "Paid",
    labelReady: "Label ready",
    activityCreated: "Shipment created",
    activityStatus: "Status updated to {status}",
    customerNameFallback: "Customer",
  },
  ru: {
    badge: "Панель клиента",
    title: "Кабинет клиента",
    subtitle:
      "Создавайте отправления, загружайте CSV-пакеты, отслеживайте движение доставки и связывайтесь с поддержкой из одного места.",
    activeShipments: "Активные отправления",
    activeShipmentsHint: "Еще не в финальном статусе",
    delivered: "Доставлено",
    deliveredHint: "Успешно завершено",
    paymentPending: "Ожидает оплаты",
    paymentPendingHint: "Счет или ссылка на оплату требуют действия",
    exceptions: "Требует внимания",
    exceptionsHint: "Есть проблема или возвратный сценарий",
    newShipment: "Новая отправка",
    bulkImport: "Массовый импорт",
    viewOrders: "Все заказы",
    support: "Поддержка",
    supportTitle: "Поддержка клиентов",
    supportSubtitle:
      "Нужна помощь с забором, счетом, корректировкой адреса или сроками доставки? Используйте самый удобный канал ниже.",
    supportHours: "Часы поддержки",
    supportHoursValue: "Пн-Пт, 08:00-18:00",
    callSupport: "Позвонить в поддержку",
    emailSupport: "Написать в поддержку",
    recentActivity: "Последняя активность",
    recentActivitySubtitle: "Последние движения отправлений и клиентские события.",
    noActivity: "Пока нет активности по отправлениям.",
    spotlightTitle: "Требует внимания",
    spotlightEmpty: "Сейчас нет отправлений с проблемами.",
    spotlightHint: "Откройте проблемный заказ и свяжитесь с поддержкой, если нужно ручное решение.",
    recentOrders: "Последние заказы",
    recentOrdersSubtitle: "Ваши последние отправления с самыми важными следующими действиями.",
    noOrders: "Отправлений пока нет.",
    noOrdersHint: "Создайте первое отправление или загрузите CSV-пакет, чтобы начать.",
    openDetails: "Открыть детали",
    from: "Откуда",
    to: "Куда",
    created: "Создан",
    docsReady: "Документы готовы",
    paymentAction: "Требуется оплата",
    paymentDone: "Оплачено",
    labelReady: "Наклейка готова",
    activityCreated: "Отправление создано",
    activityStatus: "Статус изменен на {status}",
    customerNameFallback: "Клиент",
  },
  uz: {
    badge: "Mijoz boshqaruv markazi",
    title: "Mijoz dashboardi",
    subtitle:
      "Jo'natma yarating, CSV batch yuklang, delivery holatini kuzating va support bilan bir joydan bog'laning.",
    activeShipments: "Faol jo'natmalar",
    activeShipmentsHint: "Final statusga yetmagan",
    delivered: "Yetkazilgan",
    deliveredHint: "Muvaffaqiyatli yopilgan",
    paymentPending: "To'lov kutilmoqda",
    paymentPendingHint: "Invoice yoki payment link bo'yicha amal kerak",
    exceptions: "E'tibor talab qiladi",
    exceptionsHint: "Muammo yoki return jarayoni bor",
    newShipment: "Yangi jo'natma",
    bulkImport: "Bulk import",
    viewOrders: "Barcha buyurtmalar",
    support: "Support",
    supportTitle: "Mijozlar supporti",
    supportSubtitle:
      "Pickup, invoice, manzilni tuzatish yoki delivery vaqti bo'yicha yordam kerakmi? Quyidagi qulay kanalni tanlang.",
    supportHours: "Support vaqti",
    supportHoursValue: "Du-Ju, 08:00-18:00",
    callSupport: "Supportga qo'ng'iroq qilish",
    emailSupport: "Supportga yozish",
    recentActivity: "So'nggi faollik",
    recentActivitySubtitle: "Jo'natma harakati va mijozga ko'rinadigan so'nggi voqealar.",
    noActivity: "Hozircha jo'natmalar bo'yicha faollik yo'q.",
    spotlightTitle: "E'tibor talab qiladi",
    spotlightEmpty: "Hozircha muammoli jo'natmalar yo'q.",
    spotlightHint: "Muammoli buyurtmani oching va kerak bo'lsa support bilan bog'laning.",
    recentOrders: "So'nggi buyurtmalar",
    recentOrdersSubtitle: "Sizning so'nggi jo'natmalaringiz va keyingi muhim amallar.",
    noOrders: "Hali jo'natmalar yo'q.",
    noOrdersHint: "Boshlash uchun birinchi jo'natmani yarating yoki CSV batch yuklang.",
    openDetails: "Tafsilotlarni ochish",
    from: "Qayerdan",
    to: "Qayerga",
    created: "Yaratilgan",
    docsReady: "Hujjatlar tayyor",
    paymentAction: "To'lov kerak",
    paymentDone: "To'langan",
    labelReady: "Label tayyor",
    activityCreated: "Jo'natma yaratildi",
    activityStatus: "Status {status} ga o'zgardi",
    customerNameFallback: "Mijoz",
  },
} as const;

function hasInvoiceReady(order: CustomerOrder) {
  const invoice = order.invoice ?? order.Invoice;
  return Boolean(invoice?.invoiceUrl);
}

function hasPaymentPending(order: CustomerOrder) {
  const invoice = order.invoice ?? order.Invoice;
  return Boolean(invoice?.paymentUrl) && invoice?.status !== "paid";
}

function isPaid(order: CustomerOrder) {
  const invoice = order.invoice ?? order.Invoice;
  return invoice?.status === "paid";
}

function isFinalStatus(status?: string | null) {
  return ["delivered", "returned", "cancelled"].includes(String(status ?? ""));
}

function isExceptionStatus(status?: string | null) {
  return ["exception", "return_in_progress"].includes(String(status ?? ""));
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function DashboardSkeleton() {
  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <Skeleton className="h-56 w-full rounded-[2rem]" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-3xl" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
          <Skeleton className="h-[420px] rounded-3xl" />
          <Skeleton className="h-[420px] rounded-3xl" />
        </div>
      </div>
    </div>
  );
}

export default function CustomerDashboard() {
  const { locale, t } = useI18n();
  const text = copy[locale];
  const user = useMemo(() => getUser(), []);

  const { data, isLoading, error } = useQuery<OrdersResponse>({
    queryKey: ["orders"],
    queryFn: () => fetchOrders({ limit: 100, mode: "cursor" }),
  });

  const orderList = useMemo(() => (data?.orders ?? []) as CustomerOrder[], [data]);

  const sortedOrders = useMemo(() => {
    return [...orderList].sort((left, right) => {
      const leftDate = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightDate = right.createdAt ? new Date(right.createdAt).getTime() : 0;
      return rightDate - leftDate;
    });
  }, [orderList]);

  const activeOrders = orderList.filter((order) => !isFinalStatus(order.status));
  const deliveredOrders = orderList.filter((order) => order.status === "delivered");
  const paymentPendingOrders = orderList.filter(hasPaymentPending);
  const exceptionOrders = orderList.filter((order) => isExceptionStatus(order.status));
  const recentOrders = sortedOrders.slice(0, 6);
  const recentActivity = sortedOrders.slice(0, 5);
  const spotlightOrder = exceptionOrders[0] ?? null;

  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@cargopilot.app";
  const supportPhone = process.env.NEXT_PUBLIC_SUPPORT_PHONE || "+49 40 0000 0000";
  const customerLabel = user?.name || user?.email || text.customerNameFallback;
  const customerEntityId = user?.customerEntityId ?? null;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <Card className="mx-auto max-w-5xl rounded-3xl border-destructive/30">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Failed to load customer dashboard.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-border/60 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(11,92,122,0.92),rgba(255,255,255,0.98))] text-white">
          <div className="absolute -right-20 -top-16 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-sky-300/10 blur-3xl" />
          <div className="relative grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:p-8">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/90">
                <ShieldCheck className="h-3.5 w-3.5" />
                {text.badge}
              </div>

              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight">{text.title}</h1>
                <p className="max-w-3xl text-sm text-slate-100/85">{text.subtitle}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/70">
                    {text.activeShipments}
                  </p>
                  <p className="mt-3 text-3xl font-semibold">{activeOrders.length}</p>
                  <p className="mt-2 text-xs text-white/70">{text.activeShipmentsHint}</p>
                </div>
                <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/70">
                    {text.delivered}
                  </p>
                  <p className="mt-3 text-3xl font-semibold">{deliveredOrders.length}</p>
                  <p className="mt-2 text-xs text-white/70">{text.deliveredHint}</p>
                </div>
                <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/70">
                    {text.paymentPending}
                  </p>
                  <p className="mt-3 text-3xl font-semibold">{paymentPendingOrders.length}</p>
                  <p className="mt-2 text-xs text-white/70">{text.paymentPendingHint}</p>
                </div>
                <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/70">
                    {text.exceptions}
                  </p>
                  <p className="mt-3 text-3xl font-semibold">{exceptionOrders.length}</p>
                  <p className="mt-2 text-xs text-white/70">{text.exceptionsHint}</p>
                </div>
              </div>
            </div>

            <div className="flex w-full max-w-sm flex-col gap-3 lg:w-[300px]">
              <CreateOrderDialog triggerLabel={text.newShipment} />
              {customerEntityId ? (
                <BulkOrderImportDialog
                  customerEntityId={customerEntityId}
                  customerLabel={customerLabel}
                  trigger={
                    <Button variant="secondary" className="rounded-2xl">
                      <Upload className="h-4 w-4" />
                      {text.bulkImport}
                    </Button>
                  }
                />
              ) : null}
              <Button asChild variant="secondary" className="rounded-2xl">
                <Link href="/dashboard/customer/orders">
                  <Package className="h-4 w-4" />
                  {text.viewOrders}
                </Link>
              </Button>
              <Button asChild variant="secondary" className="rounded-2xl">
                <a href={`mailto:${supportEmail}`}>
                  <Headphones className="h-4 w-4" />
                  {text.support}
                </a>
              </Button>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
          <div className="space-y-6">
            <Card className="rounded-3xl border border-border/60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">{text.recentActivity}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {text.recentActivitySubtitle}
                    </p>
                  </div>
                  <Badge variant="outline" className="rounded-full">
                    {recentActivity.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {recentActivity.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
                    {text.noActivity}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentActivity.map((order) => (
                      <div key={order.id} className="flex gap-4">
                        <div className="flex w-10 flex-col items-center">
                          <div className="rounded-2xl border border-border/60 bg-background p-2">
                            <Clock3 className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="mt-2 h-full w-px bg-border" />
                        </div>
                        <div className="min-w-0 flex-1 rounded-3xl border border-border/60 bg-background/70 p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="rounded-full">
                              {order.orderNumber ? `#${order.orderNumber}` : text.activityCreated}
                            </Badge>
                            <Badge className="rounded-full" variant="secondary">
                              {getStatusLabel(String(order.status ?? ""), t)}
                            </Badge>
                          </div>
                          <p className="mt-3 text-sm font-medium">
                            {t("common.status." + String(order.status ?? "pending")) ===
                            "common.status." + String(order.status ?? "pending")
                              ? text.activityStatus.replace(
                                  "{status}",
                                  getStatusLabel(String(order.status ?? ""), t),
                                )
                              : text.activityStatus.replace(
                                  "{status}",
                                  getStatusLabel(String(order.status ?? ""), t),
                                )}
                          </p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {order.pickupAddress || "-"} {"->"} {order.dropoffAddress || "-"}
                          </p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {formatDate(order.updatedAt ?? order.createdAt, locale)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border border-border/60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">{text.recentOrders}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {text.recentOrdersSubtitle}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm" className="rounded-full">
                    <Link href="/dashboard/customer/orders">{text.viewOrders}</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {recentOrders.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">{text.noOrders}</p>
                    <p className="mt-2">{text.noOrdersHint}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentOrders.map((order) => (
                      <div
                        key={order.id}
                        className="rounded-3xl border border-border/60 bg-background/70 p-4 transition hover:bg-muted/20"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary" className="rounded-full">
                                {getStatusLabel(String(order.status ?? ""), t)}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {order.orderNumber ? `#${order.orderNumber}` : text.activityCreated}
                              </span>
                              {hasInvoiceReady(order) ? (
                                <Badge variant="outline" className="rounded-full">
                                  {text.docsReady}
                                </Badge>
                              ) : null}
                              {hasPaymentPending(order) ? (
                                <Badge variant="outline" className="rounded-full">
                                  {text.paymentAction}
                                </Badge>
                              ) : null}
                              {isPaid(order) ? (
                                <Badge variant="outline" className="rounded-full">
                                  {text.paymentDone}
                                </Badge>
                              ) : null}
                              {order.labelUrl ? (
                                <Badge variant="outline" className="rounded-full">
                                  {text.labelReady}
                                </Badge>
                              ) : null}
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="flex items-start gap-3">
                                <div className="rounded-2xl border border-border/60 bg-muted/20 p-2">
                                  <MapPinned className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                    {text.from}
                                  </p>
                                  <p className="mt-1 truncate text-sm font-medium">
                                    {order.pickupAddress || "-"}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-start gap-3">
                                <div className="rounded-2xl border border-border/60 bg-muted/20 p-2">
                                  <Truck className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                    {text.to}
                                  </p>
                                  <p className="mt-1 truncate text-sm font-medium">
                                    {order.dropoffAddress || order.destinationCity || "-"}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <p className="text-xs text-muted-foreground">
                              {text.created} {formatDate(order.createdAt, locale)}
                            </p>
                          </div>

                          <Button asChild variant="outline" className="rounded-2xl">
                            <Link href={`/dashboard/customer/orders/${order.id}`}>
                              {text.openDetails}
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="rounded-3xl border border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl">{text.spotlightTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                {spotlightOrder ? (
                  <div className="rounded-3xl border border-amber-300/40 bg-amber-50 p-5 text-amber-950">
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl bg-amber-500/10 p-2">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                      </div>
                      <div className="space-y-2">
                        <p className="font-semibold">
                          {spotlightOrder.orderNumber
                            ? `#${spotlightOrder.orderNumber}`
                            : text.spotlightTitle}
                        </p>
                        <p className="text-sm">
                          {getStatusLabel(String(spotlightOrder.status ?? ""), t)}
                        </p>
                        <p className="text-sm opacity-80">
                          {text.spotlightHint}
                        </p>
                        <Button asChild size="sm" variant="outline" className="rounded-full bg-white/80">
                          <Link href={`/dashboard/customer/orders/${spotlightOrder.id}`}>
                            {text.openDetails}
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
                    {text.spotlightEmpty}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl">{text.supportTitle}</CardTitle>
                <p className="text-sm text-muted-foreground">{text.supportSubtitle}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-3xl border border-border/60 bg-muted/20 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl border border-border/60 bg-background p-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {text.support}
                      </p>
                      <p className="mt-1 text-sm font-medium">{supportPhone}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-border/60 bg-muted/20 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl border border-border/60 bg-background p-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Email
                      </p>
                      <p className="mt-1 text-sm font-medium">{supportEmail}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {text.supportHours}
                  </p>
                  <p className="mt-2 text-sm font-medium">{text.supportHoursValue}</p>
                </div>

                <Separator />

                <div className="grid gap-3">
                  <Button asChild className="rounded-2xl">
                    <a href={`tel:${supportPhone.replace(/\s+/g, "")}`}>
                      <Phone className="h-4 w-4" />
                      {text.callSupport}
                    </a>
                  </Button>
                  <Button asChild variant="outline" className="rounded-2xl">
                    <a href={`mailto:${supportEmail}`}>
                      <Mail className="h-4 w-4" />
                      {text.emailSupport}
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl">{text.bulkImport}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  {locale === "ru"
                    ? "Используйте CSV-шаблон, чтобы быстро загрузить несколько отправлений за один раз."
                    : locale === "uz"
                      ? "Bir nechta jo'natmalarni bir martada yuklash uchun CSV shablondan foydalaning."
                      : "Use the CSV template to upload multiple shipments in one go."}
                </p>
                <div className="rounded-3xl border border-border/60 bg-muted/20 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl border border-border/60 bg-background p-2">
                      <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{text.bulkImport}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {locale === "ru"
                          ? "Тот же безопасный импорт, что и у менеджера, но привязанный к вашей сущности клиента."
                          : locale === "uz"
                            ? "Menejer bilan bir xil xavfsiz import oqimi, lekin sizning customer entity ga bog'langan."
                            : "The same controlled import flow as manager mode, bound to your customer entity."}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
