"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { createWarehouse, updateWarehouse } from "@/lib/warehouses";
import {
  DEFAULT_WAREHOUSE_TYPE,
  WAREHOUSE_TYPES,
  type Warehouse,
  type WarehouseType,
} from "@/lib/warehouses";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  warehouse?: Warehouse | null;
};

function getErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") return "Failed";

  const candidate = error as {
    response?: { data?: { error?: string } };
    message?: string;
  };

  return candidate.response?.data?.error ?? candidate.message ?? "Failed";
}

export default function CreateWarehouseDialog({
  open,
  onOpenChange,
  warehouse,
}: Props) {
  const qc = useQueryClient();

  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<WarehouseType>(DEFAULT_WAREHOUSE_TYPE);
  const [location, setLocation] = React.useState("");
  const [region, setRegion] = React.useState("");
  const isEdit = Boolean(warehouse?.id);

  React.useEffect(() => {
    if (!open) {
      setName("");
      setType(DEFAULT_WAREHOUSE_TYPE);
      setLocation("");
      setRegion("");
      return;
    }

    if (warehouse) {
      setName(warehouse.name ?? "");
      setType(
        (warehouse.type as WarehouseType | null) ?? DEFAULT_WAREHOUSE_TYPE,
      );
      setLocation(warehouse.location ?? "");
      setRegion(warehouse.region ?? "");
    }
  }, [open, warehouse]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name is required");
      if (!location.trim()) throw new Error("Location is required");

      const payload = {
        name: name.trim(),
        type,
        location: location.trim(),
        region: region.trim() ? region.trim() : undefined,
      };

      if (warehouse?.id) {
        return updateWarehouse(warehouse.id, payload);
      }

      return createWarehouse(payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? "Warehouse updated" : "Warehouse created");
      qc.invalidateQueries({ queryKey: ["warehouses"] });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit location" : "Create warehouse"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Hamburg Hub"
            />
          </div>

          <div className="space-y-2">
            <Label>Node type</Label>
            <Select value={type} onValueChange={(value) => setType(value as WarehouseType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {WAREHOUSE_TYPES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item === "pickup_point" ? "Pickup point" : "Warehouse"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Location</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Hamburg, Germany"
            />
          </div>

          <div className="space-y-2">
            <Label>Region (optional)</Label>
            <Input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="North"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending
              ? isEdit
                ? "Saving..."
                : "Creating..."
              : isEdit
                ? "Save changes"
                : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
