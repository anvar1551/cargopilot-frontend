"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchWarehouses } from "@/lib/warehouses";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import CreateWarehouseDialog from "@/components/manager/warehouses/CreateWarehouseDialog";

export default function ManagerWarehousesPage() {
  const [open, setOpen] = React.useState(false);

  const q = useQuery({
    queryKey: ["warehouses"],
    queryFn: fetchWarehouses,
  });

  return (
    <div className="p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Warehouses
            </h1>
            <p className="text-sm text-muted-foreground">
              Create hubs used for routing, scanning, and “arrived at
              warehouse”.
            </p>
          </div>

          <Button onClick={() => setOpen(true)}>Create warehouse</Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">List</CardTitle>
          </CardHeader>

          <CardContent>
            {q.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-72" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : q.data?.length ? (
              <div className="divide-y rounded-xl border">
                {q.data.map((w) => (
                  <div
                    key={w.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                  >
                    <div>
                      <div className="font-medium">{w.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {w.location}
                        {w.region ? ` • ${w.region}` : ""}
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {w.region ? `Region: ${w.region}` : "Warehouse ready"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No warehouses yet. Create one to enable warehouse workflows.
              </div>
            )}
          </CardContent>
        </Card>

        <CreateWarehouseDialog open={open} onOpenChange={setOpen} />
      </div>
    </div>
  );
}
