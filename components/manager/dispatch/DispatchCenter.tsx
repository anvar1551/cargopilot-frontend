"use client";

import * as React from "react";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import AssignDriverDialog from "@/components/manager/orders/AssignDriverDialog";
import { useI18n } from "@/components/i18n/I18nProvider";

import {
  updateOrdersStatusBulk,
} from "@/lib/orders";
import {
  fetchWarehouses,
  normalizeWarehouseType,
  type Warehouse as WarehouseLite,
  type WarehouseType,
} from "@/lib/warehouses";
import { getUser, type Role } from "@/lib/auth";
import { getReasonCodeLabel, getStatusLabel } from "@/lib/i18n/labels";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Plus,
  X,
  Clipboard,
  ExternalLink,
  Layers,
  Package,
  Truck,
  CheckCircle2,
  Warehouse,
  ArrowRight,
  AlertTriangle,
  RotateCcw,
  Ban,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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

type OrderItem = {
  id: string;
  orderNumber?: string | number | null;
  status: string;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  createdAt?: string | null;
  customer?: { email?: string | null } | null;
  parcels?: Array<{
    id?: string | null;
    parcelCode?: string | null;
    pieceNo?: number | null;
    pieceTotal?: number | null;
  }> | null;
};

type Props = {
  orders: OrderItem[];
  onRefresh?: () => void;
  role?: Role;
  detailsBasePath?: string;
  externalScanRequest?: {
    id: number;
    raw: string;
  } | null;
  onExternalScanProcessed?: (result: {
    requestId: number | null;
    raw: string;
    addedOrderIds: string[];
    invalidTokens: string[];
    skippedByLimit: number;
  }) => void;
};

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

const LANE_META: Record<OrderStatus, { icon: LucideIcon }> = {
  pending: { icon: Layers },
  assigned: { icon: Truck },
  pickup_in_progress: { icon: Truck },
  picked_up: { icon: Package },
  at_warehouse: { icon: Warehouse },
  in_transit: { icon: ArrowRight },
  out_for_delivery: { icon: Truck },
  delivered: { icon: CheckCircle2 },
  exception: { icon: AlertTriangle },
  return_in_progress: { icon: RotateCcw },
  returned: { icon: RotateCcw },
  cancelled: { icon: Ban },
};

const MAX_BATCH_SIZE = 100;
const REASON_REQUIRED_STATUSES = new Set<OrderStatus>([
  "exception",
  "return_in_progress",
  "cancelled",
]);

const COMMON_REASON_CODES = [
  "OTHER",
  "SENDER_NOT_AVAILABLE",
  "RECIPIENT_NOT_AVAILABLE",
  "BAD_SENDER_ADDRESS",
  "BAD_RECIPIENT_ADDRESS",
  "OUT_OF_PICKUP_AREA",
  "OUT_OF_DELIVERY_AREA",
  "TO_BE_RETURNED",
  "CANCELLED_BY_CUSTOMER",
  "DRIVER_CANCELLED",
  "LOST",
  "DAMAGED",
];

const LOCATION_STATUS_OPTIONS: Record<WarehouseType, OrderStatus[]> = {
  warehouse: ["at_warehouse", "in_transit", "out_for_delivery", "exception"],
  pickup_point: [
    "at_warehouse",
    "in_transit",
    "out_for_delivery",
    "delivered",
    "exception",
    "return_in_progress",
  ],
};

function orderLabel(order: OrderItem) {
  return order.orderNumber ? `#${order.orderNumber}` : "Unnumbered order";
}

