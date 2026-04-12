"use client";

import Link from "next/link";
import * as React from "react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import DispatchCenter from "@/components/manager/dispatch/DispatchCenter";
import { fetchOrders } from "@/lib/orders";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";

import {
  LayoutDashboard,
  Truck,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

type OrdersResponse = {
  orders: Array<{
    id: string;
    orderNumber?: string | number | null;
    status: string;
    pickupAddress?: string | null;
    dropoffAddress?: string | null;
    createdAt?: string | null;
    customer?: { email?: string | null } | null;
    parcels?: Array<{ parcelCode?: string | null }> | null;
  }>;
  total: number;
  page: number;
  limit: number;
  pageCount: number;
  hasMore: boolean;
  nextCursor?: string | null;
  mode?: "page" | "cursor";
  totalExact?: boolean;
};

function useDebouncedValue<T>(value: T, delay = 450) {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}

export default function ManagerDispatchPage() {
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 450);
  const isSearchMode = debouncedQ.trim().length > 0;
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const [baseCursorStack, setBaseCursorStack] = useState<Array<string | null>>([
    null,
  ]);
  const [baseCursorIndex, setBaseCursorIndex] = useState(0);
  const [searchCursorStack, setSearchCursorStack] = useState<
    Array<string | null>
  >([null]);
  const [searchCursorIndex, setSearchCursorIndex] = useState(0);

  React.useEffect(() => {
    setSearchCursorStack([null]);
    setSearchCursorIndex(0);
  }, [debouncedQ]);

  // Base load (limited for performance)
  const baseQuery = useQuery<OrdersResponse>({
    queryKey: [
      "dispatch-orders",
      {
        mode: "base",
        cursor: baseCursorStack[baseCursorIndex] ?? null,
      },
    ],
    queryFn: () =>
      fetchOrders({
        limit: 120,
        mode: "cursor",
        cursor: baseCursorStack[baseCursorIndex] ?? undefined,
      }) as unknown as Promise<OrdersResponse>,
    enabled: !isSearchMode,
    placeholderData: (prev) => prev,
  });

  // Search load (only when user types)
  const searchQuery = useQuery<OrdersResponse>({
    queryKey: [
      "dispatch-orders",
      {
        mode: "search",
        q: debouncedQ,
        cursor: searchCursorStack[searchCursorIndex] ?? null,
      },
    ],
    queryFn: () =>
      fetchOrders({
        q: debouncedQ,
        limit: 50,
        mode: "cursor",
        cursor: searchCursorStack[searchCursorIndex] ?? undefined,
      }) as unknown as Promise<OrdersResponse>,
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
  }, [baseQuery.data?.hasMore, baseQuery.data?.nextCursor, baseCursorIndex]);

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
  }, [
    searchQuery.data?.hasMore,
    searchQuery.data?.nextCursor,
    searchCursorIndex,
  ]);

  const activeQuery = isSearchMode ? searchQuery : baseQuery;

  React.useEffect(() => {
    if (activeQuery.dataUpdatedAt) {
      setLastSyncedAt(new Date(activeQuery.dataUpdatedAt));
    }
  }, [activeQuery.dataUpdatedAt]);

  const orders = useMemo(() => {
    return activeQuery.data?.orders ?? [];
  }, [activeQuery.data]);

  const meta = activeQuery.data;

  const isLoading = activeQuery.isLoading;
  const isFetching = activeQuery.isFetching;

  const page = isSearchMode ? searchCursorIndex + 1 : baseCursorIndex + 1;
  const total = meta?.total ?? orders.length;
  const totalLabel =
    meta?.totalExact === false ? `Loaded ${orders.length}` : `${total} total`;

  const canPrev = page > 1;
  const canNext = Boolean(meta?.hasMore);

  const handleRefresh = async () => {
    await activeQuery.refetch();
  };

  const goPrev = () => {
    if (!canPrev) return;
    if (isSearchMode) {
      setSearchCursorIndex((p) => Math.max(0, p - 1));
      return;
    }
    setBaseCursorIndex((p) => Math.max(0, p - 1));
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
      setSearchCursorIndex((p) => p + 1);
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
    setBaseCursorIndex((p) => p + 1);
  };

  return (
    <div className="p-6 w-full">
      <div className="w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Dispatch Center
            </h1>
            <p className="text-sm text-muted-foreground">
              Workflow board for triage, scanning, driver assignment, and bulk status updates.
              {isSearchMode ? " (Search mode)" : " (Limited live view)"}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            {/* Search */}
            <div className="relative w-full sm:w-[420px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by order id, customer, address, warehouse..."
                className="pl-9 pr-10"
              />
              {q ? (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  title="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            {/* Nav buttons */}
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" className="gap-2">
                <Link href="/dashboard/manager">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
              </Button>

              <Button asChild variant="outline" className="gap-2">
                <Link href="/dashboard/manager/orders">
                  <Truck className="h-4 w-4" />
                  Orders Table
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">
                {isSearchMode ? "Search Results" : "Live Queue (limited)"}
              </CardTitle>

              {/* Pagination bar */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>
                  {totalLabel} | Page{" "}
                  <span className="font-medium text-foreground">{page}</span>
                </span>

                <span className="hidden md:inline">
                  {lastSyncedAt
                    ? `Synced ${lastSyncedAt.toLocaleTimeString()}`
                    : "Not synced yet"}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isFetching}
                  className="gap-2"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={goPrev}
                  disabled={!canPrev || isFetching}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={goNext}
                  disabled={!canNext || isFetching}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-80" />
                <Skeleton className="h-72 w-full" />
              </div>
            ) : (
              <DispatchCenter
                orders={orders}
                role="manager"
                onRefresh={handleRefresh}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
