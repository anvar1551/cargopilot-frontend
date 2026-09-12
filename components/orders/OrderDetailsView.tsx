"use client";

import Link from "next/link";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useI18n } from "@/components/i18n/I18nProvider";
import { getPrimaryWarehouseId, getUser } from "@/lib/auth";
import { getMapboxToken } from "@/lib/mapbox";
import {
  READ_ONLY_ORDER_CAPABILITIES,
  type OrderActionCapabilities,
} from "@/lib/orders/permissions";
import {
  bookCarrierForOrderLeg,
  cancelCarrierForOrderLeg,
  collectOrderCash,
  fetchOrderProofLinks,
  fetchOrderById,
  fetchOrderLegs,
  handoffOrderCash,
  settleOrderCash,
  syncCarrierTrackingForOrderLeg,
  type OrderLeg,
  type OrderProofBundle,
  type OrderProofLinksResponse,
} from "@/lib/orders";
import {
  listIntegrationProviders,
  type IntegrationProviderConfig,
} from "@/lib/integrations";
import {
  listOrderPaymentIntents,
  retryOrderPayment,
  syncPaymentIntent,
  type PaymentIntentSummary,
} from "@/lib/paymentProviders";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import AssignDriverDialog from "@/components/orders/AssignDriverDialog";

import {
  ArrowLeft,
  BadgeDollarSign,
  Banknote,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  Clipboard,
  CreditCard,
  ExternalLink,
  FileText,
  Filter,
  HandCoins,
  Image as ImageIcon,
  Landmark,
  Loader2,
  MapPin,
  Navigation,
  PenLine,
  Package,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
  Truck,
  User,
  UserPlus,
  WalletCards,
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
  latitude?: number | null;
  longitude?: number | null;
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
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;

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
  paymentState?: string | null;
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

function currencyExponent(currency?: string | null) {
  const normalized = String(currency ?? "").toUpperCase();
  if (normalized === "UZS") return 2;
  if (normalized === "USD") return 2;
  if (normalized === "CNY") return 2;
  return 2;
}

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

function displayPaymentState(value: string | null | undefined) {
  const normalized = String(value ?? "").toUpperCase();
  if (!normalized) return "-";
  if (normalized === "UNPAID") return "Unpaid";
  if (normalized === "PENDING") return "Pending";
  if (normalized === "PAID") return "Paid";
  if (normalized === "FAILED") return "Failed";
  if (normalized === "REFUNDED") return "Refunded";
  return prettyEnum(value);
}

function paymentStatusClasses(value?: string | null) {
  const status = toLower(value);
  if (status === "paid" || status === "settled") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  }
  if (status === "pending" || status === "expected" || status === "held") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700";
  }
  if (status === "failed" || status === "canceled" || status === "cancelled" || status === "unpaid") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-700";
  }
  return "border-border/60 bg-background text-foreground";
}

function carrierBookingStatusClasses(value?: string | null) {
  const status = toLower(value);
  if (status === "booked") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  if (status === "requested") return "border-sky-500/30 bg-sky-500/10 text-sky-700";
  if (status === "failed" || status === "cancelled") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-700";
  }
  return "border-slate-300 bg-slate-50 text-slate-700";
}

function displayCarrierBookingStatus(value?: string | null) {
  return prettyEnum(value || "not_requested");
}

function getActorCompanyId(user: ReturnType<typeof getUser>) {
  return (
    user?.companyId ||
    user?.scopes?.find((scope) => scope.scopeType === "company")?.scopeRefId ||
    ""
  );
}

function providerLabel(provider: IntegrationProviderConfig) {
  const code = provider.providerCode.replaceAll("_", " ");
  return `${prettyEnum(code)} (${provider.environment})`;
}

function cashHolderIcon(holderType?: string | null) {
  const holder = toLower(holderType);
  if (holder === "warehouse") return <Warehouse className="h-3.5 w-3.5" />;
  if (holder === "finance") return <Landmark className="h-3.5 w-3.5" />;
  return <User className="h-3.5 w-3.5" />;
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
  const cur = currency || "UZS";
  return `${n.toFixed(2)} ${cur}`;
}

function formatMinorMoney(amountMinor?: string | number | null, currency?: string | null) {
  if (amountMinor == null) return "-";
  const amount = Number(amountMinor);
  if (!Number.isFinite(amount)) return "-";
  const exp = currencyExponent(currency);
  return `${(amount / 10 ** exp).toFixed(2)} ${currency || "UZS"}`;
}

