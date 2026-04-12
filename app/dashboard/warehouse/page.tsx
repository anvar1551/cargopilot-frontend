"use client";

import * as React from "react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Filter,
  PackageCheck,
  Printer,
  RefreshCw,
  ScanLine,
  Search,
  Truck,
  Warehouse,
} from "lucide-react";

import DispatchCenter from "@/components/manager/dispatch/DispatchCenter";
import PageShell from "@/components/layout/PageShell";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getUser } from "@/lib/auth";
import {
  driverManifestCopy,
  EMPTY_DRIVER_MANIFEST_ERROR,
  POPUP_BLOCKED_DRIVER_MANIFEST_ERROR,
  printDriverManifest,
} from "@/lib/driver-manifest";
import { getStatusLabel } from "@/lib/i18n/labels";
import { fetchOrders, type OrdersResponse } from "@/lib/orders";
import { fetchDrivers, type DriverLite } from "@/lib/manager";
import { playScanSound, primeScanSound } from "@/lib/scan-sound";
import { loadUserSettings } from "@/lib/user-settings";
import { fetchWarehouses } from "@/lib/warehouses";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type OrderItem = React.ComponentProps<typeof DispatchCenter>["orders"][number];

type StatusTone = "default" | "secondary" | "destructive" | "outline";
type LastScanFeedback = {
  requestId: number;
  raw: string;
  addedOrders: OrderItem[];
  invalidTokens: string[];
  skippedByLimit: number;
};

type QuickFilterKey =
  | "all"
  | "needs_intake"
  | "on_floor"
  | "outbound"
  | "exceptions";

