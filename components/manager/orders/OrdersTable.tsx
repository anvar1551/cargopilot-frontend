"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { getColumns, type ManagerOrderRow } from "./columns";

import AssignDriverDialog from "@/components/manager/orders/AssignDriverDialog";
import { useI18n } from "@/components/i18n/I18nProvider";
import { getStatusLabel } from "@/lib/i18n/labels";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { RotateCcw, Search, UserPlus, X } from "lucide-react";

const STATUS_OPTIONS = [
  "all",
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
] as const;

const ASSIGNABLE_STATUSES = new Set([
  "pending",
  "assigned",
  "exception",
  "at_warehouse",
  "out_for_delivery",
  "in_transit",
]);

export default function OrdersTable({
  data,
  onRefresh,
  hideQuickFilters = false,
}: {
  data: ManagerOrderRow[];
  onRefresh?: () => void;
  hideQuickFilters?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useI18n();

  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");

  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]>("all");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const columns = React.useMemo(() => getColumns(t), [t]);

  const statusCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const order of data) {
      const s = String(order.status ?? "unknown").toLowerCase();
      map.set(s, (map.get(s) ?? 0) + 1);
    }
    return map;
  }, [data]);

  const orderById = useMemo(() => {
    const map = new Map<string, ManagerOrderRow>();
    for (const order of data) map.set(order.id, order);
    return map;
  }, [data]);

  const filteredRows = useMemo(() => {
    if (statusFilter === "all") return data;
    return data.filter((o) => String(o.status ?? "").toLowerCase() === statusFilter);
  }, [data, statusFilter]);

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,

    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),

    globalFilterFn: (row, _columnId, filterValue) => {
      const q = String(filterValue || "")
        .toLowerCase()
        .trim();
      if (!q) return true;

      const o = row.original;
      const customerText = `${o.customer?.name ?? ""} ${o.customer?.email ?? ""}`
        .toLowerCase()
        .trim();

      return (
        String(o.id ?? "").toLowerCase().includes(q) ||
        String(o.orderNumber ?? "").toLowerCase().includes(q) ||
        String(o.status ?? "").toLowerCase().includes(q) ||
        String(o.pickupAddress ?? "").toLowerCase().includes(q) ||
        String(o.dropoffAddress ?? "").toLowerCase().includes(q) ||
        customerText.includes(q)
      );
    },
  });

  const pageRows = table.getPaginationRowModel().rows;

  const isAllPageSelected =
    pageRows.length > 0 && pageRows.every((r) => selectedIds.includes(r.original.id));

  const isSomePageSelected =
    pageRows.some((r) => selectedIds.includes(r.original.id)) && !isAllPageSelected;

  const toggleSelectAllOnPage = (checked: boolean) => {
    const idsOnPage = pageRows.map((r) => r.original.id);

    setSelectedIds((prev) => {
      if (checked) {
        const set = new Set(prev);
        idsOnPage.forEach((id) => set.add(id));
        return Array.from(set);
      }
      return prev.filter((id) => !idsOnPage.includes(id));
    });
  };

  const toggleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id),
    );
  };

  const onRowClick = (order: ManagerOrderRow) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("order", order.id);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  React.useEffect(() => {
    table.setPageIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, globalFilter]);

  const totalFiltered = table.getFilteredRowModel().rows.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const pageStart = totalFiltered === 0 ? 0 : pageIndex * pageSize + 1;
  const pageEnd = Math.min(totalFiltered, (pageIndex + 1) * pageSize);

  const selectedAssignableIds = useMemo(() => {
    return selectedIds.filter((id) => {
      const order = orderById.get(id);
      const status = String(order?.status ?? "").toLowerCase();
      return ASSIGNABLE_STATUSES.has(status);
    });
  }, [orderById, selectedIds]);

  const selectedBlocked = useMemo(() => {
    return selectedIds
      .map((id) => orderById.get(id))
      .filter((order): order is ManagerOrderRow => Boolean(order))
      .filter((order) => !ASSIGNABLE_STATUSES.has(String(order.status ?? "").toLowerCase()));
  }, [orderById, selectedIds]);

  const blockedPreview = selectedBlocked
    .slice(0, 3)
    .map(
      (order) =>
        `${order.orderNumber ?? "Unnumbered order"} (${getStatusLabel(
          String(order.status ?? "unknown"),
          t,
        )})`,
    )
    .join(", ");

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-muted/20 p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {!hideQuickFilters ? (
            <div className="flex flex-1 items-center gap-2">
              <div className="relative w-full max-w-xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  placeholder={t("ordersTable.searchPlaceholder")}
                  className="pl-9 pr-10"
                />
                {globalFilter ? (
                  <button
                    type="button"
                    onClick={() => setGlobalFilter("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    title={t("ordersTable.clearSearch")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as (typeof STATUS_OPTIONS)[number])}
              >
                <SelectTrigger className="w-[210px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === "all"
                        ? `${t("ordersTable.all")} (${data.length})`
                        : `${getStatusLabel(s, t)} (${statusCountMap.get(s) ?? 0})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex-1" />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => setAssignOpen(true)}
              disabled={selectedAssignableIds.length === 0}
              className="gap-2"
            >
              <UserPlus className="h-4 w-4" />
              {t("ordersTable.assign")} ({selectedAssignableIds.length})
            </Button>

            <Button
              variant="outline"
              onClick={() => setSelectedIds([])}
              disabled={selectedIds.length === 0}
            >
              {t("ordersTable.clearSelection")}
            </Button>

            {!hideQuickFilters ? (
              <Button
                variant="outline"
                onClick={() => {
                  setStatusFilter("all");
                  setGlobalFilter("");
                  setSorting([{ id: "createdAt", desc: true }]);
                  setSelectedIds([]);
                }}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                {t("ordersTable.reset")}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="secondary">{t("ordersTable.total")} {data.length}</Badge>
          <Badge variant="secondary">{t("ordersTable.filtered")} {totalFiltered}</Badge>
          <Badge variant="secondary">{t("ordersTable.selected")} {selectedIds.length}</Badge>
          {selectedBlocked.length > 0 ? (
            <Badge variant="outline">
              {t("ordersTable.notAssignable")} {selectedBlocked.length}
            </Badge>
          ) : null}
        </div>
        {selectedBlocked.length > 0 ? (
          <div className="mt-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-200">
            {t("ordersTable.bulkBlocked")}
            {blockedPreview ? ` ${t("ordersTable.blocked")}: ${blockedPreview}` : ""}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-border/70 bg-background overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-10">
                  <Checkbox
                    checked={isAllPageSelected ? true : isSomePageSelected ? "indeterminate" : false}
                    onCheckedChange={(v) => toggleSelectAllOnPage(v === true)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={t("ordersTable.selectAllOnPage")}
                  />
                </TableHead>

                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => {
                const id = row.original.id;
                const checked = selectedIds.includes(id);

                return (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/35 transition"
                    onClick={() => onRowClick(row.original)}
                    data-state={checked ? "selected" : undefined}
                  >
                    <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => toggleSelectOne(id, v === true)}
                        aria-label={`Select order ${id}`}
                      />
                    </TableCell>

                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  No orders match current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{pageStart}</span>-
          <span className="font-medium text-foreground">{pageEnd}</span> of{" "}
          <span className="font-medium text-foreground">{totalFiltered}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={String(pageSize)}
            onValueChange={(v) => table.setPageSize(Number(v))}
          >
            <SelectTrigger className="h-9 w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 / page</SelectItem>
              <SelectItem value="20">20 / page</SelectItem>
              <SelectItem value="30">30 / page</SelectItem>
              <SelectItem value="50">50 / page</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>

      <AssignDriverDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        selectedOrderIds={selectedAssignableIds}
        onAssigned={() => {
          setSelectedIds([]);
          onRefresh?.();
        }}
      />
    </div>
  );
}
