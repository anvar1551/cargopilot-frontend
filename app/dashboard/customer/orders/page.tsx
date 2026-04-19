"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  MapPin,
  Package,
  Search,
  SlidersHorizontal,
  Tag,
  Truck,
} from "lucide-react";

import { fetchOrders, type OrderStatus, type OrdersResponse } from "@/lib/orders";
import { getStatusLabel } from "@/lib/i18n/labels";

import { useI18n } from "@/components/i18n/I18nProvider";
import CreateOrderDialog from "@/components/orders/CreateOrderDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  labelUrl?: string | null;
  invoice?: InvoiceState | null;
  Invoice?: InvoiceState | null;
};

const copy = {
  en: {
    loadFailedTitle: "Could not load orders",
    loadFailedSubtitle: "Please refresh the page and try again.",
    badge: "Shipment Desk",
    title: "My Orders",
    subtitle: "Track every shipment, filter your queue, and open the next action quickly.",
    allOrders: "All orders",
    activeOrders: "Active",
    deliveredOrders: "Delivered",
    recentShipments: "Recent shipments",
    recentShipmentsSubtitle: "Search, filter, and sort all customer-facing shipments in one place.",
    searchPlaceholder: "Search by order number, address, or status...",
    statusPlaceholder: "Status",
    allStatuses: "All statuses",
    sortPlaceholder: "Sort",
    newestFirst: "Newest first",
    oldestFirst: "Oldest first",
    noMatchingOrders: "No matching orders",
    noMatchingOrdersHint: "Try clearing filters or create a new shipment.",
    resetFilters: "Reset filters",
    orderInProgress: "Order in progress",
    labelReady: "Label ready",
    invoiceReady: "Invoice ready",
    paymentPending: "Payment pending",
    paid: "Paid",
    pickup: "Pickup",
    dropoff: "Dropoff",
    created: "Created",
    viewDetails: "View details",
    activeSummary: "Active pipeline",
    deliveredSummary: "Delivered",
    paymentSummary: "Awaiting payment",
    activeSummaryHint: "Not yet in a final state",
    deliveredSummaryHint: "Successfully closed shipments",
    paymentSummaryHint: "Orders waiting for customer payment action",
    newShipment: "New shipment",
    back: "Back",
  },
  ru: {
    loadFailedTitle: "Не удалось загрузить заказы",
    loadFailedSubtitle: "Обновите страницу и попробуйте снова.",
    badge: "Панель отправлений",
    title: "Мои заказы",
    subtitle: "Отслеживайте все отправления, фильтруйте очередь и быстро переходите к следующему действию.",
    allOrders: "Все заказы",
    activeOrders: "Активные",
    deliveredOrders: "Доставленные",
    recentShipments: "Последние отправления",
    recentShipmentsSubtitle: "Поиск, фильтры и сортировка всех клиентских отправлений в одном месте.",
    searchPlaceholder: "Поиск по номеру заказа, адресу или статусу...",
    statusPlaceholder: "Статус",
    allStatuses: "Все статусы",
    sortPlaceholder: "Сортировка",
    newestFirst: "Сначала новые",
    oldestFirst: "Сначала старые",
    noMatchingOrders: "Подходящие заказы не найдены",
    noMatchingOrdersHint: "Попробуйте сбросить фильтры или создать новое отправление.",
    resetFilters: "Сбросить фильтры",
    orderInProgress: "Заказ в обработке",
    labelReady: "Наклейка готова",
    invoiceReady: "Счет готов",
    paymentPending: "Ожидается оплата",
    paid: "Оплачено",
    pickup: "Забор",
    dropoff: "Доставка",
    created: "Создан",
    viewDetails: "Открыть детали",
    activeSummary: "Активный поток",
    deliveredSummary: "Доставлено",
    paymentSummary: "Ожидает оплаты",
    activeSummaryHint: "Еще не в финальном статусе",
    deliveredSummaryHint: "Успешно завершенные отправления",
    paymentSummaryHint: "Заказы, где требуется действие по оплате",
    newShipment: "Новая отправка",
    back: "Назад",
  },
  uz: {
    loadFailedTitle: "Buyurtmalarni yuklab bo'lmadi",
    loadFailedSubtitle: "Sahifani yangilang va qayta urinib ko'ring.",
    badge: "Jo'natma paneli",
    title: "Mening buyurtmalarim",
    subtitle: "Barcha jo'natmalarni kuzating, navbatni filtrlang va keyingi amalni tez oching.",
    allOrders: "Barcha buyurtmalar",
    activeOrders: "Faol",
    deliveredOrders: "Yetkazilgan",
    recentShipments: "So'nggi jo'natmalar",
    recentShipmentsSubtitle: "Barcha customer-facing jo'natmalarni bir joyda qidiring, filtrlang va saralang.",
    searchPlaceholder: "Buyurtma raqami, manzil yoki status bo'yicha qidiring...",
    statusPlaceholder: "Status",
    allStatuses: "Barcha statuslar",
    sortPlaceholder: "Saralash",
    newestFirst: "Avval yangilar",
    oldestFirst: "Avval eskilar",
    noMatchingOrders: "Mos buyurtmalar topilmadi",
    noMatchingOrdersHint: "Filtrlarni tozalang yoki yangi jo'natma yarating.",
    resetFilters: "Filtrlarni tiklash",
    orderInProgress: "Buyurtma jarayonda",
    labelReady: "Label tayyor",
    invoiceReady: "Hisob-faktura tayyor",
    paymentPending: "To'lov kutilmoqda",
    paid: "To'langan",
    pickup: "Olib ketish",
    dropoff: "Yetkazish",
    created: "Yaratilgan",
    viewDetails: "Tafsilotlarni ko'rish",
    activeSummary: "Faol oqim",
    deliveredSummary: "Yetkazilgan",
    paymentSummary: "To'lov kutilmoqda",
    activeSummaryHint: "Hali final statusga yetmagan",
    deliveredSummaryHint: "Muvaffaqiyatli yopilgan jo'natmalar",
    paymentSummaryHint: "Mijoz to'lov amali kerak bo'lgan buyurtmalar",
    newShipment: "Yangi jo'natma",
    back: "Orqaga",
  },
} as const;