const copy = {
  en: {
    badge: "Warehouse floor",
    title: "Warehouse Operations",
    subtitle:
      "Receive inbound freight, control floor queues, scan batches, and push outbound movement without leaving the operational board.",
    attachedWarehouse: "Attached warehouse",
    unlinkedWarehouse: "No warehouse linked",
    floorControl: "Floor control",
    floorControlHint:
      "Scan order ID, order number, or parcel barcode directly into the batch cart on the board. Multi-piece warnings stay active there.",
    searchPlaceholder: "Search by order number, parcel code, customer, or address...",
    quickScan: "Quick scan dock",
    quickScanHint: "Cursor stays here. Press Enter to push directly into the warehouse batch.",
    quickScanPlaceholder: "Scan order ID / order number / parcel code...",
    sendToBatch: "Send to batch",
    lastScan: "Last scan",
    lastScanAdded: "Added to batch",
    lastScanInvalid: "Not found",
    lastScanLimit: "{count} skipped by batch limit",
    lastScanEmpty: "No new orders were added from this scan.",
    scanReady: "Scan-ready intake",
    scanReadyHint: "Use one board for receiving, sorting, and outbound dispatch.",
    refresh: "Refresh",
    queueHealth: "Queue health",
    queueHealthHint: "Physical warehouse flow, not just raw statuses.",
    quickFilters: "Quick filters",
    quickFiltersHint: "Shrink the loaded queue into the warehouse lane you are working right now.",
    filterAll: "All",
    filterNeedsIntake: "Needs intake",
    filterOnFloor: "On floor",
    filterOutbound: "Outbound",
    filterExceptions: "Exceptions",
    intakeQueue: "Needs intake",
    intakeQueueHint: "Picked up and waiting for warehouse receive",
    onFloor: "On floor",
    onFloorHint: "Already received and being sorted",
    outboundWave: "Outbound wave",
    outboundWaveHint: "Transit or last-mile movement already prepared",
    exceptions: "Exceptions",
    exceptionsHint: "Problem or return flow needs manual attention",
    incomplete: "Incomplete multi-piece",
    incompleteHint:
      "Shipments with missing scanned pieces should not leave the floor unchecked.",
    incompleteEmpty:
      "No incomplete multi-piece shipments in the current loaded scope.",
    inboundLane: "Inbound receiving",
    inboundLaneHint: "First warehouse touch after pickup.",
    sortLane: "Sorting floor",
    sortLaneHint: "Shipments physically inside the warehouse.",
    outboundLane: "Outbound handoff",
    outboundLaneHint: "Prepared for linehaul or last-mile execution.",
    issueLane: "Attention lane",
    issueLaneHint: "Resolve before shipping further.",
    countOrders: "{count} orders",
    boardTitle: "Warehouse dispatch board",
    boardSubtitle:
      "Search, scan, batch, and apply warehouse-safe status updates from one place.",
    liveView: "Live view",
    searchMode: "Search mode",
    limitedView: "Operational scope",
    syncedAt: "Synced {time}",
    notSynced: "Not synced yet",
    page: "Page {page}",
    loaded: "Loaded {count}",
    noOrders: "No orders in this slice.",
    unnumbered: "Unnumbered order",
    settings: "Settings",
    manifestTitle: "Driver manifest",
    manifestHint: "Reprint the current assigned queue for a warehouse driver as a paper fallback.",
    manifestDriver: "Driver",
    manifestChooseDriver: "Choose driver",
    manifestNoDrivers: "No drivers are attached to this warehouse yet.",
    manifestPrint: "Print manifest",
    manifestPrinting: "Preparing...",
    manifestEmpty: "This driver has no active assigned orders.",
    manifestFailed: "Failed to print driver manifest.",
  },
  ru: {
    badge: "\u0421\u043a\u043b\u0430\u0434\u0441\u043a\u0430\u044f \u0437\u043e\u043d\u0430",
    title: "\u0421\u043a\u043b\u0430\u0434\u0441\u043a\u0438\u0435 \u043e\u043f\u0435\u0440\u0430\u0446\u0438\u0438",
    subtitle:
      "\u041f\u0440\u0438\u043d\u0438\u043c\u0430\u0439\u0442\u0435 \u0432\u0445\u043e\u0434\u044f\u0449\u0438\u0439 \u0433\u0440\u0443\u0437, \u043a\u043e\u043d\u0442\u0440\u043e\u043b\u0438\u0440\u0443\u0439\u0442\u0435 \u043e\u0447\u0435\u0440\u0435\u0434\u0438 \u043d\u0430 \u043f\u043e\u043b\u0443, \u0441\u043a\u0430\u043d\u0438\u0440\u0443\u0439\u0442\u0435 \u043f\u0430\u043a\u0435\u0442\u044b \u0438 \u0437\u0430\u043f\u0443\u0441\u043a\u0430\u0439\u0442\u0435 \u0438\u0441\u0445\u043e\u0434\u044f\u0449\u0435\u0435 \u0434\u0432\u0438\u0436\u0435\u043d\u0438\u0435 \u0438\u0437 \u043e\u0434\u043d\u043e\u0439 \u043e\u043f\u0435\u0440\u0430\u0446\u0438\u043e\u043d\u043d\u043e\u0439 \u0434\u043e\u0441\u043a\u0438.",
    attachedWarehouse: "\u041f\u0440\u0438\u0432\u044f\u0437\u0430\u043d\u043d\u044b\u0439 \u0441\u043a\u043b\u0430\u0434",
    unlinkedWarehouse: "\u0421\u043a\u043b\u0430\u0434 \u043d\u0435 \u043f\u0440\u0438\u0432\u044f\u0437\u0430\u043d",
    floorControl: "\u041a\u043e\u043d\u0442\u0440\u043e\u043b\u044c \u043f\u043e\u043b\u0430",
    floorControlHint:
      "\u0421\u043a\u0430\u043d\u0438\u0440\u0443\u0439\u0442\u0435 ID \u0437\u0430\u043a\u0430\u0437\u0430, \u043d\u043e\u043c\u0435\u0440 \u0437\u0430\u043a\u0430\u0437\u0430 \u0438\u043b\u0438 \u0448\u0442\u0440\u0438\u0445\u043a\u043e\u0434 \u043c\u0435\u0441\u0442\u0430 \u043f\u0440\u044f\u043c\u043e \u0432 batch cart \u043d\u0430 \u0434\u043e\u0441\u043a\u0435. \u041f\u0440\u0435\u0434\u0443\u043f\u0440\u0435\u0436\u0434\u0435\u043d\u0438\u044f \u043f\u043e multi-piece \u043e\u0441\u0442\u0430\u044e\u0442\u0441\u044f \u0442\u0430\u043c \u0436\u0435.",
    searchPlaceholder:
      "\u041f\u043e\u0438\u0441\u043a \u043f\u043e \u043d\u043e\u043c\u0435\u0440\u0443 \u0437\u0430\u043a\u0430\u0437\u0430, \u043a\u043e\u0434\u0443 \u043c\u0435\u0441\u0442\u0430, \u043a\u043b\u0438\u0435\u043d\u0442\u0443 \u0438\u043b\u0438 \u0430\u0434\u0440\u0435\u0441\u0443...",
    quickScan: "\u0411\u044b\u0441\u0442\u0440\u044b\u0439 \u0441\u043a\u0430\u043d",
    quickScanHint:
      "\u041a\u0443\u0440\u0441\u043e\u0440 \u043e\u0441\u0442\u0430\u0435\u0442\u0441\u044f \u0437\u0434\u0435\u0441\u044c. \u041d\u0430\u0436\u043c\u0438\u0442\u0435 Enter, \u0447\u0442\u043e\u0431\u044b \u0441\u0440\u0430\u0437\u0443 \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0432 warehouse batch.",
    quickScanPlaceholder:
      "\u0421\u043a\u0430\u043d ID \u0437\u0430\u043a\u0430\u0437\u0430 / \u043d\u043e\u043c\u0435\u0440 \u0437\u0430\u043a\u0430\u0437\u0430 / \u043a\u043e\u0434 \u043c\u0435\u0441\u0442\u0430...",
    sendToBatch: "\u0412 batch",
    lastScan: "\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439 \u0441\u043a\u0430\u043d",
    lastScanAdded: "\u0414\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u043e \u0432 batch",
    lastScanInvalid: "\u041d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e",
    lastScanLimit: "{count} \u043f\u0440\u043e\u043f\u0443\u0449\u0435\u043d\u043e \u0438\u0437-\u0437\u0430 \u043b\u0438\u043c\u0438\u0442\u0430 batch",
    lastScanEmpty: "\u042d\u0442\u043e\u0442 \u0441\u043a\u0430\u043d \u043d\u0435 \u0434\u043e\u0431\u0430\u0432\u0438\u043b \u043d\u043e\u0432\u044b\u0445 \u0437\u0430\u043a\u0430\u0437\u043e\u0432.",
    scanReady: "\u0413\u043e\u0442\u043e\u0432\u043e \u043a \u0441\u043a\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044e",
    scanReadyHint:
      "\u041e\u0434\u043d\u0430 \u0434\u043e\u0441\u043a\u0430 \u0434\u043b\u044f \u043f\u0440\u0438\u0435\u043c\u043a\u0438, \u0441\u043e\u0440\u0442\u0438\u0440\u043e\u0432\u043a\u0438 \u0438 \u0438\u0441\u0445\u043e\u0434\u044f\u0449\u0435\u0439 \u043e\u0442\u0433\u0440\u0443\u0437\u043a\u0438.",
    refresh: "\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c",
    queueHealth: "\u0421\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u0435 \u043e\u0447\u0435\u0440\u0435\u0434\u0438",
    queueHealthHint:
      "\u0424\u0438\u0437\u0438\u0447\u0435\u0441\u043a\u0438\u0439 \u043f\u043e\u0442\u043e\u043a \u0441\u043a\u043b\u0430\u0434\u0430, \u0430 \u043d\u0435 \u0442\u043e\u043b\u044c\u043a\u043e \u0441\u044b\u0440\u044b\u0435 \u0441\u0442\u0430\u0442\u0443\u0441\u044b.",
    quickFilters: "\u0411\u044b\u0441\u0442\u0440\u044b\u0435 \u0444\u0438\u043b\u044c\u0442\u0440\u044b",
    quickFiltersHint:
      "\u0421\u0443\u0436\u0430\u0439\u0442\u0435 \u0442\u0435\u043a\u0443\u0449\u0438\u0439 loaded queue \u0434\u043e \u0442\u043e\u0439 warehouse-lane, \u0441 \u043a\u043e\u0442\u043e\u0440\u043e\u0439 \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442\u0435 \u0441\u0435\u0439\u0447\u0430\u0441.",
    filterAll: "\u0412\u0441\u0435",
    filterNeedsIntake: "\u041e\u0436\u0438\u0434\u0430\u044e\u0442 \u043f\u0440\u0438\u0435\u043c\u043a\u0438",
    filterOnFloor: "\u041d\u0430 \u043f\u043e\u043b\u0443",
    filterOutbound: "\u0418\u0441\u0445\u043e\u0434",
    filterExceptions: "\u0418\u0441\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u044f",
    intakeQueue: "\u041e\u0436\u0438\u0434\u0430\u044e\u0442 \u043f\u0440\u0438\u0435\u043c\u043a\u0438",
    intakeQueueHint:
      "\u0417\u0430\u0431\u0440\u0430\u043d\u044b \u0443 \u043a\u043b\u0438\u0435\u043d\u0442\u0430 \u0438 \u0436\u0434\u0443\u0442 \u043f\u0440\u0438\u0435\u043c\u043a\u0438 \u043d\u0430 \u0441\u043a\u043b\u0430\u0434\u0435",
    onFloor: "\u041d\u0430 \u043f\u043e\u043b\u0443",
    onFloorHint:
      "\u0423\u0436\u0435 \u043f\u0440\u0438\u043d\u044f\u0442\u044b \u0438 \u0441\u043e\u0440\u0442\u0438\u0440\u0443\u044e\u0442\u0441\u044f",
    outboundWave: "\u0418\u0441\u0445\u043e\u0434\u044f\u0449\u0430\u044f \u0432\u043e\u043b\u043d\u0430",
    outboundWaveHint:
      "\u0413\u043e\u0442\u043e\u0432\u044b \u043a \u0442\u0440\u0430\u043d\u0437\u0438\u0442\u0443 \u0438\u043b\u0438 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0435\u0439 \u043c\u0438\u043b\u0435",
    exceptions: "\u0418\u0441\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u044f",
    exceptionsHint:
      "\u041f\u0440\u043e\u0431\u043b\u0435\u043c\u0430 \u0438\u043b\u0438 return flow \u0442\u0440\u0435\u0431\u0443\u0435\u0442 \u0440\u0443\u0447\u043d\u043e\u0433\u043e \u0432\u043c\u0435\u0448\u0430\u0442\u0435\u043b\u044c\u0441\u0442\u0432\u0430",
    incomplete: "\u041d\u0435\u043f\u043e\u043b\u043d\u044b\u0439 multi-piece",
    incompleteHint:
      "\u041e\u0442\u043f\u0440\u0430\u0432\u043a\u0438 \u0441 \u043d\u0435\u0445\u0432\u0430\u0442\u0430\u044e\u0449\u0438\u043c\u0438 \u043c\u0435\u0441\u0442\u0430\u043c\u0438 \u043d\u0435 \u0434\u043e\u043b\u0436\u043d\u044b \u0443\u0445\u043e\u0434\u0438\u0442\u044c \u0441 \u043f\u043e\u043b\u0430 \u0431\u0435\u0437 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0438.",
    incompleteEmpty:
      "\u0412 \u0442\u0435\u043a\u0443\u0449\u0435\u043c \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u043d\u043e\u043c \u043e\u0431\u044a\u0435\u043c\u0435 \u043d\u0435\u0442 \u043d\u0435\u043f\u043e\u043b\u043d\u044b\u0445 multi-piece \u043e\u0442\u043f\u0440\u0430\u0432\u043e\u043a.",
    inboundLane: "\u041f\u0440\u0438\u0435\u043c\u043a\u0430",
    inboundLaneHint:
      "\u041f\u0435\u0440\u0432\u043e\u0435 \u043a\u0430\u0441\u0430\u043d\u0438\u0435 \u0441\u043a\u043b\u0430\u0434\u0430 \u043f\u043e\u0441\u043b\u0435 pickup.",
    sortLane: "\u0421\u043e\u0440\u0442\u0438\u0440\u043e\u0432\u043e\u0447\u043d\u044b\u0439 \u043f\u043e\u043b",
    sortLaneHint:
      "\u041e\u0442\u043f\u0440\u0430\u0432\u043a\u0438, \u0444\u0438\u0437\u0438\u0447\u0435\u0441\u043a\u0438 \u043d\u0430\u0445\u043e\u0434\u044f\u0449\u0438\u0435\u0441\u044f \u0432 \u0441\u043a\u043b\u0430\u0434\u0435.",
    outboundLane: "\u0418\u0441\u0445\u043e\u0434\u044f\u0449\u0430\u044f \u043f\u0435\u0440\u0435\u0434\u0430\u0447\u0430",
    outboundLaneHint:
      "\u041f\u043e\u0434\u0433\u043e\u0442\u043e\u0432\u043b\u0435\u043d\u044b \u043a linehaul \u0438\u043b\u0438 \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0435\u0439 \u043c\u0438\u043b\u0435.",
    issueLane: "\u0417\u043e\u043d\u0430 \u0432\u043d\u0438\u043c\u0430\u043d\u0438\u044f",
    issueLaneHint:
      "\u0420\u0435\u0448\u0438\u0442\u0435 \u0434\u043e \u0434\u0430\u043b\u044c\u043d\u0435\u0439\u0448\u0435\u0439 \u043e\u0442\u043f\u0440\u0430\u0432\u043a\u0438.",
    countOrders: "{count} \u0437\u0430\u043a\u0430\u0437\u043e\u0432",
    boardTitle: "\u0421\u043a\u043b\u0430\u0434\u0441\u043a\u0430\u044f \u0434\u043e\u0441\u043a\u0430",
    boardSubtitle:
      "\u0418\u0449\u0438\u0442\u0435, \u0441\u043a\u0430\u043d\u0438\u0440\u0443\u0439\u0442\u0435, \u0441\u043e\u0431\u0438\u0440\u0430\u0439\u0442\u0435 batch \u0438 \u043f\u0440\u0438\u043c\u0435\u043d\u044f\u0439\u0442\u0435 warehouse-safe \u0441\u0442\u0430\u0442\u0443\u0441\u044b \u0438\u0437 \u043e\u0434\u043d\u043e\u0433\u043e \u043c\u0435\u0441\u0442\u0430.",
    liveView: "\u0416\u0438\u0432\u043e\u0439 \u0432\u0438\u0434",
    searchMode: "\u0420\u0435\u0436\u0438\u043c \u043f\u043e\u0438\u0441\u043a\u0430",
    limitedView: "\u041e\u043f\u0435\u0440\u0430\u0446\u0438\u043e\u043d\u043d\u044b\u0439 \u0441\u0440\u0435\u0437",
    syncedAt: "\u0421\u0438\u043d\u0445\u0440\u043e\u043d\u0438\u0437\u0438\u0440\u043e\u0432\u0430\u043d\u043e {time}",
    notSynced: "\u0415\u0449\u0435 \u043d\u0435 \u0441\u0438\u043d\u0445\u0440\u043e\u043d\u0438\u0437\u0438\u0440\u043e\u0432\u0430\u043d\u043e",
    page: "\u0421\u0442\u0440\u0430\u043d\u0438\u0446\u0430 {page}",
    loaded: "\u0417\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u043e {count}",
    noOrders: "\u0412 \u044d\u0442\u043e\u043c \u0441\u0440\u0435\u0437\u0435 \u043d\u0435\u0442 \u0437\u0430\u043a\u0430\u0437\u043e\u0432.",
    unnumbered: "\u0417\u0430\u043a\u0430\u0437 \u0431\u0435\u0437 \u043d\u043e\u043c\u0435\u0440\u0430",
    settings: "\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438",
    manifestTitle: "\u041c\u0430\u043d\u0438\u0444\u0435\u0441\u0442 \u0432\u043e\u0434\u0438\u0442\u0435\u043b\u044f",
    manifestHint:
      "\u041f\u0435\u0440\u0435\u043f\u0435\u0447\u0430\u0442\u0430\u0439\u0442\u0435 \u0442\u0435\u043a\u0443\u0449\u0443\u044e \u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u043d\u0443\u044e \u043e\u0447\u0435\u0440\u0435\u0434\u044c \u043a\u0443\u0440\u044c\u0435\u0440\u0430 \u043a\u0430\u043a \u0431\u0443\u043c\u0430\u0436\u043d\u044b\u0439 \u0440\u0435\u0437\u0435\u0440\u0432.",
    manifestDriver: "\u0412\u043e\u0434\u0438\u0442\u0435\u043b\u044c",
    manifestChooseDriver: "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0432\u043e\u0434\u0438\u0442\u0435\u043b\u044f",
    manifestNoDrivers: "\u041a \u044d\u0442\u043e\u043c\u0443 \u0441\u043a\u043b\u0430\u0434\u0443 \u0435\u0449\u0435 \u043d\u0435 \u043f\u0440\u0438\u0432\u044f\u0437\u0430\u043d\u044b \u0432\u043e\u0434\u0438\u0442\u0435\u043b\u0438.",
    manifestPrint: "\u041f\u0435\u0447\u0430\u0442\u044c \u043c\u0430\u043d\u0438\u0444\u0435\u0441\u0442\u0430",
    manifestPrinting: "\u041f\u043e\u0434\u0433\u043e\u0442\u043e\u0432\u043a\u0430...",
    manifestEmpty: "\u0423 \u044d\u0442\u043e\u0433\u043e \u0432\u043e\u0434\u0438\u0442\u0435\u043b\u044f \u043d\u0435\u0442 \u0430\u043a\u0442\u0438\u0432\u043d\u044b\u0445 \u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u043d\u044b\u0445 \u0437\u0430\u043a\u0430\u0437\u043e\u0432.",
    manifestFailed: "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0440\u0430\u0441\u043f\u0435\u0447\u0430\u0442\u0430\u0442\u044c \u043c\u0430\u043d\u0438\u0444\u0435\u0441\u0442 \u0432\u043e\u0434\u0438\u0442\u0435\u043b\u044f.",
  },
  uz: {
    badge: "Ombor maydoni",
    title: "Ombor operatsiyalari",
    subtitle:
      "Kiruvchi freight ni qabul qiling, floor navbatlarini boshqaring, batchlarni skan qiling va chiqish oqimini bitta operatsion doskadan yuriting.",
    attachedWarehouse: "Biriktirilgan ombor",
    unlinkedWarehouse: "Ombor biriktirilmagan",
    floorControl: "Floor control",
    floorControlHint:
      "Order ID, order number yoki parcel barcode ni board ichidagi batch cart ga skan qiling. Multi-piece warning shu yerning o'zida ishlaydi.",
    searchPlaceholder:
      "Order raqami, parcel code, mijoz yoki manzil bo'yicha qidirish...",
    quickScan: "Tez skan dock",
    quickScanHint:
      "Kursor shu yerda qoladi. Enter bosib kodni to'g'ridan-to'g'ri warehouse batch ga yuboring.",
    quickScanPlaceholder: "Order ID / order number / parcel code ni skan qiling...",
    sendToBatch: "Batchga yuborish",
    lastScan: "Oxirgi skan",
    lastScanAdded: "Batchga qo'shildi",
    lastScanInvalid: "Topilmadi",
    lastScanLimit: "{count} tasi batch limit sabab o'tkazib yuborildi",
    lastScanEmpty: "Bu skandan yangi buyurtma qo'shilmadi.",
    scanReady: "Skan uchun tayyor",
    scanReadyHint: "Qabul qilish, saralash va outbound dispatch uchun bitta board.",
    refresh: "Yangilash",
    queueHealth: "Navbat holati",
    queueHealthHint: "Faqat status emas, fizik ombor oqimi.",
    quickFilters: "Tez filterlar",
    quickFiltersHint:
      "Hozir ishlayotgan warehouse lane bo'yicha joriy loaded queue ni toraytiring.",
    filterAll: "Hammasi",
    filterNeedsIntake: "Qabul kutmoqda",
    filterOnFloor: "Pol ustida",
    filterOutbound: "Chiqish",
    filterExceptions: "Istisnolar",
    intakeQueue: "Qabul kutmoqda",
    intakeQueueHint: "Pickup qilingan va ombor qabulini kutmoqda",
    onFloor: "Pol ustida",
    onFloorHint: "Qabul qilingan va saralanmoqda",
    outboundWave: "Chiqish to'lqini",
    outboundWaveHint: "Tranzit yoki last-mile uchun tayyor",
    exceptions: "Istisnolar",
    exceptionsHint: "Muammo yoki return flow qo'lda ko'rib chiqilishi kerak",
    incomplete: "To'liq bo'lmagan multi-piece",
    incompleteHint:
      "Yetishmayotgan piece lari bor shipment lar tekshiruvsiz floor dan chiqmasligi kerak.",
    incompleteEmpty:
      "Hozirgi yuklangan scope ichida to'liq bo'lmagan multi-piece shipment yo'q.",
    inboundLane: "Kiruvchi qabul",
    inboundLaneHint: "Pickup dan keyingi birinchi ombor tegishi.",
    sortLane: "Saralash maydoni",
    sortLaneHint: "Fizik jihatdan ombor ichidagi shipmentlar.",
    outboundLane: "Chiqish handoff",
    outboundLaneHint: "Linehaul yoki last-mile uchun tayyorlangan.",
    issueLane: "Muammo zonasi",
    issueLaneHint: "Keyingi harakatdan oldin hal qiling.",
    countOrders: "{count} ta buyurtma",
    boardTitle: "Ombor dispatch boardi",
    boardSubtitle:
      "Qidiring, skan qiling, batch yarating va warehouse-safe status update laringizni bitta joydan bajaring.",
    liveView: "Jonli ko'rinish",
    searchMode: "Qidiruv rejimi",
    limitedView: "Operatsion scope",
    syncedAt: "{time} da sinxronlangan",
    notSynced: "Hali sinxronlanmagan",
    page: "{page}-sahifa",
    loaded: "{count} ta yuklangan",
    noOrders: "Bu slice ichida buyurtma yo'q.",
    unnumbered: "Raqamsiz buyurtma",
    settings: "Sozlamalar",
    manifestTitle: "Haydovchi manifesti",
    manifestHint:
      "Ombor haydovchisi uchun joriy biriktirilgan navbatni qog'oz zaxira sifatida qayta chop eting.",
    manifestDriver: "Haydovchi",
    manifestChooseDriver: "Haydovchini tanlang",
    manifestNoDrivers: "Bu omborga hali haydovchilar biriktirilmagan.",
    manifestPrint: "Manifestni chop etish",
    manifestPrinting: "Tayyorlanmoqda...",
    manifestEmpty: "Bu haydovchida faol biriktirilgan buyurtmalar yo'q.",
    manifestFailed: "Haydovchi manifestini chop etib bo'lmadi.",
  },
} as const;

