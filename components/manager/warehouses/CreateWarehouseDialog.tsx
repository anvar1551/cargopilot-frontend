"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { createWarehouse } from "@/lib/warehouses";

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

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

function getErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") return "Failed";

  const candidate = error as {
    response?: { data?: { error?: string } };
    message?: string;
  };

  return candidate.response?.data?.error ?? candidate.message ?? "Failed";
}

export default function CreateWarehouseDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();

  const [name, setName] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [region, setRegion] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setName("");
      setLocation("");
      setRegion("");
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name is required");
      if (!location.trim()) throw new Error("Location is required");

      return createWarehouse({
        name: name.trim(),
        location: location.trim(),
        region: region.trim() ? region.trim() : undefined,
      });
    },
    onSuccess: () => {
      toast.success("Warehouse created");
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
          <DialogTitle>Create warehouse</DialogTitle>
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
            {mutation.isPending ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
