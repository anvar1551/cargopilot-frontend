"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import {
  fetchWarehouses,
  getWarehouseCapabilities,
  getWarehouseTypeLabel,
} from "@/lib/warehouses";

import CreateWarehouseDialog from "@/components/manager/warehouses/CreateWarehouseDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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
            <h1 className="text-2xl font-semibold tracking-tight">Warehouses</h1>
            <p className="text-sm text-muted-foreground">
              Create operational nodes for routing, scanning, and physical handoff.
              Standard warehouses and pickup points now share one safe foundation.
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
                {q.data.map((warehouse) => (
                  <div
                    key={warehouse.id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium">{warehouse.name}</div>
                        <Badge variant="outline" className="rounded-full">
                          {getWarehouseTypeLabel(warehouse.type)}
                        </Badge>
                      </div>

                      <div className="text-sm text-muted-foreground">
                        {warehouse.location}
                        {warehouse.region ? ` • ${warehouse.region}` : ""}
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {getWarehouseCapabilities(warehouse.type).map((capability) => (
                          <Badge
                            key={`${warehouse.id}-${capability}`}
                            variant="secondary"
                            className="rounded-full"
                          >
                            {capability.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {warehouse.region ? `Region: ${warehouse.region}` : "Ready for routing"}
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
