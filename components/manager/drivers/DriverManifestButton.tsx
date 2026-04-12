"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Printer } from "lucide-react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import {
  driverManifestCopy,
  EMPTY_DRIVER_MANIFEST_ERROR,
  MAX_MANIFEST_ORDERS,
  POPUP_BLOCKED_DRIVER_MANIFEST_ERROR,
  printDriverManifest,
} from "@/lib/driver-manifest";

type DriverManifestButtonProps = {
  driverId: string;
  driverName: string;
  driverEmail: string;
  warehouseName?: string | null;
  activeAssigned: number;
};

export default function DriverManifestButton({
  driverId,
  driverName,
  driverEmail,
  warehouseName,
  activeAssigned,
}: DriverManifestButtonProps) {
  const { locale, t } = useI18n();
  const labels = driverManifestCopy[locale as keyof typeof driverManifestCopy] ?? driverManifestCopy.en;

  const manifestMutation = useMutation({
    mutationFn: () =>
      printDriverManifest({
        driverId,
        driverName,
        driverEmail,
        warehouseName,
        locale,
        labels,
        t,
      }),
    onSuccess: ({ truncated }) => {
      if (truncated) {
        toast(`Manifest was limited to the first ${MAX_MANIFEST_ORDERS} active orders.`);
      }
    },
    onError: (error: unknown) => {
      if (error instanceof Error && error.message === EMPTY_DRIVER_MANIFEST_ERROR) {
        toast("This driver has no active assigned orders.");
        return;
      }
      if (error instanceof Error && error.message === POPUP_BLOCKED_DRIVER_MANIFEST_ERROR) {
        toast.error(labels.popupBlocked);
        return;
      }
      toast.error("Failed to build driver manifest.");
    },
  });

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={() => manifestMutation.mutate()}
      disabled={manifestMutation.isPending || activeAssigned <= 0}
      title={labels.printManifest}
    >
      {manifestMutation.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Printer className="h-4 w-4" />
      )}
      {manifestMutation.isPending ? "Preparing..." : labels.printManifest}
    </Button>
  );
}
