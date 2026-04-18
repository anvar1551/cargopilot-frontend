"use client";

import Link from "next/link";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useI18n } from "@/components/i18n/I18nProvider";
import { getUser } from "@/lib/auth";
import {
  collectOrderCash,
  fetchOrderById,
  handoffOrderCash,
  settleOrderCash,
} from "@/lib/orders";
import { getInvoiceUrl, getOrderLabelUrls } from "@/lib/documents";
import {
  getPaidByLabel,
  getPaidStatusLabel,
  getPaymentTypeLabel,
  getRecipientUnavailableLabel,
  getReasonCodeLabel,
  getRoleLabel,
  getServiceTypeLabel,
  getStatusLabel,
  type Translate,
} from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import AssignDriverDialog from "@/components/manager/orders/AssignDriverDialog";

import {
  ArrowLeft,
  CalendarClock,
  CircleCheck,
  Clipboard,
  ExternalLink,
  FileText,
  Filter,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  ShieldAlert,
  Truck,
  User,
  UserPlus,
  Warehouse,
} from "lucide-react";

type LiteUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

type LiteWarehouse = {
  id?: string;
  name?: string | null;
  location?: string | null;
  region?: string | null;
};

type AddressSnapshot = {
  country?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  street?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  building?: string | null;
  apartment?: string | null;
  floor?: string | null;
  landmark?: string | null;
  postalCode?: string | null;
};

type Parcel = {
  id: string;
  pieceNo?: number | null;
  pieceTotal?: number | null;
  weightKg?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  parcelCode?: string | null;
  labelKey?: string | null;
  createdAt?: string | null;
};

type CashCollectionEvent = {
  id: string;
  eventType?: string | null;
  amount?: number | null;
  note?: string | null;
  fromHolderType?: string | null;
  fromHolderName?: string | null;
  toHolderType?: string | null;
  toHolderName?: string | null;
  createdAt?: string | null;
  actor?: LiteUser | null;
};

type CashCollection = {
  id: string;
  kind?: string | null;
  status?: string | null;
  expectedAmount?: number | null;
  collectedAmount?: number | null;
  currency?: string | null;
  currentHolderType?: string | null;
  currentHolderLabel?: string | null;
  currentHolderUser?: LiteUser | null;
  currentHolderWarehouse?: LiteWarehouse | null;
  collectedAt?: string | null;
  settledAt?: string | null;
  note?: string | null;
  events?: CashCollectionEvent[] | null;
};

type TrackingEvent = {
  id: string;
  status?: string | null;
  reasonCode?: string | null;
  note?: string | null;
  timestamp?: string | null;
  region?: string | null;
  actorRole?: string | null;
  warehouse?: LiteWarehouse | null;
  actor?: LiteUser | null;
  parcelId?: string | null;
  parcel?: Parcel | null;
};

type OrderDetails = {
  id: string;
  orderNumber?: string | null;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;

  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  destinationCity?: string | null;

  senderName?: string | null;
  senderPhone?: string | null;
  senderPhone2?: string | null;
  senderPhone3?: string | null;
  senderAddress?: string | null;
  receiverName?: string | null;
  receiverPhone?: string | null;
  receiverPhone2?: string | null;
  receiverPhone3?: string | null;
  receiverAddress?: string | null;

  customer?: LiteUser | null;
  customerEntity?: {
    id?: string;
    name?: string | null;
    type?: string | null;
    email?: string | null;
    phone?: string | null;
    companyName?: string | null;
    taxId?: string | null;
  } | null;

  assignedDriver?: LiteUser | null;
  currentWarehouse?: LiteWarehouse | null;

  serviceType?: string | null;
  weightKg?: number | null;
  itemValue?: number | null;
  currency?: string | null;
  codAmount?: number | null;
  paymentType?: string | null;
  deliveryChargePaidBy?: string | null;
  codPaidStatus?: string | null;
  serviceCharge?: number | null;
  serviceChargePaidStatus?: string | null;
  ifRecipientNotAvailable?: string | null;

  plannedPickupAt?: string | null;
  plannedDeliveryAt?: string | null;
  promiseDate?: string | null;

  referenceId?: string | null;
  shelfId?: string | null;
  promoCode?: string | null;
  numberOfCalls?: number | null;

  fragile?: boolean | null;
  dangerousGoods?: boolean | null;
  shipmentInsurance?: boolean | null;

  pickupAttemptCount?: number | null;
  deliveryAttemptCount?: number | null;
  lastExceptionReason?: string | null;
  lastExceptionAt?: string | null;

  senderAddressObj?: AddressSnapshot | null;
  receiverAddressObj?: AddressSnapshot | null;

  parcels?: Parcel[];
  trackingEvents?: TrackingEvent[];
  tracking?: TrackingEvent[];

  attachments?: Array<{
    id: string;
    key?: string | null;
    fileName?: string | null;
    mimeType?: string | null;
    size?: number | null;
    createdAt?: string | null;
  }>;
  cashCollections?: CashCollection[];

  invoice?: {
    id?: string;
    status?: string | null;
    paymentUrl?: string | null;
    amount?: number | null;
    invoiceKey?: string | null;
  } | null;
  Invoice?: {
    id?: string;
    status?: string | null;
    paymentUrl?: string | null;
    amount?: number | null;
    invoiceKey?: string | null;
  } | null;
  labelKey?: string | null;
};

const STATUS_FLOW = [
  "pending",
  "assigned",
  "pickup_in_progress",
  "picked_up",
  "at_warehouse",
  "in_transit",
  "out_for_delivery",
  "delivered",
];