function statusVariant(status: string) {
  switch (status) {
    case "delivered":
      return "default" as const;
    case "at_warehouse":
    case "out_for_delivery":
      return "secondary" as const;
    case "exception":
    case "cancelled":
    case "returned":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

function errorMessage(err: unknown, fallback: string) {
  if (!err || typeof err !== "object") return fallback;
  const e = err as {
    response?: { data?: { error?: string } };
    message?: string;
  };
  return e.response?.data?.error ?? e.message ?? fallback;
}

type ScanMatch = {
  orderId: string;
  kind: "orderId" | "orderNumber" | "parcelCode";
  parcelCode?: string;
};

export default function DispatchCenter({
  orders,
  onRefresh,
  role = "manager",
  detailsBasePath,
  externalScanRequest,
  onExternalScanProcessed,
}: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const resolvedDetailsBasePath = (
    detailsBasePath ??
    (role === "manager" ? "/dashboard/manager/orders" : "/dashboard/orders")
  ).replace(/\/$/, "");

  const canOperateTasks = role === "manager" || role === "warehouse";
  const authUser = useMemo(() => getUser(), []);
  const attachedWarehouseId = authUser?.warehouseId ?? null;

  const [activeStatusTab, setActiveStatusTab] = useState<"all" | OrderStatus>("all");

  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const [operationMode, setOperationMode] = useState<"assign" | "status">("assign");
  const [statusTarget, setStatusTarget] = useState<OrderStatus | "">("");
  const [statusReasonCode, setStatusReasonCode] = useState("");
  const [statusRegion, setStatusRegion] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [statusWarehouseId, setStatusWarehouseId] = useState("");

  const [scanValue, setScanValue] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [scannedParcelsByOrder, setScannedParcelsByOrder] = useState<
    Record<string, string[]>
  >({});
  const lastHandledExternalScanIdRef = React.useRef<number | null>(null);

  const reasonRequired =
    statusTarget !== "" && REASON_REQUIRED_STATUSES.has(statusTarget);
  const needsWarehouseSelection =
    role === "manager" &&
    (statusTarget === "at_warehouse" ||
      statusTarget === "in_transit" ||
      statusTarget === "out_for_delivery");

  const warehousesQuery = useQuery<WarehouseLite[]>({
    queryKey: ["warehouses", "status-bulk"],
    queryFn: fetchWarehouses,
    enabled:
      canOperateTasks &&
      operationMode === "status" &&
      (needsWarehouseSelection || role === "warehouse"),
  });

  const attachedWarehouseType = useMemo<WarehouseType>(() => {
    if (role !== "warehouse") return "warehouse";
    const attached = (warehousesQuery.data ?? []).find(
      (item) => item.id === attachedWarehouseId,
    );
    return normalizeWarehouseType(attached?.type);
  }, [attachedWarehouseId, role, warehousesQuery.data]);

  const warehouseStatusOptions = useMemo<OrderStatus[]>(() => {
    if (role === "manager") return ORDER_STATUSES;
    return LOCATION_STATUS_OPTIONS[attachedWarehouseType];
  }, [attachedWarehouseType, role]);

  React.useEffect(() => {
    if (!statusTarget) return;
    if (!warehouseStatusOptions.includes(statusTarget)) {
      setStatusTarget("");
    }
  }, [statusTarget, warehouseStatusOptions]);

  const statusMutation = useMutation({
    mutationFn: async () => {
      if (!canOperateTasks) throw new Error("Your role cannot update status");
      if (batchIds.length === 0) throw new Error("Add at least one order to batch");
      if (batchIds.length > MAX_BATCH_SIZE) {
        throw new Error(`Maximum ${MAX_BATCH_SIZE} orders are allowed in one operation`);
      }
      if (!statusTarget) {
        throw new Error("Select status");
      }
      if (reasonRequired && !statusReasonCode) {
        throw new Error("Reason code is required for this status");
      }

      if (role === "warehouse" && !attachedWarehouseId) {
        throw new Error("Warehouse user has no attached warehouse");
      }

      if (needsWarehouseSelection && !statusWarehouseId) {
        throw new Error("Select warehouse for this update");
      }

      return updateOrdersStatusBulk({
        orderIds: batchIds,
        status: statusTarget,
        warehouseId:
          role === "warehouse"
            ? attachedWarehouseId
            : needsWarehouseSelection
              ? statusWarehouseId
              : null,
        reasonCode: statusReasonCode || null,
        note: statusNote.trim() || null,
        region: statusRegion.trim() || null,
      });
    },
    onSuccess: () => {
      toast.success(`Updated ${batchIds.length} order(s)`);
      setBatchIds([]);
      setScannedParcelsByOrder({});
      setStatusTarget("");
      setStatusReasonCode("");
      setStatusNote("");
      setStatusRegion("");
      setStatusWarehouseId("");
      onRefresh?.();
    },
    onError: (err: unknown) => {
      toast.error(errorMessage(err, "Failed to update status"));
    },
  });

  const byStatus = useMemo(() => {
    const map: Record<OrderStatus | "other", OrderItem[]> = {
      pending: [],
      assigned: [],
      pickup_in_progress: [],
      picked_up: [],
      at_warehouse: [],
      in_transit: [],
      out_for_delivery: [],
      delivered: [],
      exception: [],
      return_in_progress: [],
      returned: [],
      cancelled: [],
      other: [],
    };

    for (const o of orders) {
      const s = (o?.status ?? "other") as OrderStatus | "other";
      if (s in map) map[s].push(o);
      else map.other.push(o);
    }

    for (const key of Object.keys(map) as Array<OrderStatus | "other">) {
      map[key] = [...map[key]].sort((a, b) => {
        const da = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
        const db = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
        return db - da;
      });
    }

    return map;
  }, [orders]);

  const statusCounts = useMemo(() => {
    return ORDER_STATUSES.reduce<Record<OrderStatus, number>>((acc, s) => {
      acc[s] = byStatus[s].length;
      return acc;
    }, {} as Record<OrderStatus, number>);
  }, [byStatus]);

  const batchSet = useMemo(() => new Set(batchIds), [batchIds]);
  const isBatchFull = batchIds.length >= MAX_BATCH_SIZE;

  const batchOrders = useMemo(() => {
    const map = new Map<string, OrderItem>();
    orders.forEach((o) => map.set(o.id, o));
    return batchIds.map((id) => map.get(id)).filter(Boolean) as OrderItem[];
  }, [batchIds, orders]);

  const visibleStatuses: OrderStatus[] =
    activeStatusTab === "all" ? ORDER_STATUSES : [activeStatusTab];

  const addToBatch = (id: string) => {
    setBatchIds((prev) => {
      if (prev.includes(id)) return prev;
      if (prev.length >= MAX_BATCH_SIZE) {
        toast.error(`Batch limit reached (${MAX_BATCH_SIZE})`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const removeFromBatch = (id: string) => {
    setBatchIds((prev) => prev.filter((x) => x !== id));
    setScannedParcelsByOrder((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const clearBatch = () => {
    setBatchIds([]);
    setScannedParcelsByOrder({});
    setScanError(null);
  };

  const goDetails = (id: string) => {
    router.push(`${resolvedDetailsBasePath}/${id}`);
  };

  const processScanRaw = useCallback(
    (rawValue: string) => {
      const raw = rawValue.trim();
      if (!raw) return;
      let addedOrderIds: string[] = [];
      let skippedByLimit = 0;

      const tokens = raw
        .split(/[\s,]+/g)
        .map((x) => x.trim())
        .filter(Boolean);

      const byId = new Map<string, ScanMatch>();
      for (const o of orders) {
        byId.set(o.id, { orderId: o.id, kind: "orderId" });
        if (o.orderNumber != null) {
          byId.set(String(o.orderNumber), {
            orderId: o.id,
            kind: "orderNumber",
          });
        }
        for (const p of o.parcels ?? []) {
          if (p.parcelCode) {
            byId.set(p.parcelCode, {
              orderId: o.id,
              kind: "parcelCode",
              parcelCode: p.parcelCode,
            });
          }
        }
      }

      const resolvedMatches: ScanMatch[] = [];
      const invalid: string[] = [];

      for (const t of tokens) {
        const resolved = byId.get(t);
        if (resolved) resolvedMatches.push(resolved);
        else invalid.push(t);
      }

      if (resolvedMatches.length) {
        const resolvedIds = resolvedMatches.map((m) => m.orderId);
        const uniqueIncoming = Array.from(new Set(resolvedIds)).filter(
          (id) => !batchSet.has(id),
        );
        const capacityLeft = Math.max(0, MAX_BATCH_SIZE - batchSet.size);
        const toAdd = uniqueIncoming.slice(0, capacityLeft);
        skippedByLimit = Math.max(0, uniqueIncoming.length - toAdd.length);
        addedOrderIds = toAdd;

        if (toAdd.length) {
          setBatchIds((prev) => [...prev, ...toAdd]);
        }
        if (skippedByLimit > 0) {
          toast.error(
            `Batch limit is ${MAX_BATCH_SIZE}. ${skippedByLimit} item(s) were not added.`,
          );
        }

        const validOrderSet = new Set<string>(batchSet);
        toAdd.forEach((id) => validOrderSet.add(id));
        const parcelMatches = resolvedMatches.filter(
          (m) =>
            m.kind === "parcelCode" &&
            m.parcelCode &&
            validOrderSet.has(m.orderId),
        );

        if (parcelMatches.length) {
          setScannedParcelsByOrder((prev) => {
            const next = { ...prev };
            for (const match of parcelMatches) {
              const existing = new Set(next[match.orderId] ?? []);
              existing.add(match.parcelCode!);
              next[match.orderId] = Array.from(existing);
            }
            return next;
          });
        }
      }

      if (invalid.length) {
        setScanError(
          `Not found: ${invalid.slice(0, 3).join(", ")}${
            invalid.length > 3 ? "..." : ""
          }`,
        );
      } else {
        setScanError(null);
      }

      onExternalScanProcessed?.({
        requestId: externalScanRequest?.id ?? null,
        raw,
        addedOrderIds,
        invalidTokens: invalid,
        skippedByLimit,
      });
    },
    [orders, batchSet, externalScanRequest?.id, onExternalScanProcessed],
  );

  const onScanAdd = () => {
    processScanRaw(scanValue);
    setScanValue("");
  };

  React.useEffect(() => {
    if (!externalScanRequest?.raw) return;
    if (lastHandledExternalScanIdRef.current === externalScanRequest.id) return;
    lastHandledExternalScanIdRef.current = externalScanRequest.id;
    processScanRaw(externalScanRequest.raw);
  }, [externalScanRequest?.id, externalScanRequest?.raw, processScanRaw]);

  const parcelCompletenessWarnings = useMemo(() => {
    const warnings: Array<{
      orderId: string;
      orderLabel: string;
      scanned: number;
      total: number;
    }> = [];

    for (const order of batchOrders) {
      const total = Math.max(
        1,
        order.parcels?.[0]?.pieceTotal ?? 0,
        order.parcels?.length ?? 0,
      );

      if (total <= 1) continue;

      const knownParcelCodes = new Set(
        (order.parcels ?? [])
          .map((p) => p.parcelCode)
          .filter((v): v is string => Boolean(v)),
      );
      const scanned = (scannedParcelsByOrder[order.id] ?? []).filter((code) =>
        knownParcelCodes.has(code),
      ).length;

      if (scanned < total) {
        warnings.push({
          orderId: order.id,
          orderLabel: orderLabel(order),
          scanned,
          total,
        });
      }
    }

    return warnings;
  }, [batchOrders, scannedParcelsByOrder]);

  const statusDisabledReasons = useMemo(() => {
    if (operationMode !== "status") return [] as string[];

    const reasons: string[] = [];
    if (!canOperateTasks) {
      reasons.push("Your role cannot update statuses.");
    }
    if (batchIds.length === 0) {
      reasons.push("Add at least one order to the batch.");
    }
    if (batchIds.length > MAX_BATCH_SIZE) {
      reasons.push(`Maximum ${MAX_BATCH_SIZE} orders are allowed.`);
    }
    if (role === "warehouse" && !attachedWarehouseId) {
      reasons.push("No warehouse is attached to your account.");
    }
    if (!statusTarget) {
      reasons.push("Select status.");
    }
    if (reasonRequired && !statusReasonCode) {
      reasons.push("Reason code is required for this status.");
    }
    if (needsWarehouseSelection && !statusWarehouseId) {
      reasons.push("Select a warehouse for this update.");
    }

    return reasons;
  }, [
    operationMode,
    canOperateTasks,
    batchIds.length,
    role,
    attachedWarehouseId,
    statusTarget,
    reasonRequired,
    statusReasonCode,
    needsWarehouseSelection,
    statusWarehouseId,
  ]);

  const canApplyStatus =
    operationMode === "status" && statusDisabledReasons.length === 0;

  const CartContent = (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="text-sm font-medium">Scan to Batch</div>
        <div className="flex gap-2">
          <Input
            value={scanValue}
            onChange={(e) => setScanValue(e.target.value)}
            placeholder="Scan order ID / order number / parcel code..."
          />
          <Button
            onClick={onScanAdd}
            className="gap-2"
            disabled={isBatchFull}
            title={isBatchFull ? `Batch limit is ${MAX_BATCH_SIZE}` : undefined}
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>

        {scanError ? <div className="text-xs text-destructive">{scanError}</div> : null}
      </div>

      <div className="rounded-xl border bg-background">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="text-sm">
            {t("dispatch.selected")}: <span className="font-medium">{batchIds.length}/{MAX_BATCH_SIZE}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearBatch}
            disabled={batchIds.length === 0}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            {t("dispatch.clear")}
          </Button>
        </div>

        <div className="max-h-[320px] overflow-auto">
          {batchOrders.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">{t("dispatch.noOrdersInBatch")}</div>
          ) : (
            <div className="divide-y">
              {batchOrders.map((o) => (
                <div key={o.id} className="p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariant(o.status)} className="capitalize">
                        {getStatusLabel(o.status, t)}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">{orderLabel(o)}</span>
                    </div>
                    <div className="mt-1 text-sm truncate">
                      {o.pickupAddress} <span className="text-muted-foreground">{"->"}</span> {o.dropoffAddress}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      title={t("dispatch.openDetails")}
                      onClick={() => goDetails(o.id)}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      title={t("dispatch.removeFromBatch")}
                      onClick={() => removeFromBatch(o.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {parcelCompletenessWarnings.length > 0 ? (
        <div className="rounded-xl border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-900 space-y-1">
          <div className="font-medium">{t("dispatch.multiPieceWarning")}</div>
          {parcelCompletenessWarnings.slice(0, 4).map((w) => (
            <div key={w.orderId}>
              {t("dispatch.scannedMissing", {
                orderLabel: w.orderLabel,
                scanned: w.scanned,
                total: w.total,
                missing: w.total - w.scanned,
              })}
            </div>
          ))}
          {parcelCompletenessWarnings.length > 4 ? (
            <div>{t("dispatch.moreOrders", { count: parcelCompletenessWarnings.length - 4 })}</div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-xl border bg-background p-3 space-y-3">
        <div className="text-sm font-medium">{t("dispatch.operations")}</div>

        {!canOperateTasks ? (
          <div className="rounded-xl border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {t("dispatch.taskUnavailable")}
          </div>
        ) : (
          <div className="grid gap-2 grid-cols-2">
            <Button
              type="button"
              variant={operationMode === "assign" ? "default" : "outline"}
              onClick={() => setOperationMode("assign")}
              className="rounded-xl"
            >
              {t("dispatch.assignDriver")}
            </Button>
            <Button
              type="button"
              variant={operationMode === "status" ? "default" : "outline"}
              onClick={() => setOperationMode("status")}
              className="rounded-xl"
            >
              {t("dispatch.updateStatus")}
            </Button>
          </div>
        )}

        {operationMode === "assign" ? (
          <Button
            className="w-full gap-2"
            onClick={() => setAssignOpen(true)}
            disabled={!canOperateTasks || batchIds.length === 0}
          >
            <Clipboard className="h-4 w-4" />
            {t("dispatch.assignSelected")}
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("dispatch.statusOptional")}</Label>
              <Select
                value={statusTarget || undefined}
                onValueChange={(v) => setStatusTarget(v as OrderStatus)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={t("dispatch.selectStatus")} />
                </SelectTrigger>
                <SelectContent>
                  {warehouseStatusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {getStatusLabel(status, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {reasonRequired ? (
              <div className="space-y-1.5">
                <Label>{t("dispatch.reasonCode")}</Label>
                <Select
                  value={statusReasonCode || undefined}
                  onValueChange={setStatusReasonCode}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={t("dispatch.selectReasonCode")} />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_REASON_CODES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {getReasonCodeLabel(code, t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {needsWarehouseSelection ? (
              <div className="space-y-1.5">
                <Label>{t("dispatch.warehouse")}</Label>
                <Select
                  value={statusWarehouseId || undefined}
                  onValueChange={setStatusWarehouseId}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={t("dispatch.selectWarehouse")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(warehousesQuery.data ?? []).map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name} {w.location ? `- ${w.location}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {role === "warehouse" ? (
              <div className="rounded-xl border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                {t("dispatch.warehouseFromProfile")}
                <span className="ml-1 font-mono">{attachedWarehouseId ?? "not set"}</span>
                <span className="ml-2">
                  (
                  {attachedWarehouseType === "pickup_point"
                    ? t("managerAnalytics.finance.holderTypes.pickup_point")
                    : t("managerAnalytics.finance.holderTypes.warehouse")}
                  )
                </span>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label>{t("dispatch.regionOptional")}</Label>
              <Input
                value={statusRegion}
                onChange={(e) => setStatusRegion(e.target.value)}
                placeholder={t("dispatch.regionPlaceholder")}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("dispatch.noteOptional")}</Label>
              <Input
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder={t("dispatch.notePlaceholder")}
              />
            </div>

            <div className="rounded-xl border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {t("dispatch.applyStatusHint")}
            </div>

            {statusDisabledReasons.length > 0 ? (
              <div className="rounded-xl border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-900 space-y-1">
                {statusDisabledReasons.map((reason, idx) => (
                  <div key={`${reason}-${idx}`}>- {reason}</div>
                ))}
              </div>
            ) : null}

            <Button
              className="w-full"
              onClick={() => {
                if (parcelCompletenessWarnings.length > 0) {
                  toast.warning(
                    "Some multi-piece shipments are incomplete in batch. Please verify missing parcels.",
                  );
                }
                statusMutation.mutate();
              }}
              disabled={!canApplyStatus || statusMutation.isPending}
              title={statusDisabledReasons[0] || undefined}
            >
              {statusMutation.isPending ? t("dispatch.updating") : t("dispatch.applyStatus")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {t("dispatch.instructions")}
          </div>

          {canOperateTasks ? (
            <Button variant="outline" className="lg:hidden gap-2" onClick={() => setCartOpen(true)}>
              <Package className="h-4 w-4" />
              {t("dispatch.batch")} ({batchIds.length})
            </Button>
          ) : null}
        </div>

        <div className="overflow-x-auto pb-1">
          <div className="flex w-max items-center gap-2">
            <Button
              type="button"
              variant={activeStatusTab === "all" ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => setActiveStatusTab("all")}
            >
              {t("dispatch.all")}
              <Badge variant="secondary" className="ml-1.5 rounded-full">
                {orders.length}
              </Badge>
            </Button>

            {ORDER_STATUSES.map((status) => (
              <Button
                key={status}
                type="button"
                variant={activeStatusTab === status ? "default" : "outline"}
                size="sm"
                className="rounded-full capitalize"
                onClick={() => setActiveStatusTab(status)}
              >
                {getStatusLabel(status, t)}
                <Badge variant="secondary" className="ml-1.5 rounded-full">
                  {statusCounts[status]}
                </Badge>
              </Button>
            ))}
          </div>
        </div>

        <div className="w-full min-w-0 overflow-x-auto">
          <div className="flex w-max gap-3 pb-2 pr-2">
            {visibleStatuses.map((status) => {
              const laneOrders = byStatus[status] ?? [];
              const meta = LANE_META[status];
              const Icon = meta.icon;

              return (
                <div key={status} className="w-[340px] flex-none">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <div className="font-medium">{getStatusLabel(status, t)}</div>
                      <Badge variant="outline">{laneOrders.length}</Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {laneOrders.length === 0 ? (
                      <Card className="p-3">
                        <div className="text-sm text-muted-foreground">{t("dispatch.noOrders")}</div>
                      </Card>
                    ) : (
                      laneOrders.slice(0, 40).map((o) => {
                        const inBatch = batchSet.has(o.id);

                        return (
                          <Card
                            key={o.id}
                            className="p-3 hover:bg-muted/30 transition cursor-pointer"
                            onClick={() => goDetails(o.id)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant={statusVariant(o.status)} className="capitalize">
                                    {getStatusLabel(o.status, t)}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground font-mono">
                                    {orderLabel(o)}
                                  </span>
                                </div>

                                <div className="text-sm font-medium truncate">
                                  {o.pickupAddress} <span className="text-muted-foreground">{"->"}</span> {" "}
                                  {o.dropoffAddress}
                                </div>

                                <div className="text-xs text-muted-foreground truncate">
                                  {o.customer?.email
                                    ? `${t("dispatch.customerPrefix")} ${o.customer.email}`
                                    : t("dispatch.customerFallback")}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <Button
                                  type="button"
                                  variant={inBatch ? "secondary" : "outline"}
                                  size="sm"
                                  className="gap-2"
                                  disabled={!canOperateTasks || (!inBatch && isBatchFull)}
                                  title={
                                    !inBatch && isBatchFull
                                      ? `Batch limit is ${MAX_BATCH_SIZE}`
                                      : undefined
                                  }
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!canOperateTasks) return;
                                    if (!inBatch) addToBatch(o.id);
                                    else removeFromBatch(o.id);
                                  }}
                                >
                                  {inBatch ? "In batch" : "+ Batch"}
                                </Button>
                              </div>
                            </div>
                          </Card>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {canOperateTasks ? (
        <div className="hidden lg:block">
          <div className="sticky top-6">
            <Card className="p-4">{CartContent}</Card>
          </div>
        </div>
      ) : null}

      {canOperateTasks ? (
        <Dialog open={cartOpen} onOpenChange={setCartOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Batch Cart</DialogTitle>
            </DialogHeader>
            {CartContent}
          </DialogContent>
        </Dialog>
      ) : null}

      {canOperateTasks ? (
        <AssignDriverDialog
          open={assignOpen}
          onOpenChange={setAssignOpen}
          selectedOrderIds={batchIds}
          onAssigned={() => {
            setBatchIds([]);
            setScannedParcelsByOrder({});
            onRefresh?.();
          }}
        />
      ) : null}
    </div>
  );
}
