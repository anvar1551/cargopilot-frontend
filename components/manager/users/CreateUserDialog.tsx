"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, UserPlus } from "lucide-react";

import { createUser, type MembershipScopeType } from "@/lib/users";
import { fetchRoles } from "@/lib/iam";
import { fetchWarehouses, type Warehouse } from "@/lib/warehouses";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ScopeRow = {
  scopeType: MembershipScopeType;
  scopeRefId: string;
};

const SCOPE_TYPES: MembershipScopeType[] = [
  "company",
  "branch",
  "warehouse",
  "agent",
  "pickup_point",
  "carrier",
  "client",
];

function generatePassword(len = 14) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let output = "";
  for (let i = 0; i < len; i += 1) output += chars[Math.floor(Math.random() * chars.length)];
  return output;
}

export default function CreateUserDialog() {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [selectedRoleCodes, setSelectedRoleCodes] = React.useState<string[]>([]);
  const [warehouseId, setWarehouseId] = React.useState<string | null>(null);
  const [driverType, setDriverType] = React.useState<"local" | "linehaul" | null>(null);
  const [customerEntityId, setCustomerEntityId] = React.useState("");
  const [branchId, setBranchId] = React.useState("");
  const [scopes, setScopes] = React.useState<ScopeRow[]>([]);

  const qc = useQueryClient();
  const rolesQuery = useQuery({
    queryKey: ["iam-roles"],
    queryFn: ({ signal }) => fetchRoles(signal),
    enabled: open,
  });
  const warehousesQuery = useQuery<Warehouse[]>({
    queryKey: ["warehouses", "rbac-user-dialog"],
    queryFn: fetchWarehouses,
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: async () => {
      toast.success("User created");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["users"] }),
        qc.invalidateQueries({ queryKey: ["iam-roles"] }),
      ]);
      setName("");
      setEmail("");
      setPassword("");
      setSelectedRoleCodes([]);
      setWarehouseId(null);
      setDriverType(null);
      setCustomerEntityId("");
      setBranchId("");
      setScopes([]);
      setOpen(false);
    },
    onError: (error: unknown) => {
      const message =
        typeof error === "object" && error !== null
          ? (
              error as {
                response?: { data?: { error?: string } };
                message?: string;
              }
            ).response?.data?.error ?? (error as { message?: string }).message
          : undefined;
      toast.error(message ?? "Failed to create user");
    },
  });

  const toggleRole = (code: string, checked: boolean) => {
    setSelectedRoleCodes((prev) =>
      checked ? Array.from(new Set([...prev, code])) : prev.filter((item) => item !== code),
    );
  };

  const addScope = () => {
    setScopes((prev) => [...prev, { scopeType: "company", scopeRefId: "" }]);
  };

  const submit = () => {
    if (!name.trim() || !email.trim() || password.trim().length < 6) {
      toast.error("Name, email, and password (min 6 chars) are required");
      return;
    }
    if (selectedRoleCodes.length === 0) {
      toast.error("Select at least one role");
      return;
    }
    const cleanScopes = scopes
      .map((item) => ({ scopeType: item.scopeType, scopeRefId: item.scopeRefId.trim() }))
      .filter((item) => item.scopeRefId.length > 0);

    mutation.mutate({
      name: name.trim(),
      email: email.trim(),
      password: password.trim(),
      roleCodes: selectedRoleCodes,
      warehouseId: warehouseId ?? null,
      driverType,
      branchId: branchId.trim() || null,
      customerEntityId: customerEntityId.trim() || null,
      scopes: cleanScopes.length > 0 ? cleanScopes : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" />
          Create User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Create User (RBAC)</DialogTitle>
          <DialogDescription>
            Invite a user, assign one or more roles, and optionally define explicit membership scopes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@company.com" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="flex gap-2">
                <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 chars" />
                <Button type="button" variant="outline" onClick={() => setPassword(generatePassword())}>
                  Generate
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="mb-3 flex items-center justify-between">
              <Label>Role Bindings</Label>
              <Badge variant="outline">{selectedRoleCodes.length} selected</Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {(rolesQuery.data ?? []).map((role) => {
                const checked = selectedRoleCodes.includes(role.code);
                return (
                  <label key={role.id} className="flex cursor-pointer items-center gap-3 rounded-xl border p-3">
                    <Checkbox checked={checked} onCheckedChange={(state) => toggleRole(role.code, Boolean(state))} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{role.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{role.code}</p>
                    </div>
                    {role.isSystem ? <Badge variant="secondary">System</Badge> : null}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-2">
              <Label>Branch ID (optional)</Label>
              <Input value={branchId} onChange={(e) => setBranchId(e.target.value)} placeholder="UUID" />
            </div>
            <div className="space-y-2">
              <Label>Warehouse (optional)</Label>
              <Select value={warehouseId ?? "none"} onValueChange={(value) => setWarehouseId(value === "none" ? null : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(warehousesQuery.data ?? []).map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Driver Type (optional)</Label>
              <Select value={driverType ?? "none"} onValueChange={(value) => setDriverType(value === "none" ? null : (value as "local" | "linehaul"))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="local">local</SelectItem>
                  <SelectItem value="linehaul">linehaul</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Customer Entity ID (optional)</Label>
              <Input value={customerEntityId} onChange={(e) => setCustomerEntityId(e.target.value)} placeholder="UUID" />
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="mb-3 flex items-center justify-between">
              <Label>Membership Scopes (optional)</Label>
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={addScope}>
                <Plus className="h-3.5 w-3.5" />
                Add scope
              </Button>
            </div>
            <div className="space-y-2">
              {scopes.length === 0 ? (
                <p className="text-sm text-muted-foreground">If empty, backend applies default company scope.</p>
              ) : (
                scopes.map((row, index) => (
                  <div key={`${index}-${row.scopeType}`} className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
                    <Select
                      value={row.scopeType}
                      onValueChange={(value) =>
                        setScopes((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, scopeType: value as MembershipScopeType } : item,
                          ),
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SCOPE_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={row.scopeRefId}
                      onChange={(e) =>
                        setScopes((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, scopeRefId: e.target.value } : item,
                          ),
                        )
                      }
                      placeholder="scope_ref_id"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setScopes((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      Remove
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={submit} disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating
                </>
              ) : (
                "Create User"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