const NEGATIVE_TERMINAL = new Set(["exception", "returned", "cancelled"]);
const STATUS_KEYS = new Set([
  ...STATUS_FLOW,
  "exception",
  "return_in_progress",
  "returned",
  "cancelled",
]);

function safeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toLower(value?: string | null) {
  return String(value ?? "").toLowerCase();
}

function prettyEnum(value?: string | null) {
  if (!value) return "-";
  return value
    .toLowerCase()
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function displayEnum(value: string | null | undefined, t: Translate) {
  if (!value) return "-";
  if (STATUS_KEYS.has(value)) return getStatusLabel(value, t);
  if (/^[A-Z0-9_]+$/.test(value)) return getReasonCodeLabel(value, t);
  if (["manager", "warehouse", "driver", "customer"].includes(value)) {
    return getRoleLabel(value, t);
  }
  return prettyEnum(value);
}

function displayPaidStatus(value: string | null | undefined, t: Translate) {
  if (!value) return "-";
  return getPaidStatusLabel(value, t);
}

function displayCashKind(value: string | null | undefined, t: Translate) {
  if (!value) return "-";
  return t(`orderDetails.cash.kind.${value}`);
}

function displayCashStatus(value: string | null | undefined, t: Translate) {
  if (!value) return "-";
  return t(`orderDetails.cash.status.${value}`);
}

function displayCashHolder(
  collection: CashCollection,
  t: Translate,
) {
  if (collection.currentHolderUser?.name) return collection.currentHolderUser.name;
  if (collection.currentHolderWarehouse?.name) return collection.currentHolderWarehouse.name;
  if (collection.currentHolderLabel) return collection.currentHolderLabel;
  if (!collection.currentHolderType || collection.currentHolderType === "none") {
    return t("orderDetails.cash.notCollected");
  }
  return t(`orderDetails.cash.holder.${collection.currentHolderType}`);
}

function cashActionId(collection: CashCollection, action: string) {
  return `${collection.id}:${action}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function formatMoney(amount?: number | null, currency?: string | null) {
  const n = safeNumber(amount);
  if (n == null) return "-";
  const cur = currency || "EUR";
  return `${n.toFixed(2)} ${cur}`;
}

function formatSize(bytes?: number | null) {
  const n = safeNumber(bytes);
  if (n == null) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function extractErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== "object") return fallback;

  const maybe = error as {
    response?: { data?: { error?: string } };
    message?: string;
  };

  return maybe.response?.data?.error ?? maybe.message ?? fallback;
}

function formatAddressSnapshot(snapshot?: AddressSnapshot | null) {
  if (!snapshot) return null;
  const parts = [
    snapshot.addressLine1,
    snapshot.addressLine2,
    snapshot.street,
    snapshot.building ? `Bldg ${snapshot.building}` : null,
    snapshot.floor ? `Floor ${snapshot.floor}` : null,
    snapshot.apartment ? `Apt ${snapshot.apartment}` : null,
    snapshot.neighborhood,
    snapshot.city,
    snapshot.postalCode,
    snapshot.country,
    snapshot.landmark ? `Landmark: ${snapshot.landmark}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function collectPhones(...phones: Array<string | null | undefined>) {
  return phones
    .map((phone) => phone?.trim())
    .filter((phone): phone is string => Boolean(phone));
}

function statusBadgeVariant(status?: string | null) {
  const s = toLower(status);
  if (s === "delivered") return "default" as const;
  if (s === "exception" || s === "returned" || s === "cancelled") {
    return "destructive" as const;
  }
  if (s === "out_for_delivery" || s === "at_warehouse") {
    return "secondary" as const;
  }
  return "outline" as const;
}

function statusIcon(status?: string | null) {
  const s = toLower(status);
  if (s === "delivered") return <CircleCheck className="h-4 w-4" />;
  if (s === "exception" || s === "returned" || s === "cancelled") {
    return <ShieldAlert className="h-4 w-4" />;
  }
  if (s === "at_warehouse") return <Warehouse className="h-4 w-4" />;
  if (s === "in_transit" || s === "out_for_delivery" || s === "assigned") {
    return <Truck className="h-4 w-4" />;
  }
  return <MapPin className="h-4 w-4" />;
}

function formatTimelineStamp(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";

  const date = d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${date} ${time}`;
}

function looksLikeUuid(value?: string | null) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function getReadableDriverLabel(order?: OrderDetails | null) {
  return (
    order?.assignedDriver?.name?.trim() ||
    order?.assignedDriver?.email?.trim() ||
    null
  );
}

function getTrackingActorLabel(evt: TrackingEvent, order?: OrderDetails | null) {
  const actorName = evt.actor?.name?.trim();
  if (actorName) return actorName;

  const actorEmail = evt.actor?.email?.trim();
  if (actorEmail) return actorEmail;

  const assignedDriverLabel = getReadableDriverLabel(order);
  if (assignedDriverLabel && evt.actor?.id && evt.actor.id === order?.assignedDriver?.id) {
    return assignedDriverLabel;
  }

  return null;
}

function getTrackingHeadline(
  evt: TrackingEvent,
  order: OrderDetails | null | undefined,
  t: Translate,
) {
  const note = String(evt.note ?? "").trim();
  const assignedMatch = /^Driver assigned \(([^)]+)\) to .+$/i.exec(note);

  if (assignedMatch) {
    return {
      title: t("orderDetails.timeline.driverAssigned", {
        driver: getReadableDriverLabel(order) ?? "-",
        cycle: prettyEnum(assignedMatch[1]),
      }),
      hideNote: true,
    };
  }

  if (evt.status) {
    return {
      title: t("orderDetails.timeline.statusChanged", {
        status: displayEnum(evt.status, t),
      }),
      hideNote: false,
    };
  }

  return {
    title: t("orderDetails.timeline.updated"),
    hideNote: false,
  };
}

function getTrackingNote(
  evt: TrackingEvent,
  order: OrderDetails | null | undefined,
  headlineHidesNote: boolean,
) {
  if (headlineHidesNote) return null;

  const note = String(evt.note ?? "").trim();
  if (!note) return null;

  const assignedDriverId = order?.assignedDriver?.id?.trim();
  const assignedDriverLabel = getReadableDriverLabel(order);

  if (
    assignedDriverId &&
    assignedDriverLabel &&
    note.toLowerCase().includes(assignedDriverId.toLowerCase())
  ) {
    return note.replaceAll(assignedDriverId, assignedDriverLabel);
  }

  if (looksLikeUuid(note)) {
    return assignedDriverLabel ?? null;
  }

  return note;
}

function trackingEventTone(evt: TrackingEvent) {
  const s = toLower(evt.status);
  if (evt.reasonCode || s === "exception" || s === "cancelled" || s === "returned") {
    return {
      dot: "bg-destructive",
      ring: "ring-destructive/20",
      line: "bg-destructive/30",
      card: "border-destructive/30 bg-destructive/[0.03]",
    };
  }
  if (s === "delivered") {
    return {
      dot: "bg-emerald-500",
      ring: "ring-emerald-500/20",
      line: "bg-emerald-500/30",
      card: "border-emerald-500/30 bg-emerald-500/[0.03]",
    };
  }
  if (s === "at_warehouse") {
    return {
      dot: "bg-amber-500",
      ring: "ring-amber-500/20",
      line: "bg-amber-500/30",
      card: "border-amber-500/30 bg-amber-500/[0.03]",
    };
  }

  return {
    dot: "bg-primary",
    ring: "ring-primary/20",
    line: "bg-primary/25",
    card: "border-border/60 bg-background/70",
  };
}

function normalizeTracking(
  events: TrackingEvent[] | null | undefined,
): TrackingEvent[] {
  if (!events?.length) return [];

  return [...events]
    .map((evt, idx) => ({
      id: evt.id ?? `evt-${idx}`,
      status: evt.status ?? null,
      reasonCode: evt.reasonCode ?? null,
      note: evt.note ?? null,
      timestamp: evt.timestamp ?? null,
      region: evt.region ?? null,
      actorRole: evt.actorRole ?? evt.actor?.role ?? null,
      warehouse: evt.warehouse ?? null,
      actor: evt.actor ?? null,
      parcelId: evt.parcelId ?? evt.parcel?.id ?? null,
      parcel: evt.parcel ?? null,
    }))
    .sort((a, b) => {
      const ta = new Date(a.timestamp ?? 0).getTime();
      const tb = new Date(b.timestamp ?? 0).getTime();
      return ta - tb;
    });
}

function buildProgress(status?: string | null, events: TrackingEvent[] = []) {
  const s = toLower(status);
  let idx = STATUS_FLOW.indexOf(s);

  if (idx < 0) {
    for (let i = events.length - 1; i >= 0; i--) {
      const candidate = toLower(events[i]?.status);
      const candidateIndex = STATUS_FLOW.indexOf(candidate);
      if (candidateIndex >= 0) {
        idx = candidateIndex;
        break;
      }
    }
  }

  if (idx < 0) idx = 0;

  const totalSteps = STATUS_FLOW.length - 1;
  const percent =
    totalSteps <= 0
      ? 0
      : Math.max(0, Math.min(100, Math.round((idx / totalSteps) * 100)));

  return {
    index: idx,
    percent,
    inferredStatus: STATUS_FLOW[idx],
    isNegativeTerminal: NEGATIVE_TERMINAL.has(s),
  };
}

export default function OrderDetailsView({
  orderId,
  backHref,
  title = "Order Details",
  showManagerActions = false,
}: {
  orderId: string;
  backHref: string;
  title?: string;
  showManagerActions?: boolean;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const currentUser = getUser();

  const {
    data: order,
    isLoading,
    error,
  } = useQuery<OrderDetails>({
    queryKey: ["order", orderId],
    queryFn: () => fetchOrderById(orderId),
    enabled: !!orderId,
  });

  const [docLoading, setDocLoading] = React.useState<
    "label" | "invoice" | null
  >(null);
  const [openingParcelId, setOpeningParcelId] = React.useState<string | null>(
    null,
  );
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [cashActionKey, setCashActionKey] = React.useState<string | null>(null);

  const [eventKind, setEventKind] = React.useState<"all" | "status">("all");
  const [parcelFilter, setParcelFilter] = React.useState("all");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">(
    "desc",
  );
  const [trackingQuery, setTrackingQuery] = React.useState("");

  const invoice = order?.invoice ?? order?.Invoice ?? null;
  const invoiceStatus = toLower(invoice?.status);
  const paymentUrl = invoice?.paymentUrl ?? null;

  const parcels = order?.parcels ?? [];
  const trackingEvents = normalizeTracking(
    order?.trackingEvents ?? order?.tracking ?? [],
  );
  const cashCollections = order?.cashCollections ?? [];
  const progress = buildProgress(order?.status, trackingEvents);

  const totalParcelWeight = parcels.reduce((acc, p) => {
    const w = safeNumber(p.weightKg);
    return acc + (w ?? 0);
  }, 0);

  const hasAnyParcelLabel = parcels.some((p) => Boolean(p.labelKey));

  const canOpenLabel =
    hasAnyParcelLabel || Boolean(order?.labelKey) || invoiceStatus === "paid";
  const canOpenInvoice = Boolean(invoice?.id) && invoiceStatus === "paid";

  const {
    data: labelBundle,
    isFetching: isFetchingLabelUrls,
    refetch: refetchLabelUrls,
  } = useQuery({
    queryKey: ["order-label-urls", orderId],
    queryFn: () => getOrderLabelUrls(orderId),
    enabled: Boolean(order?.id) && canOpenLabel,
    staleTime: 240_000,
  });

  const parcelLabelUrls = labelBundle?.urls ?? [];
  const hasMultipleParcelLabels = parcelLabelUrls.length > 1;

  const filteredTracking = React.useMemo(() => {
    const q = trackingQuery.trim().toLowerCase();

    const list = trackingEvents.filter((evt) => {
      if (eventKind === "status" && !evt.status) return false;
      if (parcelFilter !== "all" && evt.parcelId !== parcelFilter) return false;

      if (!q) return true;

      const haystack = [
        evt.status,
        evt.reasonCode,
        evt.note,
        evt.region,
        evt.warehouse?.name,
        evt.actor?.name,
        evt.actor?.email,
        evt.parcel?.parcelCode,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });

    return list.sort((a, b) => {
      const ta = new Date(a.timestamp ?? 0).getTime();
      const tb = new Date(b.timestamp ?? 0).getTime();
      return sortDirection === "desc" ? tb - ta : ta - tb;
    });
  }, [eventKind, parcelFilter, sortDirection, trackingEvents, trackingQuery]);

  const refreshOrderQueries = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["manager-analytics-summary"] });
  }, [orderId, queryClient]);

  const runCashAction = React.useCallback(
    async (
      key: string,
      action: () => Promise<{ success: boolean; message: string }>,
      fallbackSuccess: string,
      fallbackError: string,
    ) => {
      try {
        setCashActionKey(key);
        const result = await action();
        toast.success(result.message || fallbackSuccess);
        refreshOrderQueries();
      } catch (err: unknown) {
        toast.error(extractErrorMessage(err, fallbackError));
      } finally {
        setCashActionKey(null);
      }
    },
    [refreshOrderQueries],
  );

  const openLabel = async () => {
    if (!order?.id) return;

    try {
      setDocLoading("label");
      const bundle = labelBundle ?? (await refetchLabelUrls()).data;
      const url = bundle?.url;
      if (!url) {
        toast.error("Label not available yet");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err, "Could not open shipping label"));
    } finally {
      setDocLoading(null);
    }
  };

  const openParcelLabel = async (parcel: Parcel) => {
    if (!order?.id) return;

    try {
      setOpeningParcelId(parcel.id);

      const bundle = labelBundle ?? (await refetchLabelUrls()).data;
      const urls = bundle?.urls ?? [];
      const match =
        urls.find((u) => u.parcelId === parcel.id) ??
        urls.find((u) => u.parcelCode && u.parcelCode === parcel.parcelCode);

      if (!match?.url) {
        toast.error("Parcel label URL not available yet");
        return;
      }

      window.open(match.url, "_blank", "noopener,noreferrer");
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err, "Could not open parcel label"));
    } finally {
      setOpeningParcelId(null);
    }
  };

  const openInvoice = async () => {
    if (!order?.id) return;

    try {
      setDocLoading("invoice");
      const url = await getInvoiceUrl(order.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err, "Could not open invoice"));
    } finally {
      setDocLoading(null);
    }
  };

  const copyParcelCode = async (parcelCode?: string | null) => {
    if (!parcelCode) return;

    try {
      await navigator.clipboard.writeText(parcelCode);
      toast.success("Parcel code copied");
    } catch {
      toast.error("Failed to copy parcel code");
    }
  };

  const senderStructured = formatAddressSnapshot(order?.senderAddressObj);
  const receiverStructured = formatAddressSnapshot(order?.receiverAddressObj);
  const senderPhones = collectPhones(
    order?.senderPhone,
    order?.senderPhone2,
    order?.senderPhone3,
  );
  const receiverPhones = collectPhones(
    order?.receiverPhone,
    order?.receiverPhone2,
    order?.receiverPhone3,
  );

  if (isLoading) {
    return (
      <div className="p-6">
          <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>{t("orderDetails.loadingTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {t("orderDetails.loadingSubtitle")}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-6">
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>{t("orderDetails.missingTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {t("orderDetails.missingSubtitle")}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <Badge
                variant={statusBadgeVariant(order.status)}
                className="gap-1.5 rounded-full px-3 py-1"
              >
                {statusIcon(order.status)}
                {displayEnum(order.status, t)}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">
                {order.orderNumber ? `Order #${order.orderNumber}` : "Shipment"}
              </span>
              {"  "}
              <span className="font-mono">
                {parcels.length > 1 ? `${parcels.length} pieces` : "Single parcel"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {showManagerActions ? (
              <>
                <Button
                  className="gap-2"
                  onClick={() => setAssignOpen(true)}
                  disabled={toLower(order.status) === "delivered"}
                  title={
                    toLower(order.status) === "delivered"
                      ? t("orderDetails.assignDriverDisabled")
                      : t("orderDetails.assignDriver")
                  }
                >
                  <UserPlus className="h-4 w-4" />
                  {t("orderDetails.assignDriver")}
                </Button>
                <AssignDriverDialog
                  open={assignOpen}
                  onOpenChange={setAssignOpen}
                  singleOrderId={order.id}
                  onAssigned={() => {
                    refreshOrderQueries();
                  }}
                />
              </>
            ) : null}

            <Button asChild variant="outline">
              <Link href={backHref}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("common.back")}
              </Link>
            </Button>
          </div>
        </div>

        <Card className="overflow-hidden border-border/70 bg-linear-to-br from-primary/10 via-background to-background">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{t("orderDetails.currentStage")}</p>
                <p className="text-lg font-semibold">
                  {displayEnum(order.status ?? progress.inferredStatus, t)}
                </p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-sm text-muted-foreground">{t("orderDetails.lastUpdated")}</p>
                <p className="text-sm font-medium">{formatDateTime(order.updatedAt)}</p>
              </div>
            </div>

            <div className="mt-4">
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className={cn(
                    "h-2 rounded-full transition-all",
                    progress.isNegativeTerminal ? "bg-destructive" : "bg-primary",
                  )}
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{displayEnum(progress.inferredStatus, t)}</span>
                <span>{t("orderDetails.progressCompleted", { percent: progress.percent })}</span>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                <p className="text-xs text-muted-foreground">{t("orderDetails.driver")}</p>
                <p className="font-medium">
                  {order.assignedDriver?.name || order.assignedDriver?.email || "-"}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                <p className="text-xs text-muted-foreground">{t("orderDetails.warehouse")}</p>
                <p className="font-medium">
                  {order.currentWarehouse?.name || order.currentWarehouse?.location || "-"}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                <p className="text-xs text-muted-foreground">{t("orderDetails.parcels")}</p>
                <p className="font-medium">{parcels.length || 0}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                <p className="text-xs text-muted-foreground">{t("orderDetails.attempts")}</p>
                <p className="font-medium">
                  P{safeNumber(order.pickupAttemptCount) ?? 0} / D
                  {safeNumber(order.deliveryAttemptCount) ?? 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("orderDetails.routeAndContacts")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                  <p className="text-xs text-muted-foreground">{t("orderDetails.pickup")}</p>
                  <p className="mt-1 font-medium">{order.pickupAddress || "-"}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                  <p className="text-xs text-muted-foreground">{t("orderDetails.dropoff")}</p>
                  <p className="mt-1 font-medium">{order.dropoffAddress || "-"}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                  <p className="text-xs text-muted-foreground">{t("orderDetails.sender")}</p>
                  <p className="mt-1 font-medium">{order.senderName || "-"}</p>
                  <div className="space-y-1 pt-1">
                    {senderPhones.length ? (
                      senderPhones.map((phone, index) => (
                        <p key={`${phone}-${index}`} className="text-muted-foreground">
                          {index === 0 ? phone : t("orderDetails.altPhone", { index, phone })}
                        </p>
                      ))
                    ) : (
                      <p className="text-muted-foreground">-</p>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {senderStructured || order.senderAddress || "-"}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                  <p className="text-xs text-muted-foreground">{t("orderDetails.receiver")}</p>
                  <p className="mt-1 font-medium">{order.receiverName || "-"}</p>
                  <div className="space-y-1 pt-1">
                    {receiverPhones.length ? (
                      receiverPhones.map((phone, index) => (
                        <p key={`${phone}-${index}`} className="text-muted-foreground">
                          {index === 0 ? phone : t("orderDetails.altPhone", { index, phone })}
                        </p>
                      ))
                    ) : (
                      <p className="text-muted-foreground">-</p>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {receiverStructured || order.receiverAddress || "-"}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                <p className="text-xs text-muted-foreground">{t("orderDetails.destinationCity")}</p>
                <p className="mt-1 font-medium">{order.destinationCity || "-"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("orderDetails.customerAndOperations")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                <p className="text-xs text-muted-foreground">{t("orderDetails.customerUser")}</p>
                <p className="mt-1 font-medium">
                  {order.customer?.name || order.customer?.email || "-"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {order.customer?.email || "-"}
                </p>
              </div>

              <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                <p className="text-xs text-muted-foreground">{t("orderDetails.customerEntity")}</p>
                <p className="mt-1 font-medium">
                  {order.customerEntity?.name || order.customerEntity?.companyName || "-"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {prettyEnum(order.customerEntity?.type) || "-"}
                </p>
              </div>

              <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                <p className="text-xs text-muted-foreground">{t("orderDetails.driver")}</p>
                <p className="mt-1 font-medium">
                  {order.assignedDriver?.name || order.assignedDriver?.email || "-"}
                </p>
              </div>

              <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                <p className="text-xs text-muted-foreground">{t("orderDetails.currentWarehouse")}</p>
                <p className="mt-1 font-medium">
                  {order.currentWarehouse?.name || order.currentWarehouse?.location || "-"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {order.currentWarehouse?.region || "-"}
                </p>
              </div>

              <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                <p className="text-xs text-muted-foreground">{t("orderDetails.exceptionSnapshot")}</p>
                <p className="mt-1 font-medium">
                  {order.lastExceptionReason
                    ? displayEnum(order.lastExceptionReason, t)
                    : t("orderDetails.none")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {order.lastExceptionAt ? formatDateTime(order.lastExceptionAt) : "-"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("orderDetails.shipmentAndParcels")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-border/60 bg-background/60 p-3 text-sm">
                  <p className="text-xs text-muted-foreground">{t("orderDetails.serviceType")}</p>
                  <p className="mt-1 font-medium">{getServiceTypeLabel(order.serviceType, t)}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/60 p-3 text-sm">
                  <p className="text-xs text-muted-foreground">{t("orderDetails.totalWeight")}</p>
                  <p className="mt-1 font-medium">
                    {(totalParcelWeight || safeNumber(order.weightKg) || 0).toFixed(2)} kg
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/60 p-3 text-sm">
                  <p className="text-xs text-muted-foreground">{t("orderDetails.itemValue")}</p>
                  <p className="mt-1 font-medium">
                    {formatMoney(order.itemValue, order.currency)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/60 p-3 text-sm">
                  <p className="text-xs text-muted-foreground">{t("orderDetails.handling")}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {order.fragile ? <Badge variant="secondary">{t("orderDetails.fragile")}</Badge> : null}
                    {order.dangerousGoods ? (
                      <Badge variant="secondary">{t("orderDetails.dangerous")}</Badge>
                    ) : null}
                    {order.shipmentInsurance ? (
                      <Badge variant="secondary">{t("orderDetails.insurance")}</Badge>
                    ) : null}
                    {!order.fragile && !order.dangerousGoods && !order.shipmentInsurance ? (
                      <span className="text-sm text-muted-foreground">{t("orderDetails.standard")}</span>
                    ) : null}
                  </div>
                </div>
              </div>

              <Separator />

              {parcels.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {parcels.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-xl border border-border/60 bg-background/60 p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">
                            {t("orderDetails.piece", { pieceNo: p.pieceNo ?? "-" })}
                            {p.pieceTotal ? ` / ${p.pieceTotal}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {p.parcelCode || "-"}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => copyParcelCode(p.parcelCode)}
                          disabled={!p.parcelCode}
                        >
                          <Clipboard className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Weight</p>
                          <p className="text-xs text-muted-foreground">{t("orderDetails.weight")}</p>
                          <p>{safeNumber(p.weightKg)?.toFixed(2) ?? "-"} kg</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t("orderDetails.dimensions")}</p>
                          <p>
                            {safeNumber(p.lengthCm) ?? "-"} x {safeNumber(p.widthCm) ?? "-"} x{" "}
                            {safeNumber(p.heightCm) ?? "-"} cm
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("orderDetails.noParcels")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("orderDetails.paymentAndPlanning")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                <p className="text-xs text-muted-foreground">{t("orderDetails.invoiceStatus")}</p>
                <p className="mt-1 font-medium">
                  {displayEnum(invoice?.status, t) || t("orderDetails.notCreated")}
                </p>
                {paymentUrl && invoiceStatus !== "paid" ? (
                  <a
                    className="mt-2 inline-flex items-center gap-1 text-sm underline underline-offset-4"
                    href={paymentUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("orderDetails.payNow")} <ExternalLink className="h-4 w-4 opacity-70" />
                  </a>
                ) : null}
              </div>

              <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                <p className="text-xs text-muted-foreground">{t("orderDetails.billing")}</p>
                <p className="mt-1">{t("orderDetails.paymentType")}: {getPaymentTypeLabel(order.paymentType, t)}</p>
                <p>{t("orderDetails.deliveryPaidBy")}: {getPaidByLabel(order.deliveryChargePaidBy, t)}</p>
                <p>{t("orderDetails.recipientUnavailable")}: {getRecipientUnavailableLabel(order.ifRecipientNotAvailable, t)}</p>
              </div>

              <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                <p className="text-xs text-muted-foreground">{t("orderDetails.amounts")}</p>
                <p className="mt-1">{t("orderDetails.cod")}: {formatMoney(order.codAmount, order.currency)}</p>
                <p>{t("orderDetails.codStatus")}: {displayPaidStatus(order.codPaidStatus, t)}</p>
                <p>{t("orderDetails.serviceCharge")}: {formatMoney(order.serviceCharge, order.currency)}</p>
                <p>{t("orderDetails.serviceStatus")}: {displayPaidStatus(order.serviceChargePaidStatus, t)}</p>
              </div>

              <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                <p className="text-xs text-muted-foreground">{t("orderDetails.cash.title")}</p>
                {cashCollections.length ? (
                  <div className="mt-3 space-y-3">
                    {cashCollections.map((collection) => {
                      const latestEvent = collection.events?.[collection.events.length - 1] ?? null;
                      const isWarehouseUser =
                        currentUser?.role === "warehouse" &&
                        Boolean(currentUser.warehouseId) &&
                        order?.currentWarehouse?.id === currentUser.warehouseId;
                      const canAcceptToWarehouse =
                        isWarehouseUser &&
                        (collection.status === "expected" ||
                          collection.currentHolderType === "driver");
                      const canSettleToFinance =
                        currentUser?.role === "manager" &&
                        collection.status === "held";
                      return (
                        <div
                          key={collection.id}
                          className="rounded-xl border border-border/60 bg-background/70 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium">
                                {displayCashKind(collection.kind, t)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {displayCashStatus(collection.status, t)}
                              </p>
                            </div>
                            <Badge variant="outline" className="rounded-full">
                              {displayCashHolder(collection, t)}
                            </Badge>
                          </div>

                          <div className="mt-3 space-y-1 text-sm">
                            <p>
                              {t("orderDetails.cash.expected")}:{" "}
                              {formatMoney(collection.expectedAmount, collection.currency ?? order.currency)}
                            </p>
                            <p>
                              {t("orderDetails.cash.currentAmount")}:{" "}
                              {formatMoney(
                                collection.collectedAmount ?? collection.expectedAmount,
                                collection.currency ?? order.currency,
                              )}
                            </p>
                            <p>
                              {t("orderDetails.cash.collectedAt")}:{" "}
                              {formatDateTime(collection.collectedAt)}
                            </p>
                            <p>
                              {t("orderDetails.cash.settledAt")}:{" "}
                              {formatDateTime(collection.settledAt)}
                            </p>
                          </div>

                          {latestEvent ? (
                            <div className="mt-3 rounded-lg border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">
                                {t("orderDetails.cash.latestEvent")}:
                              </span>{" "}
                              {prettyEnum(latestEvent.eventType)} · {formatDateTime(latestEvent.createdAt)}
                              {latestEvent.note ? ` · ${latestEvent.note}` : ""}
                            </div>
                          ) : null}

                          {canAcceptToWarehouse || canSettleToFinance ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {canAcceptToWarehouse ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={cashActionKey === cashActionId(collection, "accept")}
                                  onClick={() => {
                                    const actionKey = cashActionId(collection, "accept");
                                    if (collection.currentHolderType === "driver") {
                                      void runCashAction(
                                        actionKey,
                                        () =>
                                          handoffOrderCash({
                                            orderId,
                                            kind: (collection.kind as "cod" | "service_charge") ?? "cod",
                                            toHolderType: "warehouse",
                                            toWarehouseId: currentUser?.warehouseId ?? null,
                                          }),
                                        t("orderDetails.cash.actions.accept"),
                                        t("orderDetails.cash.errors.accept"),
                                      );
                                      return;
                                    }

                                    void runCashAction(
                                      actionKey,
                                      () =>
                                        collectOrderCash({
                                          orderId,
                                          kind: (collection.kind as "cod" | "service_charge") ?? "cod",
                                        }),
                                      t("orderDetails.cash.actions.accept"),
                                      t("orderDetails.cash.errors.accept"),
                                    );
                                  }}
                                >
                                  {cashActionKey === cashActionId(collection, "accept") ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : null}
                                  {collection.currentHolderType === "driver"
                                    ? t("orderDetails.cash.actions.acceptFromDriver")
                                    : t("orderDetails.cash.actions.accept")}
                                </Button>
                              ) : null}

                              {canSettleToFinance ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={cashActionKey === cashActionId(collection, "settle")}
                                  onClick={() =>
                                    void runCashAction(
                                      cashActionId(collection, "settle"),
                                      () =>
                                        settleOrderCash({
                                          orderId,
                                          kind: (collection.kind as "cod" | "service_charge") ?? "cod",
                                        }),
                                      t("orderDetails.cash.actions.settle"),
                                      t("orderDetails.cash.errors.settle"),
                                    )
                                  }
                                >
                                  {cashActionKey === cashActionId(collection, "settle") ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : null}
                                  {t("orderDetails.cash.actions.settle")}
                                </Button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("orderDetails.cash.empty")}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                <p className="text-xs text-muted-foreground">{t("orderDetails.schedule")}</p>
                <p className="mt-1">{t("orderDetails.pickup")}: {formatDateTime(order.plannedPickupAt)}</p>
                <p>{t("orderDetails.delivery")}: {formatDateTime(order.plannedDeliveryAt)}</p>
                <p>{t("orderDetails.promise")}: {formatDateTime(order.promiseDate)}</p>
              </div>

              <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                <p className="text-xs text-muted-foreground">{t("orderDetails.reference")}</p>
                <p className="mt-1">{t("orderDetails.referenceId")}: {order.referenceId || "-"}</p>
                <p>{t("orderDetails.shelfId")}: {order.shelfId || "-"}</p>
                <p>{t("orderDetails.promo")}: {order.promoCode || "-"}</p>
                <p>{t("orderDetails.calls")}: {safeNumber(order.numberOfCalls) ?? "-"}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="text-base">{t("orderDetails.trackingTimeline")}</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-44">
                  <Select
                    value={eventKind}
                    onValueChange={(v: "all" | "status") => setEventKind(v)}
                  >
                    <SelectTrigger className="h-9">
                      <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Event type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All events</SelectItem>
                      <SelectItem value="status">Status changes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-52">
                  <Select value={parcelFilter} onValueChange={setParcelFilter}>
                    <SelectTrigger className="h-9">
                      <Package className="mr-2 h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Parcel filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All parcels</SelectItem>
                      {parcels.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.parcelCode || `Piece ${p.pieceNo ?? "?"}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() =>
                    setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"))
                  }
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {sortDirection === "desc" ? "Newest first" : "Oldest first"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={trackingQuery}
              onChange={(e) => setTrackingQuery(e.target.value)}
              placeholder="Search note, reason, actor, region, parcel code..."
              className="rounded-xl"
            />

            {filteredTracking.length ? (
              <ol className="space-y-4">
                {filteredTracking.map((evt, idx) => {
                  const tone = trackingEventTone(evt);
                  const isLast = idx === filteredTracking.length - 1;
                  const headline = getTrackingHeadline(evt, order, t);
                  const note = getTrackingNote(evt, order, headline.hideNote);
                  const actorLabel = getTrackingActorLabel(evt, order);

                  return (
                    <li key={evt.id} className="grid grid-cols-[92px_1fr] gap-3 sm:grid-cols-[120px_1fr] sm:gap-4">
                      <div className="pt-2 text-[11px] leading-tight text-muted-foreground sm:text-xs">
                        {formatTimelineStamp(evt.timestamp)}
                      </div>

                      <div className="relative">
                        {!isLast ? (
                          <span
                            className={cn(
                              "absolute left-[6px] top-7 bottom-[-18px] w-px",
                              tone.line,
                            )}
                          />
                        ) : null}
                        <span
                          className={cn(
                            "absolute left-0 top-2 h-3.5 w-3.5 rounded-full ring-4",
                            tone.dot,
                            tone.ring,
                          )}
                        />

                        <div className={cn("ml-6 rounded-2xl border p-4 shadow-[0_8px_24px_-18px_rgba(0,0,0,0.35)]", tone.card)}>
                          <div className="flex flex-wrap items-center gap-2">
                            {evt.status ? (
                              <Badge variant={statusBadgeVariant(evt.status)}>
                                {displayEnum(evt.status, t)}
                              </Badge>
                            ) : null}
                            {evt.reasonCode ? (
                              <Badge variant="destructive">
                                {displayEnum(evt.reasonCode, t)}
                              </Badge>
                            ) : null}
                          </div>

                          <p className="mt-2 text-sm font-semibold leading-snug">
                            {headline.title}
                            {evt.warehouse?.name ? (
                              <>
                                {" "}
                                in{" "}
                                <span className="text-primary/90">
                                  {evt.warehouse.name}
                                </span>
                              </>
                            ) : null}
                            {evt.parcel?.parcelCode ? (
                              <>
                                {" "}
                                for{" "}
                                <span className="font-mono text-[13px]">
                                  {evt.parcel.parcelCode}
                                </span>
                              </>
                            ) : null}
                          </p>

                          {note ? (
                            <p className="mt-1 text-sm text-muted-foreground">{note}</p>
                          ) : null}

                          <div className="mt-2 text-xs text-muted-foreground">
                            {actorLabel ? `By ${actorLabel}` : "By system"}
                            {evt.actorRole ? ` (${displayEnum(evt.actorRole, t)})` : ""}
                            {evt.region ? ` • ${evt.region}` : ""}
                            {evt.warehouse?.name ? ` • ${evt.warehouse.name}` : ""}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">
                No tracking events for the current filters.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Documents and Attachments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="secondary"
                className="h-12 justify-between rounded-xl px-4"
                onClick={openLabel}
                disabled={!canOpenLabel || docLoading !== null}
              >
                <span className="flex items-center gap-2">
                  {docLoading === "label" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Package className="h-4 w-4" />
                  )}
                  {hasMultipleParcelLabels ? "Open First Label" : "Shipping Label"}
                </span>
                <ExternalLink className="h-4 w-4 opacity-70" />
              </Button>

              <Button
                type="button"
                variant="default"
                className="h-12 justify-between rounded-xl px-4"
                onClick={openInvoice}
                disabled={!canOpenInvoice || docLoading !== null}
              >
                <span className="flex items-center gap-2">
                  {docLoading === "invoice" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  Invoice
                </span>
                <ExternalLink className="h-4 w-4 opacity-70" />
              </Button>
            </div>

            {!canOpenInvoice && invoice?.id && invoiceStatus !== "paid" ? (
              <p className="text-xs text-muted-foreground">
                Invoice PDF becomes available after payment confirmation.
              </p>
            ) : null}

            {hasAnyParcelLabel ? (
              <>
                <Separator />

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">Parcel Labels</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg"
                      onClick={() => void refetchLabelUrls()}
                      disabled={isFetchingLabelUrls}
                    >
                      {isFetchingLabelUrls ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Refresh links
                    </Button>
                  </div>

                  <div className="grid gap-2">
                    {parcels.map((parcel) => {
                      const urlEntry =
                        parcelLabelUrls.find((u) => u.parcelId === parcel.id) ??
                        parcelLabelUrls.find(
                          (u) =>
                            Boolean(u.parcelCode) &&
                            Boolean(parcel.parcelCode) &&
                            u.parcelCode === parcel.parcelCode,
                        );

                      const canOpenParcelLabel = Boolean(urlEntry?.url);
                      const displayCode =
                        parcel.parcelCode || urlEntry?.parcelCode || `Piece ${parcel.pieceNo ?? "-"}`;

                      return (
                        <div
                          key={parcel.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium">{displayCode}</p>
                            <p className="text-xs text-muted-foreground">
                              Piece {parcel.pieceNo ?? "-"}
                              {parcel.pieceTotal ? ` of ${parcel.pieceTotal}` : ""}
                            </p>
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg"
                            onClick={() => void openParcelLabel(parcel)}
                            disabled={
                              !parcel.labelKey ||
                              !canOpenParcelLabel ||
                              openingParcelId === parcel.id
                            }
                          >
                            {openingParcelId === parcel.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ExternalLink className="h-4 w-4" />
                            )}
                            Open
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : null}

            {order.attachments?.length ? (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Attachments</p>
                  {order.attachments.map((a) => (
                    <div
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{a.fileName || a.key || "Attachment"}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.mimeType || "unknown"} | {formatSize(a.size)} |{" "}
                          {formatDateTime(a.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-background/60 p-4 text-sm">
                <p className="text-xs text-muted-foreground">Created At</p>
                <p className="mt-1 flex items-center gap-2 font-medium">
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  {formatDateTime(order.createdAt)}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/60 p-4 text-sm">
                <p className="text-xs text-muted-foreground">Actors</p>
                <p className="mt-1 flex items-center gap-2 font-medium">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Customer: {order.customer?.name || order.customer?.email || "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