function canRetryPaymentIntent(intent?: PaymentIntentSummary | null) {
  const status = String(intent?.status ?? "").toUpperCase();
  return Boolean(intent) && !["SUCCEEDED", "REFUNDED", "PARTIALLY_REFUNDED"].includes(status);
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

type LatLng = {
  lat: number;
  lng: number;
};

function toLatitude(value: unknown): number | null {
  const n = safeNumber(value);
  if (n == null) return null;
  if (n < -90 || n > 90) return null;
  return n;
}

function toLongitude(value: unknown): number | null {
  const n = safeNumber(value);
  if (n == null) return null;
  if (n < -180 || n > 180) return null;
  return n;
}

function formatLatLng(coords?: LatLng | null) {
  if (!coords) return "-";
  return `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
}

function coordsEqual(a?: LatLng | null, b?: LatLng | null) {
  if (!a || !b) return false;
  return Math.abs(a.lat - b.lat) < 0.000001 && Math.abs(a.lng - b.lng) < 0.000001;
}

function buildGooglePointUrl(coords: LatLng) {
  return `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
}

function buildGoogleRouteUrl(pickup: LatLng, dropoff: LatLng) {
  return `https://www.google.com/maps/dir/?api=1&origin=${pickup.lat},${pickup.lng}&destination=${dropoff.lat},${dropoff.lng}&travelmode=driving`;
}

function buildYandexRouteUrl(pickup: LatLng, dropoff: LatLng) {
  return `https://yandex.com/maps/?rtext=${pickup.lat},${pickup.lng}~${dropoff.lat},${dropoff.lng}&rtt=auto`;
}

type MapboxLike = {
  accessToken: string;
  Map: new (options: {
    container: HTMLElement;
    style: string;
    center: [number, number];
    zoom: number;
    attributionControl: boolean;
  }) => {
    on: (event: "load" | "error", handler: (event?: { error?: Error }) => void) => void;
    addSource: (id: string, source: unknown) => void;
    addLayer: (layer: unknown) => void;
    fitBounds: (
      bounds: [[number, number], [number, number]],
      options?: { padding?: number; duration?: number },
    ) => void;
    remove: () => void;
  };
  Marker: new (options?: { color?: string }) => {
    setLngLat: (lngLat: [number, number]) => {
      addTo: (map: unknown) => unknown;
    };
  };
};

let mapboxRouteModulePromise: Promise<MapboxLike> | null = null;
async function loadMapboxForRoute(token: string) {
  if (!mapboxRouteModulePromise) {
    mapboxRouteModulePromise = import("mapbox-gl").then((imported) => {
      return (imported.default ?? imported) as unknown as MapboxLike;
    });
  }
  const mapbox = await mapboxRouteModulePromise;
  mapbox.accessToken = token;
  return mapbox;
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
  capabilities,
  hideBackButton = false,
}: {
  orderId: string;
  backHref: string;
  title?: string;
  capabilities?: Partial<OrderActionCapabilities>;
  hideBackButton?: boolean;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const currentUser = getUser();
  const actorCompanyId = getActorCompanyId(currentUser);
  const primaryWarehouseId = getPrimaryWarehouseId(currentUser);
  const orderCapabilities = React.useMemo(
    () => ({ ...READ_ONLY_ORDER_CAPABILITIES, ...capabilities }),
    [capabilities],
  );
  const canAssignDriver = orderCapabilities.canAssignDriver;
  const canManageCarrier = orderCapabilities.canBookCarrier;
  const canReadPayments = orderCapabilities.canReadPayments;
  const canRetryPayment = orderCapabilities.canRetryPayment;
  const canSettleCash = orderCapabilities.canSettleCash;
  const canHandleWarehouseCash = orderCapabilities.canHandleWarehouseCash;

  const {
    data: order,
    isLoading,
    error,
  } = useQuery<OrderDetails>({
    queryKey: ["order", orderId],
    queryFn: () => fetchOrderById(orderId),
    enabled: !!orderId,
    staleTime: 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: () =>
      queryClient.getQueryData<OrderDetails>(["order", orderId]),
  });

  const [docLoading, setDocLoading] = React.useState<
    "label" | "invoice" | null
  >(null);
  const [openingParcelId, setOpeningParcelId] = React.useState<string | null>(
    null,
  );
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [cashActionKey, setCashActionKey] = React.useState<string | null>(null);
  const [selectedCarrierProviderByLeg, setSelectedCarrierProviderByLeg] =
    React.useState<Record<string, string>>({});
  const [cancelCarrierLeg, setCancelCarrierLeg] = React.useState<OrderLeg | null>(null);
  const [cancelCarrierReason, setCancelCarrierReason] = React.useState("");

  const [eventKind, setEventKind] = React.useState<"all" | "status">("all");
  const [parcelFilter, setParcelFilter] = React.useState("all");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">(
    "desc",
  );
  const [trackingQuery, setTrackingQuery] = React.useState("");
  const [isMapPreviewVisible, setIsMapPreviewVisible] = React.useState(false);
  const [isProofsVisible, setIsProofsVisible] = React.useState(false);
  const [failedProofAssetKeys, setFailedProofAssetKeys] = React.useState<
    Record<string, true>
  >({});
  const [proofAutoRefreshDone, setProofAutoRefreshDone] = React.useState(false);
  const [mapPreviewStatus, setMapPreviewStatus] = React.useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [mapPreviewError, setMapPreviewError] = React.useState<string | null>(null);
  const [mapPreviewErrorDetail, setMapPreviewErrorDetail] = React.useState<string | null>(null);
  const [mapContainerEl, setMapContainerEl] = React.useState<HTMLDivElement | null>(null);
  const mapRef = React.useRef<{
    remove: () => void;
    on: (event: "load" | "error", handler: (event?: { error?: Error }) => void) => void;
    addSource: (id: string, source: unknown) => void;
    addLayer: (layer: unknown) => void;
    fitBounds: (
      bounds: [[number, number], [number, number]],
      options?: { padding?: number; duration?: number },
    ) => void;
  } | null>(null);

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

  const {
    data: orderProofLinks,
    isFetching: isFetchingProofLinks,
    refetch: refetchOrderProofLinks,
  } = useQuery<OrderProofLinksResponse>({
    queryKey: ["order-proof-links", orderId],
    queryFn: () => fetchOrderProofLinks(orderId, { limit: 12 }),
    enabled: false,
    staleTime: 60_000,
  });

  const {
    data: orderLegs = [],
    isFetching: isFetchingOrderLegs,
  } = useQuery<OrderLeg[]>({
    queryKey: ["order-legs", orderId],
    queryFn: () => fetchOrderLegs(orderId),
    enabled: Boolean(orderId) && canManageCarrier,
    staleTime: 30_000,
  });

  const {
    data: activeCarrierProviders = [],
    isFetching: isFetchingCarrierProviders,
  } = useQuery<IntegrationProviderConfig[]>({
    queryKey: ["integration-providers", actorCompanyId, "carrier", "active"],
    queryFn: () =>
      listIntegrationProviders({
        companyId: actorCompanyId || undefined,
        domain: "carrier",
        status: "active",
      }),
    enabled: canManageCarrier,
    staleTime: 60_000,
  });

  const {
    data: paymentIntents = [],
    isFetching: isFetchingPaymentIntents,
  } = useQuery<PaymentIntentSummary[]>({
    queryKey: ["order-payment-intents", orderId],
    queryFn: () => listOrderPaymentIntents(orderId),
    enabled: Boolean(orderId) && canReadPayments,
    staleTime: 30_000,
  });

  const latestPaymentIntent = paymentIntents[0] ?? null;

  const markProofAssetFailed = React.useCallback((assetKey: string | null) => {
    if (!assetKey) return;
    setFailedProofAssetKeys((prev) => {
      if (prev[assetKey]) return prev;
      return { ...prev, [assetKey]: true };
    });
  }, []);

  React.useEffect(() => {
    if (orderProofLinks) {
      setFailedProofAssetKeys({});
    }
  }, [orderProofLinks]);

  const refreshOrderProofLinksSafely = React.useCallback(async () => {
    try {
      await refetchOrderProofLinks();
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err, "Could not load confirmation files"));
    }
  }, [refetchOrderProofLinks]);

  const handleProofAssetError = React.useCallback(
    (assetKey: string | null) => {
      markProofAssetFailed(assetKey);
      if (!isProofsVisible || isFetchingProofLinks || proofAutoRefreshDone) return;
      setProofAutoRefreshDone(true);
      void refreshOrderProofLinksSafely();
    },
    [
      isFetchingProofLinks,
      isProofsVisible,
      markProofAssetFailed,
      proofAutoRefreshDone,
      refreshOrderProofLinksSafely,
    ],
  );

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
    queryClient.invalidateQueries({ queryKey: ["order-legs", orderId] });
    queryClient.invalidateQueries({ queryKey: ["order-payment-intents", orderId] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["manager-analytics-v2-summary"] });
  }, [orderId, queryClient]);

  const bookCarrierMutation = useMutation({
    mutationFn: (payload: { legId: string; providerId: string }) =>
      bookCarrierForOrderLeg({
        orderId,
        legId: payload.legId,
        providerId: payload.providerId,
      }),
    onSuccess: (result) => {
      toast.success(
        result.outbox.status === "sent"
          ? "Carrier booking already processed"
          : "Carrier booking queued",
      );
      refreshOrderQueries();
      queryClient.invalidateQueries({ queryKey: ["integration-outbox"] });
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to book carrier"));
    },
  });

  const syncCarrierTrackingMutation = useMutation({
    mutationFn: (payload: { legId: string }) =>
      syncCarrierTrackingForOrderLeg({
        orderId,
        legId: payload.legId,
      }),
    onSuccess: () => {
      toast.success("Carrier tracking sync queued");
      refreshOrderQueries();
      queryClient.invalidateQueries({ queryKey: ["integration-outbox"] });
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to sync carrier tracking"));
    },
  });

  const cancelCarrierMutation = useMutation({
    mutationFn: (payload: { legId: string; reason?: string | null }) =>
      cancelCarrierForOrderLeg({
        orderId,
        legId: payload.legId,
        reason: payload.reason,
      }),
    onSuccess: () => {
      toast.success("Carrier cancellation queued");
      setCancelCarrierLeg(null);
      setCancelCarrierReason("");
      refreshOrderQueries();
      queryClient.invalidateQueries({ queryKey: ["integration-outbox"] });
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to cancel carrier booking"));
    },
  });

  const syncPaymentMutation = useMutation({
    mutationFn: (paymentIntentId: string) => syncPaymentIntent(paymentIntentId),
    onSuccess: (result) => {
      const status = result.paymentIntent.statusCanonical || result.providerStatus;
      toast.success(`Payment synced: ${displayPaymentState(status)}`);
      refreshOrderQueries();
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to sync payment status"));
    },
  });

  const retryPaymentMutation = useMutation({
    mutationFn: () => retryOrderPayment({ orderId }),
    onSuccess: (result) => {
      toast.success("Payment retry created");
      refreshOrderQueries();
      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
      }
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to retry payment"));
    },
  });

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
  const mapboxToken = React.useMemo(() => getMapboxToken(), []);
  const pickupCoordsFromOrder: LatLng | null = React.useMemo(() => {
    const lat = toLatitude(order?.pickupLat);
    const lng = toLongitude(order?.pickupLng);
    if (lat == null || lng == null) return null;
    return { lat, lng };
  }, [order?.pickupLat, order?.pickupLng]);
  const pickupCoordsFromSnapshot: LatLng | null = React.useMemo(() => {
    const lat = toLatitude(order?.senderAddressObj?.latitude);
    const lng = toLongitude(order?.senderAddressObj?.longitude);
    if (lat == null || lng == null) return null;
    return { lat, lng };
  }, [order?.senderAddressObj?.latitude, order?.senderAddressObj?.longitude]);
  const dropoffCoordsFromOrder: LatLng | null = React.useMemo(() => {
    const lat = toLatitude(order?.dropoffLat);
    const lng = toLongitude(order?.dropoffLng);
    if (lat == null || lng == null) return null;
    return { lat, lng };
  }, [order?.dropoffLat, order?.dropoffLng]);
  const dropoffCoordsFromSnapshot: LatLng | null = React.useMemo(() => {
    const lat = toLatitude(order?.receiverAddressObj?.latitude);
    const lng = toLongitude(order?.receiverAddressObj?.longitude);
    if (lat == null || lng == null) return null;
    return { lat, lng };
  }, [order?.receiverAddressObj?.latitude, order?.receiverAddressObj?.longitude]);
  const pickupCoords: LatLng | null = React.useMemo(
    () => pickupCoordsFromOrder ?? pickupCoordsFromSnapshot,
    [pickupCoordsFromOrder, pickupCoordsFromSnapshot],
  );
  const dropoffCoords: LatLng | null = React.useMemo(() => {
    const primary = dropoffCoordsFromOrder ?? dropoffCoordsFromSnapshot;
    if (!primary) return null;

    if (
      pickupCoords &&
      coordsEqual(primary, pickupCoords) &&
      dropoffCoordsFromSnapshot &&
      !coordsEqual(dropoffCoordsFromSnapshot, pickupCoords)
    ) {
      return dropoffCoordsFromSnapshot;
    }

    return primary;
  }, [dropoffCoordsFromOrder, dropoffCoordsFromSnapshot, pickupCoords]);
  const routeMapUrl = React.useMemo(() => {
    if (!pickupCoords || !dropoffCoords) return null;
    return buildGoogleRouteUrl(pickupCoords, dropoffCoords);
  }, [dropoffCoords, pickupCoords]);
  const yandexRouteUrl = React.useMemo(() => {
    if (!pickupCoords || !dropoffCoords) return null;
    return buildYandexRouteUrl(pickupCoords, dropoffCoords);
  }, [dropoffCoords, pickupCoords]);
  const pickupMapUrl = React.useMemo(
    () => (pickupCoords ? buildGooglePointUrl(pickupCoords) : null),
    [pickupCoords],
  );
  const dropoffMapUrl = React.useMemo(
    () => (dropoffCoords ? buildGooglePointUrl(dropoffCoords) : null),
    [dropoffCoords],
  );
  const mapCenterCoords = pickupCoords ?? dropoffCoords ?? null;
  const mapContainerRef = React.useCallback((node: HTMLDivElement | null) => {
    setMapContainerEl(node);
  }, []);
  React.useEffect(() => {
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    setIsMapPreviewVisible(false);
    setIsProofsVisible(false);
    setProofAutoRefreshDone(false);
    setFailedProofAssetKeys({});
    setMapPreviewStatus("idle");
    setMapPreviewError(null);
    setMapPreviewErrorDetail(null);
  }, [order?.id]);
  React.useEffect(() => {
    if (!isMapPreviewVisible || !mapContainerEl) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapPreviewStatus("idle");
      return;
    }
    if (!mapboxToken) {
      setMapPreviewError("token_missing");
      setMapPreviewErrorDetail("NEXT_PUBLIC_MAPBOX_TOKEN is empty");
      setMapPreviewStatus("error");
      return;
    }
    if (!mapCenterCoords) {
      setMapPreviewError("coords_missing");
      setMapPreviewErrorDetail(null);
      setMapPreviewStatus("error");
      return;
    }

    setMapPreviewStatus("loading");
    setMapPreviewError(null);
    setMapPreviewErrorDetail(null);
    let disposed = false;
    let didLoad = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const initMap = async () => {
      try {
        const mapbox = await loadMapboxForRoute(mapboxToken);
        if (disposed || !mapContainerEl) return;

        const map = new mapbox.Map({
          container: mapContainerEl,
          style: "mapbox://styles/mapbox/streets-v12",
          center: [mapCenterCoords.lng, mapCenterCoords.lat],
          zoom: 12,
          attributionControl: true,
        });
        mapRef.current = map;

        map.on("load", () => {
          if (disposed) return;
          didLoad = true;
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }

          if (pickupCoords) {
            new mapbox.Marker({ color: "#0ea5e9" })
              .setLngLat([pickupCoords.lng, pickupCoords.lat])
              .addTo(map);
          }
          if (dropoffCoords) {
            new mapbox.Marker({ color: "#14b8a6" })
              .setLngLat([dropoffCoords.lng, dropoffCoords.lat])
              .addTo(map);
          }

          if (pickupCoords && dropoffCoords && !coordsEqual(pickupCoords, dropoffCoords)) {
            map.addSource("route-line", {
              type: "geojson",
              data: {
                type: "Feature",
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [pickupCoords.lng, pickupCoords.lat],
                    [dropoffCoords.lng, dropoffCoords.lat],
                  ],
                },
                properties: {},
              },
            });
            map.addLayer({
              id: "route-line-layer",
              type: "line",
              source: "route-line",
              paint: {
                "line-color": "#111827",
                "line-width": 3,
                "line-opacity": 0.85,
              },
            });
            map.fitBounds(
              [
                [Math.min(pickupCoords.lng, dropoffCoords.lng), Math.min(pickupCoords.lat, dropoffCoords.lat)],
                [Math.max(pickupCoords.lng, dropoffCoords.lng), Math.max(pickupCoords.lat, dropoffCoords.lat)],
              ],
              { padding: 60, duration: 0 },
            );
          }

          setMapPreviewStatus("ready");
        });

        map.on("error", (event) => {
          if (disposed) return;
          const message = event?.error?.message ?? "Mapbox map error";
          if (didLoad) {
            console.warn("[order-map] non-fatal map error:", message);
            return;
          }
          const lower = message.toLowerCase();
          if (
            lower.includes("unauthorized") ||
            lower.includes("forbidden") ||
            lower.includes("access token") ||
            lower.includes("not authorized")
          ) {
            setMapPreviewError("map_init_failed");
            setMapPreviewErrorDetail(message);
            setMapPreviewStatus("error");
          } else {
            console.warn("[order-map] map error before load (waiting):", message);
          }
        });

        timeoutId = setTimeout(() => {
          if (disposed || didLoad) return;
          setMapPreviewError("map_init_failed");
          setMapPreviewErrorDetail("Map load timed out");
          setMapPreviewStatus("error");
        }, 8000);
      } catch {
        if (disposed) return;
        setMapPreviewError("map_init_failed");
        setMapPreviewErrorDetail("Mapbox module initialization failed");
        setMapPreviewStatus("error");
      }
    };
    void initMap();

    return () => {
      disposed = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [isMapPreviewVisible, mapContainerEl, mapboxToken, mapCenterCoords, pickupCoords, dropoffCoords]);
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
  const proofBundles = orderProofLinks?.proofs ?? [];
  const pickupProofs = proofBundles.filter((bundle) => bundle.stage === "pickup");
  const deliveryProofs = proofBundles.filter((bundle) => bundle.stage === "delivery");

  const loadOrderProofs = React.useCallback(async () => {
    setIsProofsVisible(true);
    setProofAutoRefreshDone(false);
    await refreshOrderProofLinksSafely();
  }, [refreshOrderProofLinksSafely]);

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
    <div className={cn("overflow-x-hidden", hideBackButton ? "p-3 sm:p-4 lg:p-6" : "p-6")}>
      <div className={cn("mx-auto space-y-6", hideBackButton ? "max-w-[1480px]" : "max-w-6xl")}>
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
            {canAssignDriver ? (
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

            {!hideBackButton ? (
              <Button asChild variant="outline">
                <Link href={backHref}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t("common.back")}
                </Link>
              </Button>
            ) : null}
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

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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

        <Tabs defaultValue="overview" className="space-y-4">
          <Card className="rounded-2xl border-border/70 bg-[linear-gradient(180deg,rgba(14,165,233,0.08),rgba(16,185,129,0.05),rgba(255,255,255,0.95))]">
            <CardContent className="p-3">
              <TabsList className="h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0">
                <TabsTrigger
                  value="overview"
                  className="h-10 flex-none rounded-xl border border-border/70 bg-background/80 px-4 data-[state=active]:border-cyan-300 data-[state=active]:bg-cyan-50 data-[state=active]:text-cyan-900"
                >
                  <MapPin className="h-4 w-4" />
                  {t("orderDetails.routeAndContacts")}
                </TabsTrigger>
                <TabsTrigger
                  value="map"
                  className="h-10 flex-none rounded-xl border border-border/70 bg-background/80 px-4 data-[state=active]:border-indigo-300 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-900"
                >
                  <Navigation className="h-4 w-4" />
                  {t("orderDetails.mapAndNavigation")}
                </TabsTrigger>
                <TabsTrigger
                  value="shipment"
                  className="h-10 flex-none rounded-xl border border-border/70 bg-background/80 px-4 data-[state=active]:border-emerald-300 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-900"
                >
                  <Package className="h-4 w-4" />
                  {t("orderDetails.shipmentAndParcels")}
                </TabsTrigger>
                <TabsTrigger
                  value="finance"
                  className="h-10 flex-none rounded-xl border border-border/70 bg-background/80 px-4 data-[state=active]:border-orange-300 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-900"
                >
                  <FileText className="h-4 w-4" />
                  {t("orderDetails.paymentAndPlanning")}
                </TabsTrigger>
                <TabsTrigger
                  value="timeline"
                  className="h-10 flex-none rounded-xl border border-border/70 bg-background/80 px-4 data-[state=active]:border-sky-300 data-[state=active]:bg-sky-50 data-[state=active]:text-sky-900"
                >
                  <CalendarClock className="h-4 w-4" />
                  {t("orderDetails.trackingTimeline")}
                </TabsTrigger>
                <TabsTrigger
                  value="confirmations"
                  className="h-10 flex-none rounded-xl border border-border/70 bg-background/80 px-4 data-[state=active]:border-violet-300 data-[state=active]:bg-violet-50 data-[state=active]:text-violet-900"
                >
                  <PenLine className="h-4 w-4" />
                  {t("orderDetails.confirmations")}
                </TabsTrigger>
              </TabsList>
            </CardContent>
          </Card>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("orderDetails.routeAndContacts")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                      <p className="text-xs text-muted-foreground">{t("orderDetails.pickup")}</p>
                      <p className="mt-1 font-medium">{order.pickupAddress || "-"}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-background/60 p-4">
                      <p className="text-xs text-muted-foreground">{t("orderDetails.dropoff")}</p>
                      <p className="mt-1 font-medium">{order.dropoffAddress || "-"}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
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
          </TabsContent>

          <TabsContent value="map" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("orderDetails.mapAndNavigation")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{t("orderDetails.mapPreview")}</p>
                    <p className="mt-1 font-medium">{t("orderDetails.mapPreviewHint")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {routeMapUrl ? (
                      <Button asChild type="button" variant="default" size="sm" className="h-8 rounded-lg">
                        <a href={routeMapUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-1 h-3.5 w-3.5" />
                          {t("orderDetails.openRoute")}
                        </a>
                      </Button>
                    ) : null}
                    {yandexRouteUrl ? (
                      <Button asChild type="button" variant="outline" size="sm" className="h-8 rounded-lg">
                        <a href={yandexRouteUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-1 h-3.5 w-3.5" />
                          {t("orderDetails.openRouteYandex")}
                        </a>
                      </Button>
                    ) : null}
                    {pickupMapUrl ? (
                      <Button asChild type="button" variant="outline" size="sm" className="h-8 rounded-lg">
                        <a href={pickupMapUrl} target="_blank" rel="noreferrer">
                          <MapPin className="mr-1 h-3.5 w-3.5" />
                          {t("orderDetails.openPickupMap")}
                        </a>
                      </Button>
                    ) : null}
                    {dropoffMapUrl ? (
                      <Button asChild type="button" variant="outline" size="sm" className="h-8 rounded-lg">
                        <a href={dropoffMapUrl} target="_blank" rel="noreferrer">
                          <MapPin className="mr-1 h-3.5 w-3.5" />
                          {t("orderDetails.openDropoffMap")}
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-xl border border-border/60 bg-muted/25">
                  <div className="h-72 w-full">
                    {!isMapPreviewVisible ? (
                      <div className="flex h-full items-center justify-center p-4">
                        <Button
                          type="button"
                          className="rounded-xl"
                          onClick={() => setIsMapPreviewVisible(true)}
                          disabled={!pickupCoords && !dropoffCoords}
                        >
                          <Navigation className="mr-2 h-4 w-4" />
                          {t("orderDetails.showMap")}
                        </Button>
                      </div>
                    ) : (
                      <div className="relative h-full w-full">
                        <div ref={mapContainerRef} className="h-full w-full bg-slate-100" />

                        {mapPreviewStatus === "loading" ? (
                          <div className="absolute inset-0 flex items-center justify-center px-4">
                            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-1.5 text-xs text-muted-foreground">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              {t("orderDetails.loadingMap")}
                            </div>
                          </div>
                        ) : null}

                        {mapPreviewStatus === "error" ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/88 px-4 text-sm text-muted-foreground backdrop-blur-[1px]">
                            <span>
                              {mapPreviewError === "token_missing"
                                ? t("orderDetails.mapTokenMissing")
                                : mapPreviewError === "coords_missing"
                                  ? t("orderDetails.mapUnavailable")
                                  : t("orderDetails.mapLoadFailed")}
                            </span>
                            {mapPreviewErrorDetail ? (
                              <span className="max-w-[90%] rounded-md border border-border/50 bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
                                {mapPreviewErrorDetail}
                              </span>
                            ) : null}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg"
                              onClick={() => {
                                setMapPreviewStatus("idle");
                                setIsMapPreviewVisible(false);
                              }}
                            >
                              {t("orderDetails.hideMap")}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                    <p className="text-xs text-muted-foreground">{t("orderDetails.pickupCoords")}</p>
                    <p className="mt-1 font-mono text-xs">{formatLatLng(pickupCoords)}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                    <p className="text-xs text-muted-foreground">{t("orderDetails.dropoffCoords")}</p>
                    <p className="mt-1 font-mono text-xs">{formatLatLng(dropoffCoords)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="shipment" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("orderDetails.shipmentAndParcels")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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

                {canManageCarrier ? (
                  <div className="rounded-2xl border border-border/70 bg-linear-to-br from-slate-50 via-white to-cyan-50/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-800">
                          <Truck className="h-3.5 w-3.5" />
                          Carrier integrations
                        </div>
                        <h3 className="mt-3 text-base font-semibold">Book external carriers by leg</h3>
                        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                          Carrier booking is attached to each route leg. Use this only for legs handled by external partners; internal fleet legs can stay unbooked.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 gap-2 rounded-xl"
                        onClick={() => {
                          queryClient.invalidateQueries({ queryKey: ["order-legs", orderId] });
                          queryClient.invalidateQueries({
                            queryKey: ["integration-providers", actorCompanyId, "carrier", "active"],
                          });
                        }}
                      >
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                      </Button>
                    </div>

                    {!actorCompanyId ? (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        Active company scope is missing from the session. Re-login with a company membership before booking carriers.
                      </div>
                    ) : null}

                    {isFetchingOrderLegs ? (
                      <div className="mt-4 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading route legs...
                      </div>
                    ) : orderLegs.length === 0 ? (
                      <div className="mt-4 rounded-xl border border-dashed border-border/80 bg-background/70 p-4 text-sm text-muted-foreground">
                        No route legs exist yet for this order. Legs are created from pricing/routing rules before carrier booking.
                      </div>
                    ) : (
                      <div className="mt-4 grid gap-3">
                        {orderLegs.map((leg) => {
                          const selectedProviderId =
                            selectedCarrierProviderByLeg[leg.id] ||
                            leg.carrierProviderId ||
                            (activeCarrierProviders.length === 1 ? activeCarrierProviders[0].id : "");
                          const bookingStatus = leg.carrierBookingStatus || "not_requested";
                          const isBookingCurrentLeg =
                            bookCarrierMutation.isPending &&
                            bookCarrierMutation.variables?.legId === leg.id;
                          const isSyncingCurrentLeg =
                            syncCarrierTrackingMutation.isPending &&
                            syncCarrierTrackingMutation.variables?.legId === leg.id;
                          const isCancellingCurrentLeg =
                            cancelCarrierMutation.isPending &&
                            cancelCarrierMutation.variables?.legId === leg.id;
                          const selectedProvider = activeCarrierProviders.find(
                            (provider) => provider.id === selectedProviderId,
                          );
                          const canBook =
                            Boolean(selectedProvider) &&
                            !isBookingCurrentLeg &&
                            !["requested", "booked"].includes(toLower(bookingStatus));
                          const hasCarrierTrackingIdentity = Boolean(
                            leg.carrierRef || leg.carrierTrackingNumber,
                          );
                          const canSyncCarrierTracking =
                            hasCarrierTrackingIdentity &&
                            !isSyncingCurrentLeg &&
                            !isCancellingCurrentLeg;
                          const canCancelCarrier =
                            toLower(bookingStatus) === "booked" &&
                            Boolean(leg.carrierRef) &&
                            !isCancellingCurrentLeg &&
                            !isSyncingCurrentLeg;
                          const hasSelectedProviderOption = activeCarrierProviders.some(
                            (provider) => provider.id === selectedProviderId,
                          );

                          return (
                            <div
                              key={leg.id}
                              className="rounded-2xl border border-border/70 bg-background/85 p-4 shadow-sm"
                            >
                              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                <div className="min-w-0 space-y-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline" className="rounded-full">
                                      Leg {leg.sequence}
                                    </Badge>
                                    <Badge variant="secondary" className="rounded-full">
                                      {prettyEnum(leg.mode)}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "rounded-full border px-2 py-0.5 text-xs",
                                        carrierBookingStatusClasses(bookingStatus),
                                      )}
                                    >
                                      {displayCarrierBookingStatus(bookingStatus)}
                                    </Badge>
                                  </div>

                                  <div className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
                                    <div>
                                      <p className="text-xs text-muted-foreground">Route</p>
                                      <p className="font-medium">
                                        {leg.fromCountry || "-"} {"->"} {leg.toCountry || "-"}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground">Partner</p>
                                      <p className="font-medium">
                                        {selectedProvider ? providerLabel(selectedProvider) : leg.carrierCode || "-"}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground">Carrier ref</p>
                                      <p className="font-mono text-xs">{leg.carrierRef || "-"}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground">Tracking number</p>
                                      <p className="font-mono text-xs">{leg.carrierTrackingNumber || "-"}</p>
                                    </div>
                                  </div>

                                  {leg.carrierBookingError ? (
                                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                                      {leg.carrierBookingError}
                                    </div>
                                  ) : null}
                                </div>

                                <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap xl:w-auto xl:min-w-[560px] xl:justify-end">
                                  <Select
                                    value={selectedProviderId || "none"}
                                    onValueChange={(value) =>
                                      setSelectedCarrierProviderByLeg((prev) => ({
                                        ...prev,
                                        [leg.id]: value === "none" ? "" : value,
                                      }))
                                    }
                                    disabled={
                                      isFetchingCarrierProviders ||
                                      activeCarrierProviders.length === 0 ||
                                      ["requested", "booked"].includes(toLower(bookingStatus))
                                    }
                                  >
                                    <SelectTrigger className="h-10 flex-1 rounded-xl">
                                      <SelectValue placeholder="Select carrier provider" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">Select carrier provider</SelectItem>
                                      {selectedProviderId && !hasSelectedProviderOption ? (
                                        <SelectItem value={selectedProviderId}>
                                          {leg.carrierCode || "Current provider"} (not active)
                                        </SelectItem>
                                      ) : null}
                                      {activeCarrierProviders.map((provider) => (
                                        <SelectItem key={provider.id} value={provider.id}>
                                          {providerLabel(provider)}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>

                                  <Button
                                    type="button"
                                    className="h-10 rounded-xl"
                                    disabled={!canBook}
                                    onClick={() => {
                                      if (!selectedProviderId) return;
                                      bookCarrierMutation.mutate({
                                        legId: leg.id,
                                        providerId: selectedProviderId,
                                      });
                                    }}
                                  >
                                    {isBookingCurrentLeg ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <Truck className="mr-2 h-4 w-4" />
                                    )}
                                    {toLower(bookingStatus) === "failed" ? "Retry booking" : "Book carrier"}
                                  </Button>

                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-10 rounded-xl"
                                    disabled={!canSyncCarrierTracking}
                                    onClick={() =>
                                      syncCarrierTrackingMutation.mutate({ legId: leg.id })
                                    }
                                  >
                                    {isSyncingCurrentLeg ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <RefreshCw className="mr-2 h-4 w-4" />
                                    )}
                                    Sync tracking
                                  </Button>

                                  <Button
                                    type="button"
                                    variant="destructive"
                                    className="h-10 rounded-xl"
                                    disabled={!canCancelCarrier}
                                    onClick={() => {
                                      setCancelCarrierLeg(leg);
                                      setCancelCarrierReason("");
                                    }}
                                  >
                                    {isCancellingCurrentLeg ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <CircleAlert className="mr-2 h-4 w-4" />
                                    )}
                                    Cancel carrier
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {!isFetchingCarrierProviders && activeCarrierProviders.length === 0 ? (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        No active carrier providers found for this company. Create one in Billing & Pricing {"->"} Integrations first.
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {canManageCarrier ? <Separator /> : null}

                {parcels.length ? (
                  <div className="grid gap-3 xl:grid-cols-2">
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
          </TabsContent>

          <TabsContent value="finance" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("orderDetails.paymentAndPlanning")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                          <ReceiptText className="h-4 w-4" />
                          {t("orderDetails.invoiceStatus")}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn("rounded-full border px-2 py-0.5 text-xs", paymentStatusClasses(invoice?.status))}
                        >
                          {displayEnum(invoice?.status, t) || t("orderDetails.notCreated")}
                        </Badge>
                      </div>
                      {paymentUrl && invoiceStatus !== "paid" ? (
                        <a
                          className="mt-3 inline-flex items-center gap-1 text-xs font-medium underline underline-offset-4"
                          href={paymentUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t("orderDetails.payNow")}
                          <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                        </a>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                      <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <CreditCard className="h-4 w-4" />
                        {t("orderDetails.paymentType")}
                      </p>
                      <p className="mt-2 font-semibold">{getPaymentTypeLabel(order.paymentType, t)}</p>
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                      <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <BadgeDollarSign className="h-4 w-4" />
                        Payment state
                      </p>
                      <Badge
                        variant="outline"
                        className={cn("mt-2 rounded-full border px-2 py-0.5 text-xs", paymentStatusClasses(order.paymentState))}
                      >
                        {displayPaymentState(order.paymentState)}
                      </Badge>
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                      <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <Banknote className="h-4 w-4" />
                        {t("orderDetails.cod")}
                      </p>
                      <p className="mt-2 font-semibold">{formatMoney(order.codAmount, order.currency)}</p>
                      <Badge
                        variant="outline"
                        className={cn("mt-2 rounded-full border px-2 py-0.5 text-xs", paymentStatusClasses(order.codPaidStatus))}
                      >
                        {displayPaidStatus(order.codPaidStatus, t)}
                      </Badge>
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                      <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <WalletCards className="h-4 w-4" />
                        {t("orderDetails.serviceCharge")}
                      </p>
                      <p className="mt-2 font-semibold">{formatMoney(order.serviceCharge, order.currency)}</p>
                      <Badge
                        variant="outline"
                        className={cn("mt-2 rounded-full border px-2 py-0.5 text-xs", paymentStatusClasses(order.serviceChargePaidStatus))}
                      >
                        {displayPaidStatus(order.serviceChargePaidStatus, t)}
                      </Badge>
                    </div>
                  </div>

                  {canReadPayments || canRetryPayment ? (
                    <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                            <RefreshCw className="h-4 w-4" />
                            Provider payment recovery
                          </p>
                          {latestPaymentIntent ? (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="rounded-full">
                                {latestPaymentIntent.provider}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "rounded-full border px-2 py-0.5 text-xs",
                                  paymentStatusClasses(latestPaymentIntent.statusCanonical),
                                )}
                              >
                                {displayPaymentState(latestPaymentIntent.statusCanonical)}
                              </Badge>
                              <span className="text-sm font-medium">
                                {formatMinorMoney(
                                  latestPaymentIntent.amountMinor,
                                  latestPaymentIntent.currency,
                                )}
                              </span>
                            </div>
                          ) : (
                            <p className="mt-2 text-sm text-muted-foreground">
                              {isFetchingPaymentIntents
                                ? "Loading payment intents..."
                                : "No online payment intent exists for this order."}
                            </p>
                          )}
                        </div>

                        {latestPaymentIntent ? (
                          <div className="flex flex-wrap items-center gap-2">
                            {latestPaymentIntent.providerCheckoutUrl ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9 gap-2 rounded-xl"
                                onClick={() =>
                                  window.open(
                                    latestPaymentIntent.providerCheckoutUrl!,
                                    "_blank",
                                    "noopener,noreferrer",
                                  )
                                }
                              >
                                <ExternalLink className="h-4 w-4" />
                                Open checkout
                              </Button>
                            ) : null}
                            {canReadPayments ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9 gap-2 rounded-xl"
                                onClick={() => syncPaymentMutation.mutate(latestPaymentIntent.id)}
                                disabled={syncPaymentMutation.isPending}
                              >
                                {syncPaymentMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4" />
                                )}
                                Sync status
                              </Button>
                            ) : null}
                            {canRetryPayment ? (
                              <Button
                                type="button"
                                size="sm"
                                className="h-9 gap-2 rounded-xl"
                                onClick={() => retryPaymentMutation.mutate()}
                                disabled={
                                  retryPaymentMutation.isPending ||
                                  !canRetryPaymentIntent(latestPaymentIntent)
                                }
                              >
                                {retryPaymentMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CreditCard className="h-4 w-4" />
                                )}
                                Retry payment
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      {latestPaymentIntent?.provider === "PAYME" ||
                      latestPaymentIntent?.provider === "UZUM" ? (
                        <p className="mt-3 text-xs text-muted-foreground">
                          This provider is webhook-first in the current setup; sync records an audit
                          attempt and keeps the status pending until provider callback arrives.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="grid gap-3 xl:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                      <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <Clipboard className="h-4 w-4" />
                        {t("orderDetails.billing")}
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                          <p className="text-xs text-muted-foreground">{t("orderDetails.deliveryPaidBy")}</p>
                          <p className="mt-1 font-medium">{getPaidByLabel(order.deliveryChargePaidBy, t)}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                          <p className="text-xs text-muted-foreground">{t("orderDetails.recipientUnavailable")}</p>
                          <p className="mt-1 font-medium">
                            {getRecipientUnavailableLabel(order.ifRecipientNotAvailable, t)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                      <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarClock className="h-4 w-4" />
                        {t("orderDetails.schedule")}
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                          <p className="text-xs text-muted-foreground">{t("orderDetails.pickup")}</p>
                          <p className="mt-1 font-medium">{formatDateTime(order.plannedPickupAt)}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                          <p className="text-xs text-muted-foreground">{t("orderDetails.delivery")}</p>
                          <p className="mt-1 font-medium">{formatDateTime(order.plannedDeliveryAt)}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                          <p className="text-xs text-muted-foreground">{t("orderDetails.promise")}</p>
                          <p className="mt-1 font-medium">{formatDateTime(order.promiseDate)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                    <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                      <HandCoins className="h-4 w-4" />
                      {t("orderDetails.cash.title")}
                    </p>
                    {cashCollections.length ? (
                      <div className="mt-3 space-y-3">
                        {cashCollections.map((collection) => {
                          const latestEvent = collection.events?.[collection.events.length - 1] ?? null;
                          const isScopedWarehouseUser =
                            canHandleWarehouseCash &&
                            Boolean(primaryWarehouseId) &&
                            order?.currentWarehouse?.id === primaryWarehouseId;
                          const canAcceptToWarehouse =
                            isScopedWarehouseUser &&
                            (collection.status === "expected" ||
                              collection.currentHolderType === "driver");
                          const canSettleToFinance =
                            canSettleCash &&
                            collection.status === "held";
                          return (
                            <div
                              key={collection.id}
                              className="rounded-2xl border border-border/60 bg-background/70 p-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <p className="inline-flex items-center gap-2 font-medium">
                                    <BadgeDollarSign className="h-4 w-4 text-muted-foreground" />
                                    {displayCashKind(collection.kind, t)}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge
                                      variant="outline"
                                      className={cn("rounded-full border px-2 py-0.5 text-xs", paymentStatusClasses(collection.status))}
                                    >
                                      {displayCashStatus(collection.status, t)}
                                    </Badge>
                                    <Badge variant="outline" className="rounded-full border px-2 py-0.5 text-xs">
                                      <span className="inline-flex items-center gap-1">
                                        {cashHolderIcon(collection.currentHolderType)}
                                        {displayCashHolder(collection, t)}
                                      </span>
                                    </Badge>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                                  <p className="text-xs text-muted-foreground">{t("orderDetails.cash.expected")}</p>
                                  <p className="mt-1 font-medium">
                                    {formatMoney(collection.expectedAmount, collection.currency ?? order.currency)}
                                  </p>
                                </div>
                                <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                                  <p className="text-xs text-muted-foreground">{t("orderDetails.cash.currentAmount")}</p>
                                  <p className="mt-1 font-medium">
                                    {formatMoney(
                                      collection.collectedAmount ?? collection.expectedAmount,
                                      collection.currency ?? order.currency,
                                    )}
                                  </p>
                                </div>
                                <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                                  <p className="text-xs text-muted-foreground">{t("orderDetails.cash.collectedAt")}</p>
                                  <p className="mt-1 font-medium">{formatDateTime(collection.collectedAt)}</p>
                                </div>
                                <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                                  <p className="text-xs text-muted-foreground">{t("orderDetails.cash.settledAt")}</p>
                                  <p className="mt-1 font-medium">{formatDateTime(collection.settledAt)}</p>
                                </div>
                              </div>

                              {latestEvent ? (
                                <div className="mt-3 rounded-xl border border-dashed border-border/60 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                                  <span className="inline-flex items-center gap-1 font-medium text-foreground">
                                    <CircleAlert className="h-3.5 w-3.5" />
                                    {t("orderDetails.cash.latestEvent")}:
                                  </span>{" "}
                                  {prettyEnum(latestEvent.eventType)} | {formatDateTime(latestEvent.createdAt)}
                                  {latestEvent.note ? ` | ${latestEvent.note}` : ""}
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
                                                toWarehouseId: primaryWarehouseId ?? null,
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
                </CardContent>
              </Card>

              <div className="space-y-4">
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

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{t("orderDetails.schedule")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
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
            </div>
          </TabsContent>

          <TabsContent value="confirmations" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("orderDetails.confirmations")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{t("orderDetails.confirmations")}</p>
                    <p className="mt-1 text-sm font-medium">{t("orderDetails.confirmationsHint")}</p>
                  </div>

                  {!isProofsVisible ? (
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="h-8 rounded-lg"
                      onClick={() => {
                        void loadOrderProofs();
                      }}
                    >
                      <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
                      {t("orderDetails.loadConfirmations")}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg"
                      onClick={() => {
                        setProofAutoRefreshDone(false);
                        void refreshOrderProofLinksSafely();
                      }}
                      disabled={isFetchingProofLinks}
                    >
                      {isFetchingProofLinks ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      {t("orderDetails.refreshConfirmations")}
                    </Button>
                  )}
                </div>

                {!isProofsVisible ? (
                  <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-5 text-sm text-muted-foreground">
                    {t("orderDetails.confirmationsLazyHint")}
                  </div>
                ) : null}

                {isProofsVisible && isFetchingProofLinks ? (
                  <div className="rounded-xl border border-border/60 bg-background/60 p-5 text-sm text-muted-foreground">
                    <div className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("orderDetails.loadingConfirmations")}
                    </div>
                  </div>
                ) : null}

                {isProofsVisible &&
                !isFetchingProofLinks &&
                pickupProofs.length === 0 &&
                deliveryProofs.length === 0 ? (
                  <div className="rounded-xl border border-border/60 bg-background/60 p-5 text-sm text-muted-foreground">
                    {t("orderDetails.noConfirmations")}
                  </div>
                ) : null}

                {isProofsVisible && !isFetchingProofLinks ? (
                  <div className="space-y-4">
                    {([
                      { key: "pickup", label: t("orderDetails.pickupConfirmation"), rows: pickupProofs },
                      { key: "delivery", label: t("orderDetails.deliveryConfirmation"), rows: deliveryProofs },
                    ] as const).map((section) => (
                      <div
                        key={section.key}
                        className="rounded-2xl border border-border/70 bg-background/70 p-4"
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold">{section.label}</p>
                          <Badge variant="outline" className="rounded-full">
                            {section.rows.length}
                          </Badge>
                        </div>

                        {section.rows.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t("orderDetails.noConfirmationsForStage")}</p>
                        ) : (
                          <div className="grid gap-3 lg:grid-cols-2">
                            {section.rows.map((proof: OrderProofBundle) => (
                              <div
                                key={`${section.key}-${proof.proofId}`}
                                className="rounded-xl border border-border/60 bg-background/60 p-3"
                              >
                                <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                  <span>{formatDateTime(proof.savedAt)}</span>
                                  <span>{proof.signedBy || "-"}</span>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div className="space-y-2">
                                    <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                      <ImageIcon className="h-3.5 w-3.5" />
                                      {t("orderDetails.photoProof")}
                                    </div>
                                    {(() => {
                                      const photoAssetKey = proof.photo?.id
                                        ? `${section.key}:${proof.proofId}:photo:${proof.photo.id}`
                                        : null;
                                      const isPhotoMissing =
                                        !proof.photo?.url ||
                                        (photoAssetKey
                                          ? Boolean(failedProofAssetKeys[photoAssetKey])
                                          : false);

                                      if (isPhotoMissing) {
                                        return (
                                          <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground">
                                            {t("orderDetails.noPhoto")}
                                          </div>
                                        );
                                      }

                                      return (
                                        <a
                                          href={proof.photo!.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="block"
                                        >
                                          <img
                                            src={proof.photo!.url}
                                            alt={`${section.label} ${t("orderDetails.photoProof")}`}
                                            className="h-36 w-full rounded-lg border border-border/60 object-cover"
                                            loading="lazy"
                                            onError={() => handleProofAssetError(photoAssetKey)}
                                          />
                                        </a>
                                      );
                                    })()}
                                  </div>

                                  <div className="space-y-2">
                                    <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                      <PenLine className="h-3.5 w-3.5" />
                                      {t("orderDetails.signatureProof")}
                                    </div>
                                    {(() => {
                                      const signatureAssetKey = proof.signature?.id
                                        ? `${section.key}:${proof.proofId}:signature:${proof.signature.id}`
                                        : null;
                                      const isSignatureMissing =
                                        !proof.signature?.url ||
                                        (signatureAssetKey
                                          ? Boolean(failedProofAssetKeys[signatureAssetKey])
                                          : false);

                                      if (isSignatureMissing) {
                                        return (
                                          <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground">
                                            {t("orderDetails.noSignature")}
                                          </div>
                                        );
                                      }

                                      return (
                                        <a
                                          href={proof.signature!.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="block"
                                        >
                                          <img
                                            src={proof.signature!.url}
                                            alt={`${section.label} ${t("orderDetails.signatureProof")}`}
                                            className="h-36 w-full rounded-lg border border-border/60 bg-white object-contain"
                                            loading="lazy"
                                            onError={() => handleProofAssetError(signatureAssetKey)}
                                          />
                                        </a>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <CardTitle className="text-base">{t("orderDetails.trackingTimeline")}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="w-full sm:w-44">
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

                    <div className="w-full sm:w-52">
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
                                {evt.region ? ` | ${evt.region}` : ""}
                                {evt.warehouse?.name ? ` | ${evt.warehouse.name}` : ""}
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
          </TabsContent>
        </Tabs>

        <Dialog
          open={Boolean(cancelCarrierLeg)}
          onOpenChange={(open) => {
            if (!open && !cancelCarrierMutation.isPending) {
              setCancelCarrierLeg(null);
              setCancelCarrierReason("");
            }
          }}
        >
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Cancel carrier booking</DialogTitle>
              <DialogDescription>
                This queues a cancellation request to the external carrier for leg{" "}
                {cancelCarrierLeg?.sequence ?? "-"}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="rounded-2xl border bg-muted/30 p-3 text-sm">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Carrier</p>
                    <p className="font-medium">{cancelCarrierLeg?.carrierCode || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Carrier ref</p>
                    <p className="font-mono text-xs">{cancelCarrierLeg?.carrierRef || "-"}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="carrier-cancel-reason">
                  Reason
                </label>
                <Textarea
                  id="carrier-cancel-reason"
                  value={cancelCarrierReason}
                  onChange={(event) => setCancelCarrierReason(event.target.value)}
                  placeholder="Optional reason sent to the carrier"
                  disabled={cancelCarrierMutation.isPending}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={cancelCarrierMutation.isPending}
                onClick={() => {
                  setCancelCarrierLeg(null);
                  setCancelCarrierReason("");
                }}
              >
                Keep booking
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={!cancelCarrierLeg || cancelCarrierMutation.isPending}
                onClick={() => {
                  if (!cancelCarrierLeg) return;
                  cancelCarrierMutation.mutate({
                    legId: cancelCarrierLeg.id,
                    reason: cancelCarrierReason.trim() || null,
                  });
                }}
              >
                {cancelCarrierMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CircleAlert className="mr-2 h-4 w-4" />
                )}
                Queue cancellation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
