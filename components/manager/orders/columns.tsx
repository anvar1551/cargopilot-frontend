"use client";

import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, ExternalLink, FileText, Package } from "lucide-react";

import type { Translate } from "@/lib/i18n/labels";
import { getStatusLabel } from "@/lib/i18n/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type InvoiceLite = {
  status?: string | null;
  invoiceUrl?: string | null;
  paymentUrl?: string | null;
};

export type ManagerOrderRow = {
  id: string;
  orderNumber?: string | number | null;
  status?: string | null;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  createdAt?: string | null;
  labelUrl?: string | null;
  parcels?: Array<{ labelKey?: string | null }> | null;
  customer?: {
    name?: string | null;
    email?: string | null;
  } | null;
  invoice?: InvoiceLite | null;
  Invoice?: InvoiceLite | null;
};

function statusVariant(status: string) {
  const value = String(status || "").toLowerCase();
  if (value === "delivered") return "default" as const;
  if (
    value === "exception" ||
    value === "return_in_progress" ||
    value === "returned" ||
    value === "cancelled"
  ) {
    return "destructive" as const;
  }
  if (value === "out_for_delivery" || value === "at_warehouse" || value === "arrived_at_warehouse") {
    return "secondary" as const;
  }
  return "outline" as const;
}

function sortHeader(
  label: string,
  column: {
    getIsSorted: () => false | "asc" | "desc";
    toggleSorting: (desc?: boolean) => void;
  },
) {
  return (
    <Button
      variant="ghost"
      className="h-8 px-0 text-xs font-medium uppercase tracking-wide text-muted-foreground"
      onClick={(event) => {
        event.stopPropagation();
        column.toggleSorting(column.getIsSorted() === "asc");
      }}
    >
      {label}
      <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
    </Button>
  );
}

export function getColumns(t: Translate): ColumnDef<ManagerOrderRow>[] {
  return [
    {
      id: "order",
      accessorFn: (row) => row.orderNumber ?? row.id,
      header: ({ column }) => sortHeader(t("ordersTable.order"), column),
      cell: ({ row }) => {
        const order = row.original;
        return (
          <div className="min-w-[150px] space-y-0.5">
            <div className="text-sm font-semibold">
              {order.orderNumber ? `#${order.orderNumber}` : t("ordersTable.orderPendingNumber")}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {order.createdAt
                ? new Date(order.createdAt).toLocaleDateString()
                : t("ordersTable.createdRecently")}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: t("ordersTable.status"),
      cell: ({ row }) => {
        const status = String(row.original.status ?? "unknown");
        return (
          <Badge variant={statusVariant(status)} className="capitalize">
            {getStatusLabel(status, t)}
          </Badge>
        );
      },
    },
    {
      id: "route",
      accessorFn: (row) => `${row.pickupAddress ?? ""} ${row.dropoffAddress ?? ""}`,
      header: ({ column }) => sortHeader(t("ordersTable.route"), column),
      cell: ({ row }) => {
        const order = row.original;
        return (
          <div className="min-w-[260px] max-w-[360px] space-y-0.5">
            <div className="truncate text-sm">{order.pickupAddress || "-"}</div>
            <div className="text-xs text-muted-foreground">{"->"}</div>
            <div className="truncate text-sm">{order.dropoffAddress || "-"}</div>
          </div>
        );
      },
    },
    {
      id: "customer",
      accessorFn: (row) => `${row.customer?.name ?? ""} ${row.customer?.email ?? ""}`,
      header: t("ordersTable.customer"),
      cell: ({ row }) => {
        const customer = row.original.customer;
        return (
          <div className="min-w-[170px] max-w-[220px]">
            <div className="truncate text-sm font-medium">{customer?.name ?? "-"}</div>
            <div className="truncate text-xs text-muted-foreground">{customer?.email ?? "-"}</div>
          </div>
        );
      },
    },
    {
      id: "docs",
      header: t("ordersTable.docs"),
      cell: ({ row }) => {
        const order = row.original;
        const invoice = order.invoice ?? order.Invoice;
        const hasLabel = Boolean(order.labelUrl) || Boolean(order.parcels?.some((parcel) => parcel.labelKey));
        const hasInvoice = Boolean(invoice?.invoiceUrl);
        const payPending = Boolean(invoice?.paymentUrl) && invoice?.status !== "paid";

        return (
          <div className="flex min-w-[180px] flex-wrap gap-1.5">
            <Badge variant="outline" className={!hasLabel ? "opacity-50" : ""}>
              <Package className="mr-1 h-3 w-3" />
              {hasLabel ? t("ordersTable.label") : t("ordersTable.noLabel")}
            </Badge>
            <Badge variant="outline" className={!hasInvoice ? "opacity-50" : ""}>
              <FileText className="mr-1 h-3 w-3" />
              {hasInvoice ? t("ordersTable.invoice") : t("ordersTable.noInvoice")}
            </Badge>
            {payPending ? <Badge variant="secondary">{t("ordersTable.paymentPending")}</Badge> : null}
          </div>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => sortHeader(t("ordersTable.created"), column),
      cell: ({ row }) => {
        const raw = row.original.createdAt;
        const date = raw ? new Date(raw) : null;
        return <div className="min-w-[150px] text-xs text-muted-foreground">{date ? date.toLocaleString() : "-"}</div>;
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const id = row.original.id;
        return (
          <Button
            asChild
            variant="ghost"
            size="icon"
            title={t("ordersTable.openDetails")}
            onClick={(event) => event.stopPropagation()}
            className="h-8 w-8"
          >
            <Link href={`/dashboard/manager/orders?order=${id}`}>
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        );
      },
    },
  ];
}
