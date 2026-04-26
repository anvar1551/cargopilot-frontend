"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { updateDriverProfile, type DriverLite } from "@/lib/manager";
import type { Warehouse } from "@/lib/warehouses";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DriverWithAssignments = DriverLite & {
  warehouseIds?: string[];
  driverType?: "local" | "linehaul";
};

type Props = {
  driver: DriverWithAssignments;
  warehouses: Warehouse[];
};

function uniqueWarehouseIds(driver: DriverWithAssignments) {
  return Array.from(
    new Set(
      [
        driver.warehouseId ?? null,
        ...(Array.isArray(driver.warehouseIds) ? driver.warehouseIds : []),
      ].filter((value): value is string => Boolean(value)),
    ),
  );
}

function getErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") return "Failed to update driver";
  const candidate = error as {
    response?: { data?: { error?: string } };
    message?: string;
  };
  return candidate.response?.data?.error ?? candidate.message ?? "Failed to update driver";
}

export default function EditDriverProfileDialog({ driver, warehouses }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [driverType, setDriverType] = React.useState<"local" | "linehaul">(
    driver.driverType === "linehaul" ? "linehaul" : "local",
  );
  const [primaryWarehouseId, setPrimaryWarehouseId] = React.useState<string>(
    driver.warehouseId ?? "none",
  );
  const [warehouseIds, setWarehouseIds] = React.useState<string[]>(
    uniqueWarehouseIds(driver),
  );

  React.useEffect(() => {
    if (!open) return;
    setDriverType(driver.driverType === "linehaul" ? "linehaul" : "local");
    setPrimaryWarehouseId(driver.warehouseId ?? "none");
    setWarehouseIds(uniqueWarehouseIds(driver));
  }, [driver, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const normalizedPrimaryWarehouseId =
        primaryWarehouseId === "none" ? null : primaryWarehouseId;
      const normalizedWarehouseIds = Array.from(
        new Set(
          [
            ...warehouseIds,
            ...(normalizedPrimaryWarehouseId ? [normalizedPrimaryWarehouseId] : []),
          ].filter(Boolean),
        ),
      );

      return updateDriverProfile(driver.id, {
        driverType,
        primaryWarehouseId: normalizedPrimaryWarehouseId,
        warehouseIds: normalizedWarehouseIds,
      });
    },
    onSuccess: async () => {
      toast.success("Driver profile updated");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["manager-drivers-page"] }),
        queryClient.invalidateQueries({ queryKey: ["manager-drivers"] }),
        queryClient.invalidateQueries({ queryKey: ["manager-live-map-snapshot"] }),
      ]);
      setOpen(false);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Driver</DialogTitle>
          <DialogDescription>
            Configure driver type and warehouse visibility scope.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Driver type</Label>
            <Select
              value={driverType}
              onValueChange={(value: "local" | "linehaul") => setDriverType(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local driver</SelectItem>
                <SelectItem value="linehaul">Linehaul driver (visible across warehouses)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Primary warehouse (optional)</Label>
            <Select value={primaryWarehouseId} onValueChange={setPrimaryWarehouseId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {warehouses.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                    {warehouse.region ? ` - ${warehouse.region}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Additional warehouse access</Label>
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-border/60 p-3">
              {warehouses.map((warehouse) => {
                const checked = warehouseIds.includes(warehouse.id);
                return (
                  <label
                    key={warehouse.id}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{warehouse.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {warehouse.region || warehouse.location}
                      </p>
                    </div>
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(next) => {
                        const enabled = next === true;
                        setWarehouseIds((prev) => {
                          if (enabled) return Array.from(new Set([...prev, warehouse.id]));
                          return prev.filter((id) => id !== warehouse.id);
                        });
                      }}
                    />
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

