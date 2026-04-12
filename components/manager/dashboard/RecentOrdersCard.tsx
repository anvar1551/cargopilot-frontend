"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchOrders, type Order, type OrdersResponse } from "@/lib/orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function prettyStatus(status: string) {
  return String(status || "").replaceAll("_", " ");
}

function statusVariant(status: string) {
  switch (status) {
    case "delivered":
      return "default" as const;
    case "out_for_delivery":
    case "arrived_at_warehouse":
      return "secondary" as const;
    case "in_transit":
    case "assigned":
      return "outline" as const;
    case "pending":
    default:
      return "outline" as const;
  }
}

export default function RecentOrdersCard({ limit = 6 }: { limit?: number }) {
  const { data, isLoading, error } = useQuery<OrdersResponse>({
    queryKey: ["orders", "recent", limit],
    queryFn: () =>
      fetchOrders({
        limit,
        mode: "cursor",
      }),
  });

  const orders = useMemo<Order[]>(() => {
    const list = data?.orders ?? [];
    return list.slice(0, limit);
  }, [data, limit]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Recent Orders</CardTitle>

        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/manager/orders">View all</Link>
        </Button>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading recent orders...</div>
        ) : error ? (
          <div className="text-sm text-muted-foreground">Failed to load orders.</div>
        ) : orders.length === 0 ? (
          <div className="text-sm text-muted-foreground">No orders yet.</div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/dashboard/manager/orders?open=${order.id}`}
                className="block rounded-xl border bg-background p-3 transition hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {order.pickupAddress} -&gt; {order.dropoffAddress}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {order.customer?.email ?? "-"}
                    </div>
                  </div>

                  <Badge
                    variant={statusVariant(order.status ?? "pending")}
                    className="capitalize"
                  >
                    {prettyStatus(order.status ?? "pending")}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