function statusBadgeVariant(status: string) {
  switch (status) {
    case "delivered":
      return "default";
    case "out_for_delivery":
    case "at_warehouse":
    case "in_transit":
      return "secondary";
    case "exception":
    case "return_in_progress":
      return "destructive";
    default:
      return "outline";
  }
}

function hasInvoiceReady(order: CustomerOrder) {
  const invoice = order.invoice ?? order.Invoice;
  return Boolean(invoice?.invoiceUrl);
}

function hasLabelReady(order: CustomerOrder) {
  return Boolean(order.labelUrl);
}

function hasPaymentPending(order: CustomerOrder) {
  const invoice = order.invoice ?? order.Invoice;
  return Boolean(invoice?.paymentUrl) && invoice?.status !== "paid";
}

function isPaid(order: CustomerOrder) {
  const invoice = order.invoice ?? order.Invoice;
  return invoice?.status === "paid";
}

function isDelivered(order: CustomerOrder) {
  return order.status === "delivered";
}

function isFinalStatus(status?: string | null) {
  return ["delivered", "returned", "cancelled"].includes(String(status ?? ""));
}

function OrderRowSkeleton() {
  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="w-full space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <div className="w-full space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <div className="w-full space-y-2">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </div>
          <Skeleton className="h-3 w-40" />
        </div>

        <Skeleton className="hidden h-8 w-28 rounded-md sm:block" />
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: number;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="rounded-3xl border border-border/60">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
            <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-2.5">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CustomerOrdersPage() {
  const { locale, t } = useI18n();
  const text = copy[locale];

  const { data, isLoading, error } = useQuery<OrdersResponse>({
    queryKey: ["orders"],
    queryFn: () => fetchOrders({ limit: 100, mode: "cursor" }),
  });

  const orderList = useMemo(() => (data?.orders ?? []) as CustomerOrder[], [data]);

  const [tab, setTab] = useState<"all" | "active" | "delivered">("all");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");

  const filtered = useMemo(() => {
    let list = [...orderList];

    if (tab === "active") {
      list = list.filter((order) => !isDelivered(order));
    }
    if (tab === "delivered") {
      list = list.filter(isDelivered);
    }

    if (statusFilter !== "all") {
      list = list.filter((order) => String(order.status ?? "") === statusFilter);
    }

    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery) {
      list = list.filter((order) => {
        const orderNumber = String(order.orderNumber ?? "").toLowerCase();
        const pickup = String(order.pickupAddress ?? "").toLowerCase();
        const dropoff = String(order.dropoffAddress ?? "").toLowerCase();
        const status = String(order.status ?? "").toLowerCase();
        return (
          orderNumber.includes(normalizedQuery) ||
          pickup.includes(normalizedQuery) ||
          dropoff.includes(normalizedQuery) ||
          status.includes(normalizedQuery)
        );
      });
    }

    list.sort((left, right) => {
      const leftDate = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightDate = right.createdAt ? new Date(right.createdAt).getTime() : 0;
      return sortBy === "newest" ? rightDate - leftDate : leftDate - rightDate;
    });

    return list;
  }, [orderList, query, sortBy, statusFilter, tab]);

  const uniqueStatuses = useMemo(() => {
    const statuses = new Set<string>();
    orderList.forEach((order) => {
      const status = String(order.status ?? "");
      if (status) statuses.add(status);
    });
    return Array.from(statuses).sort();
  }, [orderList]);

  const activeCount = useMemo(
    () => orderList.filter((order) => !isFinalStatus(order.status)).length,
    [orderList],
  );
  const deliveredCount = useMemo(
    () => orderList.filter((order) => order.status === "delivered").length,
    [orderList],
  );
  const pendingPaymentCount = useMemo(
    () => orderList.filter(hasPaymentPending).length,
    [orderList],
  );

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <Card className="mx-auto max-w-5xl rounded-3xl">
          <CardHeader>
            <CardTitle>{text.loadFailedTitle}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {text.loadFailedSubtitle}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <Button asChild variant="ghost" className="w-fit rounded-2xl px-0 hover:bg-transparent">
          <Link href="/dashboard/customer">
            <ChevronLeft className="h-4 w-4" />
            {text.back}
          </Link>
        </Button>

        <section className="overflow-hidden rounded-[2rem] border border-border/60 bg-[linear-gradient(135deg,rgba(17,24,39,0.02),rgba(59,130,246,0.08),rgba(255,255,255,0.96))]">
          <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:p-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <Truck className="h-3.5 w-3.5" />
                {text.badge}
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight">{text.title}</h1>
                <p className="max-w-3xl text-sm text-muted-foreground">{text.subtitle}</p>
              </div>
            </div>

            <div className="flex items-start">
              <CreateOrderDialog triggerLabel={text.newShipment} />
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard
            label={text.activeSummary}
            value={activeCount}
            hint={text.activeSummaryHint}
            icon={Truck}
          />
          <SummaryCard
            label={text.deliveredSummary}
            value={deliveredCount}
            hint={text.deliveredSummaryHint}
            icon={Package}
          />
          <SummaryCard
            label={text.paymentSummary}
            value={pendingPaymentCount}
            hint={text.paymentSummaryHint}
            icon={CreditCard}
          />
        </div>

        <Card className="rounded-3xl border border-border/60">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-xl">{text.recentShipments}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {text.recentShipmentsSubtitle}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
                <TabsList className="rounded-2xl">
                  <TabsTrigger value="all">{text.allOrders}</TabsTrigger>
                  <TabsTrigger value="active">{text.activeOrders}</TabsTrigger>
                  <TabsTrigger value="delivered">{text.deliveredOrders}</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <div className="relative w-full sm:w-[320px]">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={text.searchPlaceholder}
                    className="rounded-2xl pl-9"
                  />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <SlidersHorizontal className="hidden h-4 w-4 text-muted-foreground sm:block" />

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full rounded-2xl sm:w-[190px]">
                      <SelectValue placeholder={text.statusPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{text.allStatuses}</SelectItem>
                      {uniqueStatuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {getStatusLabel(status, t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                    <SelectTrigger className="w-full rounded-2xl sm:w-[160px]">
                      <SelectValue placeholder={text.sortPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">{text.newestFirst}</SelectItem>
                      <SelectItem value="oldest">{text.oldestFirst}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-border/60 bg-background">
              {isLoading ? (
                <>
                  <OrderRowSkeleton />
                  <OrderRowSkeleton />
                  <OrderRowSkeleton />
                </>
              ) : filtered.length === 0 ? (
                <div className="p-6">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-2xl border border-border/60 p-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="space-y-2">
                      <div className="font-medium">{text.noMatchingOrders}</div>
                      <p className="text-sm text-muted-foreground">{text.noMatchingOrdersHint}</p>
                      <div className="pt-1">
                        <Button
                          variant="outline"
                          className="rounded-2xl"
                          onClick={() => {
                            setQuery("");
                            setStatusFilter("all");
                            setTab("all");
                            setSortBy("newest");
                          }}
                        >
                          {text.resetFilters}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="divide-y">
                  {filtered.map((order) => (
                    <Link
                      key={order.id}
                      href={`/dashboard/customer/orders/${order.id}`}
                      className="group block p-4 transition hover:bg-muted/30"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant={statusBadgeVariant(String(order.status ?? ""))}
                              className="rounded-full capitalize"
                            >
                              {getStatusLabel(String(order.status ?? ""), t)}
                            </Badge>

                            <span className="text-xs text-muted-foreground">
                              {order.orderNumber ? `#${order.orderNumber}` : text.orderInProgress}
                            </span>

                            <div className="flex flex-wrap items-center gap-2">
                              {hasLabelReady(order) ? (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                  <Tag className="h-3.5 w-3.5" />
                                  {text.labelReady}
                                </span>
                              ) : null}
                              {hasInvoiceReady(order) ? (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                  <FileText className="h-3.5 w-3.5" />
                                  {text.invoiceReady}
                                </span>
                              ) : null}
                              {hasPaymentPending(order) ? (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                  <CreditCard className="h-3.5 w-3.5" />
                                  {text.paymentPending}
                                </span>
                              ) : null}
                              {isPaid(order) ? (
                                <span className="text-xs text-muted-foreground">{text.paid}</span>
                              ) : null}
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                            <div className="flex min-w-0 items-start gap-2">
                              <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium">
                                  {order.pickupAddress || "-"}
                                </div>
                                <div className="text-xs text-muted-foreground">{text.pickup}</div>
                              </div>
                            </div>

                            <ArrowRight className="hidden h-4 w-4 text-muted-foreground sm:block" />

                            <div className="flex min-w-0 items-start gap-2">
                              <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium">
                                  {order.dropoffAddress || "-"}
                                </div>
                                <div className="text-xs text-muted-foreground">{text.dropoff}</div>
                              </div>
                            </div>
                          </div>

                          {order.createdAt ? (
                            <div className="text-xs text-muted-foreground">
                              {text.created} {new Date(order.createdAt).toLocaleString(locale)}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" className="hidden rounded-2xl sm:inline-flex">
                            {text.viewDetails}
                          </Button>
                          <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