function useDebouncedValue<T>(value: T, delay = 450) {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function formatText(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
}

function statusVariant(status?: string | null): StatusTone {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized === "delivered") return "default";
  if (
    normalized === "exception" ||
    normalized === "return_in_progress" ||
    normalized === "returned" ||
    normalized === "cancelled"
  ) {
    return "destructive";
  }
  if (normalized === "at_warehouse" || normalized === "in_transit") return "secondary";
  return "outline";
}

function orderRef(order: OrderItem, fallback: string) {
  return order.orderNumber ? `#${order.orderNumber}` : fallback;
}

function sameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function StatTile({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string;
  value: number;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="rounded-3xl border-border/70">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {title}
            </p>
            <p className="mt-3 text-3xl font-semibold">{value}</p>
            <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/25 p-2.5">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function WarehouseDashboardPage() {
  const { locale, t } = useI18n();
  const text = copy[locale];
  const user = useMemo(() => getUser(), []);
  const userSettings = useMemo(() => loadUserSettings(), []);
  const [q, setQ] = useState("");
  const [activeQuickFilter, setActiveQuickFilter] = useState<QuickFilterKey>("all");
  const [quickScanValue, setQuickScanValue] = useState("");
  const [manifestDriverId, setManifestDriverId] = useState("");
  const [externalScanRequest, setExternalScanRequest] = useState<{
    id: number;
    raw: string;
  } | null>(null);
  const [lastScanFeedback, setLastScanFeedback] = useState<LastScanFeedback | null>(null);
  const debouncedQ = useDebouncedValue(q);
  const isSearchMode = debouncedQ.trim().length > 0;
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const [baseCursorStack, setBaseCursorStack] = useState<Array<string | null>>([null]);
  const [baseCursorIndex, setBaseCursorIndex] = useState(0);
  const [searchCursorStack, setSearchCursorStack] = useState<Array<string | null>>([
    null,
  ]);
  const [searchCursorIndex, setSearchCursorIndex] = useState(0);

  React.useEffect(() => {
    setSearchCursorStack([null]);
    setSearchCursorIndex(0);
  }, [debouncedQ]);

  const warehousesQuery = useQuery({
    queryKey: ["warehouses", "warehouse-dashboard"],
    queryFn: fetchWarehouses,
    enabled: Boolean(user?.warehouseId),
    staleTime: 60_000,
  });

  const driversQuery = useQuery<DriverLite[]>({
    queryKey: ["warehouse-drivers-manifest"],
    queryFn: fetchDrivers,
    enabled: Boolean(user?.warehouseId),
    staleTime: 60_000,
  });

  const baseQuery = useQuery<OrdersResponse>({
    queryKey: ["warehouse-orders", "base", baseCursorStack[baseCursorIndex] ?? null],
    queryFn: () =>
      fetchOrders({
        limit: 120,
        mode: "cursor",
        cursor: baseCursorStack[baseCursorIndex] ?? undefined,
      }),
    enabled: !isSearchMode,
    placeholderData: (prev) => prev,
  });

  const searchQuery = useQuery<OrdersResponse>({
    queryKey: [
      "warehouse-orders",
      "search",
      debouncedQ,
      searchCursorStack[searchCursorIndex] ?? null,
    ],
    queryFn: () =>
      fetchOrders({
        q: debouncedQ,
        limit: 50,
        mode: "cursor",
        cursor: searchCursorStack[searchCursorIndex] ?? undefined,
      }),
    enabled: isSearchMode,
    placeholderData: (prev) => prev,
  });

  React.useEffect(() => {
    const nextCursor = baseQuery.data?.nextCursor;
    if (!baseQuery.data?.hasMore || !nextCursor) return;
    setBaseCursorStack((prev) => {
      const nextIndex = baseCursorIndex + 1;
      if (prev[nextIndex] === nextCursor) return prev;
      const next = prev.slice(0, nextIndex);
      next[nextIndex] = nextCursor;
      return next;
    });
  }, [baseCursorIndex, baseQuery.data?.hasMore, baseQuery.data?.nextCursor]);

  React.useEffect(() => {
    const nextCursor = searchQuery.data?.nextCursor;
    if (!searchQuery.data?.hasMore || !nextCursor) return;
    setSearchCursorStack((prev) => {
      const nextIndex = searchCursorIndex + 1;
      if (prev[nextIndex] === nextCursor) return prev;
      const next = prev.slice(0, nextIndex);
      next[nextIndex] = nextCursor;
      return next;
    });
  }, [searchCursorIndex, searchQuery.data?.hasMore, searchQuery.data?.nextCursor]);

  const activeQuery = isSearchMode ? searchQuery : baseQuery;

  React.useEffect(() => {
    if (activeQuery.dataUpdatedAt) {
      setLastSyncedAt(new Date(activeQuery.dataUpdatedAt));
    }
  }, [activeQuery.dataUpdatedAt]);

  const orders = useMemo<OrderItem[]>(() => {
    const rawOrders = activeQuery.data?.orders ?? [];

    return rawOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status:
        typeof order.status === "string" && order.status.trim().length > 0
          ? order.status
          : "pending",
      pickupAddress: order.pickupAddress,
      dropoffAddress: order.dropoffAddress,
      createdAt: order.createdAt,
      customer: order.customer,
      parcels:
        order.parcels?.map((parcel) => ({
          id: parcel.id ?? null,
          parcelCode: parcel.parcelCode ?? null,
          pieceNo: parcel.pieceNo ?? null,
          pieceTotal: parcel.pieceTotal ?? null,
        })) ?? null,
    }));
  }, [activeQuery.data]);
  const page = isSearchMode ? searchCursorIndex + 1 : baseCursorIndex + 1;
  const canPrev = page > 1;
  const canNext = Boolean(activeQuery.data?.hasMore);
  const isLoading = activeQuery.isLoading;
  const isFetching = activeQuery.isFetching;

  const handleRefresh = async () => {
    await activeQuery.refetch();
  };

  const submitQuickScan = () => {
    const raw = quickScanValue.trim();
    if (!raw) return;
    if (userSettings.playScanSound) {
      void primeScanSound();
    }
    setExternalScanRequest({
      id: Date.now(),
      raw,
    });
    setQuickScanValue("");
  };

  const handleExternalScanProcessed = React.useCallback(
    (result: {
      requestId: number | null;
      raw: string;
      addedOrderIds: string[];
      invalidTokens: string[];
      skippedByLimit: number;
    }) => {
      const orderMap = new Map(orders.map((order) => [order.id, order]));
      setLastScanFeedback({
        requestId: result.requestId ?? Date.now(),
        raw: result.raw,
        addedOrders: result.addedOrderIds
          .map((id) => orderMap.get(id))
          .filter(Boolean) as OrderItem[],
        invalidTokens: result.invalidTokens,
        skippedByLimit: result.skippedByLimit,
      });
    },
    [orders],
  );

  React.useEffect(() => {
    if (!lastScanFeedback || !userSettings.playScanSound) return;

    const hasSuccess = lastScanFeedback.addedOrders.length > 0;
    void playScanSound(hasSuccess ? "success" : "error");
  }, [lastScanFeedback, userSettings.playScanSound]);

  const goPrev = () => {
    if (!canPrev) return;
    if (isSearchMode) {
      setSearchCursorIndex((current) => Math.max(0, current - 1));
      return;
    }
    setBaseCursorIndex((current) => Math.max(0, current - 1));
  };

  const goNext = () => {
    if (!canNext) return;
    if (isSearchMode) {
      const nextCursor = searchQuery.data?.nextCursor;
      if (!nextCursor) return;
      setSearchCursorStack((prev) => {
        const nextIndex = searchCursorIndex + 1;
        const next = prev.slice(0, nextIndex);
        next[nextIndex] = nextCursor;
        return next;
      });
      setSearchCursorIndex((current) => current + 1);
      return;
    }

    const nextCursor = baseQuery.data?.nextCursor;
    if (!nextCursor) return;
    setBaseCursorStack((prev) => {
      const nextIndex = baseCursorIndex + 1;
      const next = prev.slice(0, nextIndex);
      next[nextIndex] = nextCursor;
      return next;
    });
    setBaseCursorIndex((current) => current + 1);
  };

  const warehouseName = useMemo(() => {
    const attached = user?.warehouseId;
    if (!attached) return text.unlinkedWarehouse;
    const match = warehousesQuery.data?.find((warehouse) => warehouse.id === attached);
    return match?.name ?? attached;
  }, [text.unlinkedWarehouse, user?.warehouseId, warehousesQuery.data]);

  const manifestDrivers = useMemo(() => driversQuery.data ?? [], [driversQuery.data]);
  const selectedManifestDriver = useMemo(
    () => manifestDrivers.find((driver) => driver.id === manifestDriverId) ?? null,
    [manifestDriverId, manifestDrivers],
  );
  const manifestLabels =
    driverManifestCopy[locale as keyof typeof driverManifestCopy] ?? driverManifestCopy.en;

  const manifestMutation = useMutation({
    mutationFn: async () => {
      if (!selectedManifestDriver) throw new Error("NO_DRIVER_SELECTED");
      return printDriverManifest({
        driverId: selectedManifestDriver.id,
        driverName: selectedManifestDriver.name,
        driverEmail: selectedManifestDriver.email,
        warehouseName,
        locale,
        labels: manifestLabels,
        t,
      });
    },
    onError: (error: unknown) => {
      if (error instanceof Error && error.message === EMPTY_DRIVER_MANIFEST_ERROR) {
        toast(text.manifestEmpty);
        return;
      }
      if (error instanceof Error && error.message === POPUP_BLOCKED_DRIVER_MANIFEST_ERROR) {
        toast.error(manifestLabels.popupBlocked);
        return;
      }
      if (error instanceof Error && error.message === "NO_DRIVER_SELECTED") return;
      toast.error(text.manifestFailed);
    },
  });

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const order of orders) {
      const status = String(order.status ?? "unknown").toLowerCase();
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }
    return counts;
  }, [orders]);

  const needsIntake = statusCounts.get("picked_up") ?? 0;
  const onFloor = statusCounts.get("at_warehouse") ?? 0;
  const outboundWave =
    (statusCounts.get("in_transit") ?? 0) + (statusCounts.get("out_for_delivery") ?? 0);
  const exceptions =
    (statusCounts.get("exception") ?? 0) + (statusCounts.get("return_in_progress") ?? 0);

  const deliveredToday = useMemo(() => {
    const today = new Date();
    return orders.filter((order) => {
      if (String(order.status ?? "").toLowerCase() !== "delivered") return false;
      if (!order.createdAt) return false;
      const createdAt = new Date(order.createdAt);
      if (Number.isNaN(createdAt.getTime())) return false;
      return sameLocalDay(createdAt, today);
    }).length;
  }, [orders]);

  const incompleteMultiPiece = useMemo(() => {
    return orders.filter((order) => {
      const parcels = order.parcels ?? [];
      const pieceTotal = Math.max(1, parcels[0]?.pieceTotal ?? 0, parcels.length);
      const knownCodes = parcels.filter((parcel) => parcel.parcelCode).length;
      return pieceTotal > 1 && knownCodes > 0 && knownCodes < pieceTotal;
    });
  }, [orders]);

  const laneCards = [
    {
      title: text.inboundLane,
      hint: text.inboundLaneHint,
      count: needsIntake,
      statuses: ["picked_up"],
      icon: ScanLine,
    },
    {
      title: text.sortLane,
      hint: text.sortLaneHint,
      count: onFloor,
      statuses: ["at_warehouse"],
      icon: Warehouse,
    },
    {
      title: text.outboundLane,
      hint: text.outboundLaneHint,
      count: outboundWave,
      statuses: ["in_transit", "out_for_delivery"],
      icon: ArrowRightLeft,
    },
    {
      title: text.issueLane,
      hint: text.issueLaneHint,
      count: exceptions,
      statuses: ["exception", "return_in_progress"],
      icon: AlertTriangle,
    },
  ] as const;

  const quickFilterMeta: Array<{
    key: QuickFilterKey;
    label: string;
    count: number;
  }> = [
    { key: "all", label: text.filterAll, count: orders.length },
    { key: "needs_intake", label: text.filterNeedsIntake, count: needsIntake },
    { key: "on_floor", label: text.filterOnFloor, count: onFloor },
    { key: "outbound", label: text.filterOutbound, count: outboundWave },
    { key: "exceptions", label: text.filterExceptions, count: exceptions },
  ];

  const filteredOrders = useMemo(() => {
    switch (activeQuickFilter) {
      case "needs_intake":
        return orders.filter((order) => order.status === "picked_up");
      case "on_floor":
        return orders.filter((order) => order.status === "at_warehouse");
      case "outbound":
        return orders.filter(
          (order) =>
            order.status === "in_transit" || order.status === "out_for_delivery",
        );
      case "exceptions":
        return orders.filter(
          (order) =>
            order.status === "exception" || order.status === "return_in_progress",
        );
      default:
        return orders;
    }
  }, [activeQuickFilter, orders]);

  return (
    <PageShell>
      <div className="space-y-6">
        <Card className="relative overflow-hidden rounded-[2rem] border border-border/60 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(8,47,73,0.96),rgba(236,253,245,0.98))] text-white">
          <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl" />
          <div className="absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl" />
          <CardContent className="relative grid gap-6 p-6 lg:grid-cols-[minmax(0,1.25fr)_380px] lg:p-8">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/90">
                <Warehouse className="h-3.5 w-3.5" />
                {text.badge}
              </div>

              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight">{text.title}</h1>
                <p className="max-w-3xl text-sm text-slate-100/85">{text.subtitle}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/70">
                    {text.intakeQueue}
                  </p>
                  <p className="mt-3 text-3xl font-semibold">{needsIntake}</p>
                  <p className="mt-2 text-xs text-white/70">{text.intakeQueueHint}</p>
                </div>
                <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/70">
                    {text.onFloor}
                  </p>
                  <p className="mt-3 text-3xl font-semibold">{onFloor}</p>
                  <p className="mt-2 text-xs text-white/70">{text.onFloorHint}</p>
                </div>
                <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/70">
                    {text.outboundWave}
                  </p>
                  <p className="mt-3 text-3xl font-semibold">{outboundWave}</p>
                  <p className="mt-2 text-xs text-white/70">{text.outboundWaveHint}</p>
                </div>
                <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/70">
                    {text.exceptions}
                  </p>
                  <p className="mt-3 text-3xl font-semibold">{exceptions}</p>
                  <p className="mt-2 text-xs text-white/70">{text.exceptionsHint}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-white/70">
                      {text.attachedWarehouse}
                    </p>
                    <p className="mt-2 text-xl font-semibold">{warehouseName}</p>
                  </div>
                  <Badge className="rounded-full border-white/15 bg-white/10 text-white hover:bg-white/10">
                    {user?.warehouseId ? text.liveView : text.unlinkedWarehouse}
                  </Badge>
                </div>
              </div>

              <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl border border-white/15 bg-white/10 p-2.5">
                    <ScanLine className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{text.floorControl}</p>
                    <p className="mt-2 text-sm text-slate-100/80">{text.floorControlHint}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/70">
                    {text.scanReady}
                  </p>
                  <p className="mt-2 text-sm text-slate-100/80">{text.scanReadyHint}</p>
                </div>
                <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/70">
                    {text.queueHealth}
                  </p>
                  <p className="mt-2 text-sm text-slate-100/80">{text.queueHealthHint}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">{text.boardTitle}</h2>
            <p className="text-sm text-muted-foreground">{text.boardSubtitle}</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-[420px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder={text.searchPlaceholder}
                className="pl-9"
              />
            </div>
            <Button variant="outline" className="gap-2" onClick={handleRefresh} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              {text.refresh}
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link href="/dashboard/warehouse/settings">{text.settings}</Link>
            </Button>
          </div>
        </div>

        <Card className="rounded-3xl border-border/70">
          <CardContent className="p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="rounded-2xl border border-border/70 bg-muted/25 p-2">
                    <ScanLine className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{text.quickScan}</p>
                    <p className="text-xs text-muted-foreground">{text.quickScanHint}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={quickScanValue}
                    onChange={(event) => setQuickScanValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        submitQuickScan();
                      }
                    }}
                    placeholder={text.quickScanPlaceholder}
                    autoFocus
                  />
                  <Button className="gap-2" onClick={submitQuickScan} disabled={!quickScanValue.trim()}>
                    <ScanLine className="h-4 w-4" />
                    {text.sendToBatch}
                  </Button>
                </div>
              </div>

              <div className="rounded-3xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                {text.floorControlHint}
              </div>
            </div>

            {lastScanFeedback ? (
              <div className="mt-4 rounded-3xl border border-emerald-300/40 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-emerald-500/10 p-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{text.lastScan}</span>
                      <Badge variant="outline" className="rounded-full bg-white/70">
                        {lastScanFeedback.raw}
                      </Badge>
                    </div>

                    {lastScanFeedback.addedOrders.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs uppercase tracking-[0.18em] text-emerald-800/80">
                          {text.lastScanAdded}
                        </span>
                        {lastScanFeedback.addedOrders.map((order) => (
                          <Badge
                            key={`${lastScanFeedback.requestId}-${order.id}`}
                            variant={statusVariant(order.status)}
                            className="rounded-full bg-white/80"
                          >
                            {orderRef(order, text.unnumbered)} | {getStatusLabel(order.status, t)}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm">{text.lastScanEmpty}</p>
                    )}

                    {lastScanFeedback.invalidTokens.length > 0 ? (
                      <div className="text-xs text-amber-700">
                        {text.lastScanInvalid}: {lastScanFeedback.invalidTokens.join(", ")}
                      </div>
                    ) : null}

                    {lastScanFeedback.skippedByLimit > 0 ? (
                      <div className="text-xs text-amber-700">
                        {formatText(text.lastScanLimit, {
                          count: lastScanFeedback.skippedByLimit,
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className="rounded-3xl">
                <CardContent className="p-5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="mt-3 h-10 w-16" />
                  <Skeleton className="mt-2 h-3 w-32" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <StatTile
                title={text.intakeQueue}
                value={needsIntake}
                hint={text.intakeQueueHint}
                icon={PackageCheck}
              />
              <StatTile
                title={text.onFloor}
                value={onFloor}
                hint={text.onFloorHint}
                icon={Warehouse}
              />
              <StatTile
                title={text.outboundWave}
                value={outboundWave}
                hint={text.outboundWaveHint}
                icon={Truck}
              />
              <StatTile
                title={text.exceptions}
                value={exceptions}
                hint={text.exceptionsHint}
                icon={AlertTriangle}
              />
            </>
          )}
        </div>

        <Card className="rounded-3xl border-border/70">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl border border-border/70 bg-muted/25 p-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{text.quickFilters}</p>
                  <p className="text-xs text-muted-foreground">{text.quickFiltersHint}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {quickFilterMeta.map((filter) => (
                  <Button
                    key={filter.key}
                    type="button"
                    variant={activeQuickFilter === filter.key ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setActiveQuickFilter(filter.key)}
                  >
                    {filter.label}
                    <Badge variant="secondary" className="ml-1.5 rounded-full">
                      {filter.count}
                    </Badge>
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_360px]">
          <Card className="rounded-3xl border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{text.queueHealth}</CardTitle>
              <p className="text-sm text-muted-foreground">{text.queueHealthHint}</p>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {laneCards.map((lane) => {
                const Icon = lane.icon;
                return (
                  <div key={lane.title} className="rounded-3xl border border-border/70 bg-muted/15 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{lane.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{lane.hint}</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-background p-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="mt-4 flex items-end justify-between">
                      <p className="text-3xl font-semibold">{lane.count}</p>
                      <div className="flex flex-wrap justify-end gap-1">
                        {lane.statuses.map((status) => (
                          <Badge key={status} variant={statusVariant(status)} className="rounded-full">
                            {getStatusLabel(status, t)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="rounded-3xl border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{text.manifestTitle}</CardTitle>
                <p className="text-sm text-muted-foreground">{text.manifestHint}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {driversQuery.isLoading ? (
                  <>
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </>
                ) : manifestDrivers.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                    {text.manifestNoDrivers}
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {text.manifestDriver}
                      </p>
                      <Select value={manifestDriverId} onValueChange={setManifestDriverId}>
                        <SelectTrigger>
                          <SelectValue placeholder={text.manifestChooseDriver} />
                        </SelectTrigger>
                        <SelectContent>
                          {manifestDrivers.map((driver) => (
                            <SelectItem key={driver.id} value={driver.id}>
                              {driver.name} - {driver.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      type="button"
                      className="w-full gap-2"
                      onClick={() => manifestMutation.mutate()}
                      disabled={!manifestDriverId || manifestMutation.isPending}
                    >
                      <Printer className="h-4 w-4" />
                      {manifestMutation.isPending ? text.manifestPrinting : text.manifestPrint}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{text.incomplete}</CardTitle>
                <p className="text-sm text-muted-foreground">{text.incompleteHint}</p>
              </CardHeader>
              <CardContent>
                {incompleteMultiPiece.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                    {text.incompleteEmpty}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {incompleteMultiPiece.slice(0, 5).map((order) => {
                      const parcels = order.parcels ?? [];
                      const pieceTotal = Math.max(1, parcels[0]?.pieceTotal ?? 0, parcels.length);
                      const knownCodes = parcels.filter((parcel) => parcel.parcelCode).length;

                      return (
                        <Link
                          key={order.id}
                          href={`/dashboard/warehouse/orders/${order.id}`}
                          className="block rounded-3xl border border-amber-300/40 bg-amber-50 p-4 text-amber-950 transition hover:bg-amber-100/80"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold">{orderRef(order, text.unnumbered)}</p>
                              <p className="mt-1 text-xs opacity-80">{knownCodes}/{pieceTotal} scanned</p>
                            </div>
                            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{text.liveView}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-3xl border border-border/70 bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{text.page.replace("{page}", String(page))}</span>
                    <Badge variant="outline" className="rounded-full">
                      {formatText(text.loaded, { count: filteredOrders.length })}
                    </Badge>
                  </div>
                  <p className="mt-3 font-medium">
                    {lastSyncedAt
                      ? formatText(text.syncedAt, {
                          time: lastSyncedAt.toLocaleTimeString(locale),
                        })
                      : text.notSynced}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {isSearchMode ? text.searchMode : text.limitedView}
                  </p>
                </div>

                <div className="rounded-3xl border border-border/70 bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span>{getStatusLabel("delivered", t)}</span>
                    <span className="text-xl font-semibold">{deliveredToday}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatText(text.countOrders, { count: filteredOrders.length })}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="rounded-3xl border-border/70">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-base">{text.boardTitle}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{text.boardSubtitle}</p>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Button variant="outline" size="sm" onClick={goPrev} disabled={!canPrev || isFetching}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span>{text.page.replace("{page}", String(page))}</span>
                <Button variant="outline" size="sm" onClick={goNext} disabled={!canNext || isFetching}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-80" />
                <Skeleton className="h-[540px] w-full" />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
                {text.noOrders}
              </div>
            ) : (
              <DispatchCenter
                orders={filteredOrders}
                role="warehouse"
                onRefresh={handleRefresh}
                detailsBasePath="/dashboard/warehouse/orders"
                externalScanRequest={externalScanRequest}
                onExternalScanProcessed={handleExternalScanProcessed}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

