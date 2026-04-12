"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { getUser } from "@/lib/auth";
import { useI18n } from "@/components/i18n/I18nProvider";

import { fetchDrivers, type DriverLite } from "@/lib/manager";
import {
  assignDriversBulk,
  type OrderTaskType,
} from "@/lib/orders";
import {
  driverManifestCopy,
  EMPTY_DRIVER_MANIFEST_ERROR,
  POPUP_BLOCKED_DRIVER_MANIFEST_ERROR,
  printDriverManifest,
} from "@/lib/driver-manifest";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function getErrorMessage(err: unknown): string {
  if (!err || typeof err !== "object") return "Failed to assign driver";
  const maybe = err as {
    message?: string;
    response?: { data?: { error?: string; message?: string } };
  };

  const raw =
    maybe.response?.data?.error ??
    maybe.response?.data?.message ??
    maybe.message ??
    "Failed to assign driver";

  if (raw.includes("Cannot assign driver in these states")) {
    return "Assignment is not possible at the current order stage. Change status first or choose a different cycle.";
  }

  if (raw.includes("Cannot assign driver for final orders")) {
    return "Assignment is not possible for final orders (delivered, returned, cancelled).";
  }

  return raw;
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  singleOrderId?: string | null;
  selectedOrderIds?: string[];
  onAssigned?: () => void;
};

export default function AssignDriverDialog({
  open,
  onOpenChange,
  singleOrderId = null,
  selectedOrderIds = [],
  onAssigned,
}: Props) {
  const isBulk = !singleOrderId && selectedOrderIds.length > 0;
  const authUser = React.useMemo(() => getUser(), []);
  const { locale, t } = useI18n();
  const manifestLabels =
    driverManifestCopy[locale as keyof typeof driverManifestCopy] ?? driverManifestCopy.en;

  const driversQuery = useQuery({
    queryKey: ["manager-drivers"],
    queryFn: fetchDrivers,
    enabled: open,
  });

  const [driverId, setDriverId] = React.useState("");
  const [cycle, setCycle] = React.useState<OrderTaskType>("pickup");

  React.useEffect(() => {
      if (!open) {
        setDriverId("");
        setCycle("pickup");
      }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async (printAfterAssign: boolean) => {
      if (!driverId) throw new Error("Please select a driver");

      const orderIds = singleOrderId ? [singleOrderId] : selectedOrderIds;
      await assignDriversBulk({
        orderIds,
        driverId,
        type: cycle,
      });

      if (!printAfterAssign) return;

      const selectedDriver = drivers.find((item) => item.id === driverId);
      if (!selectedDriver) return;

      await printDriverManifest({
        driverId: selectedDriver.id,
        driverName: selectedDriver.name,
        driverEmail: selectedDriver.email,
        warehouseName:
          authUser?.role === "warehouse" ? authUser.warehouseId ?? null : selectedDriver.warehouseId,
        locale,
        labels: manifestLabels,
        t,
      });
    },
    onSuccess: (_result, printAfterAssign) => {
      if (printAfterAssign) {
        // keep visible feedback even when print popup succeeds
      }
      onOpenChange(false);
      onAssigned?.();
    },
    onError: (error) => {
      if (error instanceof Error && error.message === EMPTY_DRIVER_MANIFEST_ERROR) {
        toast("This driver has no active assigned orders.");
        return;
      }
      if (error instanceof Error && error.message === POPUP_BLOCKED_DRIVER_MANIFEST_ERROR) {
        toast.error(manifestLabels.popupBlocked);
      }
    },
  });

  const drivers: DriverLite[] = driversQuery.data ?? [];
  const count = singleOrderId ? 1 : selectedOrderIds.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Assign driver{" "}
            {count ? (
              <span className="text-muted-foreground">
                - {count} order{count === 1 ? "" : "s"}
              </span>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Cycle</Label>
            <Select
              value={cycle}
              onValueChange={(v) => setCycle(v as OrderTaskType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pickup">Pickup</SelectItem>
                <SelectItem value="delivery">Delivery (last mile)</SelectItem>
                <SelectItem value="linehaul">Linehaul</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Select driver</Label>

            {driversQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : drivers.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No drivers found. Create a user with role{" "}
                <span className="font-medium">driver</span>.
              </div>
            ) : (
              <select
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Choose driver...</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} - {d.email}
                  </option>
                ))}
              </select>
            )}
          </div>

          {mutation.isError ? (
            <div className="text-sm text-destructive">
              {getErrorMessage(mutation.error)}
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>

          <Button
            onClick={() => mutation.mutate(false)}
            disabled={
              !driverId ||
              mutation.isPending ||
              (!singleOrderId && selectedOrderIds.length === 0)
            }
          >
            {mutation.isPending
              ? "Assigning..."
              : isBulk
                ? "Assign selected"
                : "Assign"}
          </Button>
          <Button
            variant="outline"
            onClick={() => mutation.mutate(true)}
            disabled={
              !driverId ||
              mutation.isPending ||
              (!singleOrderId && selectedOrderIds.length === 0)
            }
          >
            {mutation.isPending ? "Preparing..." : "Assign + print manifest"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
