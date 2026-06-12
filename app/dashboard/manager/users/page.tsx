"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axios from "axios";
import {
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Shield,
  Trash2,
  UserCog,
  Users2,
} from "lucide-react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { getUser } from "@/lib/auth";
import { createRole, fetchPermissions, fetchRoles } from "@/lib/iam";
import {
  deleteUser,
  fetchUsers,
  type MembershipScopeType,
  type User,
  updateUserAccess,
} from "@/lib/users";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageShell from "@/components/layout/PageShell";
import CreateUserDialog from "@/components/manager/users/CreateUserDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PAGE_SIZE = 10;

const SCOPE_TYPES: MembershipScopeType[] = [
  "company",
  "branch",
  "warehouse",
  "agent",
  "pickup_point",
  "carrier",
  "client",
];

type ScopeRow = {
  scopeType: MembershipScopeType;
  scopeRefId: string;
};

function extractErrorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) return fallback;
  const payload = error.response?.data as { error?: string } | undefined;
  return payload?.error || error.message || fallback;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export default function UsersPage() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState("users");

  const [roleName, setRoleName] = useState("");
  const [roleCode, setRoleCode] = useState("");
  const [permissionKeys, setPermissionKeys] = useState<string[]>([]);

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRoleCodes, setEditRoleCodes] = useState<string[]>([]);
  const [editBranchId, setEditBranchId] = useState("");
  const [editWarehouseId, setEditWarehouseId] = useState("");
  const [editCustomerEntityId, setEditCustomerEntityId] = useState("");
  const [editDriverType, setEditDriverType] = useState<"none" | "local" | "linehaul">("none");
  const [editScopes, setEditScopes] = useState<ScopeRow[]>([]);

  const queryClient = useQueryClient();
  const currentUser = useMemo(() => getUser(), []);

  const usersQuery = useQuery({
    queryKey: ["users", q, page],
    queryFn: ({ signal }) =>
      fetchUsers(
        {
          q: q || undefined,
          page,
          limit: PAGE_SIZE,
        },
        signal,
      ),
  });

  const rolesQuery = useQuery({
    queryKey: ["iam-roles", "users-page"],
    queryFn: ({ signal }) => fetchRoles(signal),
  });

  const permissionsQuery = useQuery({
    queryKey: ["iam-permissions", "users-page"],
    queryFn: ({ signal }) => fetchPermissions(signal),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: async (data) => {
      toast.success(data.message || t("managerUsers.deleteSuccess"));
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error, t("managerUsers.deleteFailed")));
    },
  });

  const createRoleMutation = useMutation({
    mutationFn: createRole,
    onSuccess: async () => {
      toast.success("Role created");
      setRoleName("");
      setRoleCode("");
      setPermissionKeys([]);
      await queryClient.invalidateQueries({ queryKey: ["iam-roles"] });
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error, "Failed to create role"));
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: Parameters<typeof updateUserAccess>[1] }) =>
      updateUserAccess(userId, payload),
    onSuccess: async () => {
      toast.success("User access updated");
      setEditingUser(null);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error, "Failed to update user access"));
    },
  });

  const users = usersQuery.data?.items ?? [];
  const totalUsers = usersQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));

  const roles = rolesQuery.data ?? [];
  const permissions = permissionsQuery.data ?? [];

  const permissionsByResource = useMemo(() => {
    const map = new Map<string, typeof permissions>();
    for (const permission of permissions) {
      const bucket = map.get(permission.resource) ?? [];
      bucket.push(permission);
      map.set(permission.resource, bucket);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [permissions]);

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRoleCodes(user.roles.map((roleItem) => roleItem.code));
    setEditBranchId(user.branchId ?? "");
    setEditWarehouseId(user.warehouseId ?? "");
    setEditCustomerEntityId(user.customerEntityId ?? "");
    setEditDriverType(user.driverType ?? "none");
    setEditScopes(
      (user.scopes ?? []).map((scope) => ({
        scopeType: scope.scopeType,
        scopeRefId: scope.scopeRefId,
      })),
    );
  };

  const saveUserAccess = () => {
    if (!editingUser) return;
    if (!editName.trim() || !editEmail.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (editRoleCodes.length === 0) {
      toast.error("Select at least one role");
      return;
    }

    const cleanScopes = editScopes
      .map((item) => ({
        scopeType: item.scopeType,
        scopeRefId: item.scopeRefId.trim(),
      }))
      .filter((item) => item.scopeRefId.length > 0);

    updateUserMutation.mutate({
      userId: editingUser.id,
      payload: {
        name: editName.trim(),
        email: editEmail.trim(),
        roleCodes: editRoleCodes,
        branchId: editBranchId.trim() || null,
        warehouseId: editWarehouseId.trim() || null,
        customerEntityId: editCustomerEntityId.trim() || null,
        driverType: editDriverType === "none" ? null : editDriverType,
        scopes: cleanScopes,
      },
    });
  };

  const submitCreateRole = () => {
    const name = roleName.trim();
    if (!name) {
      toast.error("Role name is required");
      return;
    }
    if (permissionKeys.length === 0) {
      toast.error("Select at least one permission");
      return;
    }

    createRoleMutation.mutate({
      name,
      code: roleCode.trim() || name,
      permissionKeys,
    });
  };

  const togglePermission = (key: string, checked: boolean) => {
    setPermissionKeys((prev) =>
      checked ? Array.from(new Set([...prev, key])) : prev.filter((item) => item !== key),
    );
  };

  const toggleEditRole = (code: string, checked: boolean) => {
    setEditRoleCodes((prev) =>
      checked ? Array.from(new Set([...prev, code])) : prev.filter((item) => item !== code),
    );
  };

  return (
    <PageShell>
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[28px] border border-border/70 bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-900 text-white">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.22),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.16),transparent_42%)]" />
          <div className="relative flex flex-col gap-5 p-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-slate-100/90">
                <Shield className="h-3.5 w-3.5" />
                RBAC Admin Studio
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">Users & Access</h1>
                <p className="max-w-2xl text-sm text-slate-200/80">
                  Full identity and access control: users, role catalog, permission bundles, and scope wiring.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-right">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">Users</div>
                <div className="text-2xl font-semibold">{totalUsers}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-right">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">Roles</div>
                <div className="text-2xl font-semibold">{roles.length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-right">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">Permissions</div>
                <div className="text-2xl font-semibold">{permissions.length}</div>
              </div>
            </div>
          </div>
        </section>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="h-auto w-full justify-start gap-2 rounded-2xl border bg-background p-1">
            <TabsTrigger value="users" className="gap-2"><Users2 className="rounded-xl px-4 py-2 data-[state=active]:bg-zinc-900 data-[state=active]:text-white" /> Users</TabsTrigger>
            <TabsTrigger value="roles" className="gap-2"><UserCog className="rounded-xl px-4 py-2 data-[state=active]:bg-zinc-900 data-[state=active]:text-white" /> Roles</TabsTrigger>
            <TabsTrigger value="permissions" className="gap-2"><KeyRound className="rounded-xl px-4 py-2 data-[state=active]:bg-zinc-900 data-[state=active]:text-white" /> Permissions</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <Card className="rounded-[28px] border-border/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">User Directory</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <Input
                    placeholder={t("managerUsers.searchPlaceholder")}
                    value={q}
                    onChange={(event) => {
                      setPage(1);
                      setQ(event.target.value);
                    }}
                    className="max-w-xl"
                  />
                  <div className="flex items-center gap-2">
                    <CreateUserDialog />
                  </div>
                </div>

                <div className="overflow-hidden rounded-3xl border border-border/70">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Roles</TableHead>
                        <TableHead>Business wiring</TableHead>
                        <TableHead>Scopes</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {users.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                            {t("managerUsers.noUsers")}
                          </TableCell>
                        </TableRow>
                      ) : (
                        users.map((user) => {
                          const isCurrentUser = currentUser?.id === user.id;
                          return (
                            <TableRow key={user.id}>
                              <TableCell className="font-medium">{user.name}</TableCell>
                              <TableCell>{user.email}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {user.roles.length === 0 ? (
                                    <Badge variant="outline">-</Badge>
                                  ) : (
                                    user.roles.map((roleItem) => (
                                      <Badge key={roleItem.id} variant="outline" className="capitalize">
                                        {roleItem.name}
                                      </Badge>
                                    ))
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                <div>branch: {user.branchId ?? "-"}</div>
                                <div>warehouse: {user.warehouseId ?? "-"}</div>
                                <div>customer: {user.customerEntityId ?? "-"}</div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{user.scopes?.length ?? 0}</Badge>
                              </TableCell>
                              <TableCell>{formatDate(user.createdAt)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-2"
                                    onClick={() => openEditDialog(user)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                    Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-2 text-destructive hover:text-destructive"
                                    disabled={isCurrentUser || deleteMutation.isPending}
                                    onClick={() => {
                                      if (window.confirm(t("managerUsers.deleteConfirm", { email: user.email }))) {
                                        deleteMutation.mutate(user.id);
                                      }
                                    }}
                                    title={isCurrentUser ? t("managerUsers.selfDeleteBlocked") : undefined}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {t("managerUsers.page", {
                      page: usersQuery.data?.page ?? 1,
                      pageCount,
                    })}
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                      {t("managerUsers.previous")}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={page >= pageCount}
                      onClick={() => setPage((value) => value + 1)}
                    >
                      {t("managerUsers.next")}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roles" className="space-y-4">
            <Card className="rounded-[28px] border-border/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Role Builder</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Role name</Label>
                    <Input value={roleName} onChange={(event) => setRoleName(event.target.value)} placeholder="Branch Manager" />
                  </div>
                  <div className="space-y-2">
                    <Label>Role code (optional)</Label>
                    <Input value={roleCode} onChange={(event) => setRoleCode(event.target.value)} placeholder="branch_manager" />
                  </div>
                </div>

                <div className="rounded-2xl border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <Label>Permission bundle</Label>
                    <Badge variant="outline">{permissionKeys.length} selected</Badge>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {permissionsByResource.map(([resource, items]) => (
                      <div key={resource} className="rounded-xl border p-3">
                        <div className="mb-2 text-sm font-semibold capitalize">{resource}</div>
                        <div className="space-y-2">
                          {items.map((item) => {
                            const checked = permissionKeys.includes(item.key);
                            return (
                              <label key={item.id} className="flex cursor-pointer items-start gap-2 text-sm">
                                <Checkbox checked={checked} onCheckedChange={(state) => togglePermission(item.key, Boolean(state))} />
                                <span>
                                  <span className="font-medium">{item.key}</span>
                                  <span className="block text-xs text-muted-foreground">{item.description || `${item.resource}.${item.action}`}</span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={submitCreateRole} disabled={createRoleMutation.isPending} className="gap-2">
                    {createRoleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Create role
                  </Button>
                </div>

                <div className="rounded-2xl border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Name</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Permissions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roles.map((role) => (
                        <TableRow key={role.id}>
                          <TableCell className="font-medium">{role.name}</TableCell>
                          <TableCell>{role.code}</TableCell>
                          <TableCell>
                            {role.isSystem ? <Badge>System</Badge> : <Badge variant="secondary">Custom</Badge>}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{role.permissions.length}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="permissions" className="space-y-4">
            <Card className="rounded-[28px] border-border/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Permission Catalog</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-2xl border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Key</TableHead>
                        <TableHead>Resource</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {permissions.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.key}</TableCell>
                          <TableCell>{item.resource}</TableCell>
                          <TableCell>{item.action}</TableCell>
                          <TableCell className="text-muted-foreground">{item.description || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit User Access</DialogTitle>
            <DialogDescription>
              Update identity fields, role bindings, and membership scopes in the new RBAC model.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={editName} onChange={(event) => setEditName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={editEmail} onChange={(event) => setEditEmail(event.target.value)} />
              </div>
            </div>

            <div className="rounded-2xl border p-4">
              <div className="mb-3 flex items-center justify-between">
                <Label>Role Bindings</Label>
                <Badge variant="outline">{editRoleCodes.length} selected</Badge>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {roles.map((role) => {
                  const checked = editRoleCodes.includes(role.code);
                  return (
                    <label key={role.id} className="flex cursor-pointer items-center gap-3 rounded-xl border p-3">
                      <Checkbox checked={checked} onCheckedChange={(state) => toggleEditRole(role.code, Boolean(state))} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{role.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{role.code}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-2">
                <Label>Branch ID</Label>
                <Input value={editBranchId} onChange={(event) => setEditBranchId(event.target.value)} placeholder="UUID or empty" />
              </div>
              <div className="space-y-2">
                <Label>Warehouse ID</Label>
                <Input value={editWarehouseId} onChange={(event) => setEditWarehouseId(event.target.value)} placeholder="UUID or empty" />
              </div>
              <div className="space-y-2">
                <Label>Customer Entity ID</Label>
                <Input value={editCustomerEntityId} onChange={(event) => setEditCustomerEntityId(event.target.value)} placeholder="UUID or empty" />
              </div>
              <div className="space-y-2">
                <Label>Driver Type</Label>
                <Select value={editDriverType} onValueChange={(value) => setEditDriverType(value as "none" | "local" | "linehaul")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="local">local</SelectItem>
                    <SelectItem value="linehaul">linehaul</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-2xl border p-4">
              <div className="mb-3 flex items-center justify-between">
                <Label>Membership Scopes</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() =>
                    setEditScopes((prev) => [...prev, { scopeType: "company", scopeRefId: "" }])
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add scope
                </Button>
              </div>
              <div className="space-y-2">
                {editScopes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Empty means default company scope will be used.</p>
                ) : (
                  editScopes.map((row, index) => (
                    <div key={`${index}-${row.scopeType}`} className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
                      <Select
                        value={row.scopeType}
                        onValueChange={(value) =>
                          setEditScopes((prev) =>
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
                        onChange={(event) =>
                          setEditScopes((prev) =>
                            prev.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, scopeRefId: event.target.value } : item,
                            ),
                          )
                        }
                        placeholder="scope_ref_id"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          setEditScopes((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveUserAccess} disabled={updateUserMutation.isPending}>
              {updateUserMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving
                </>
              ) : (
                "Save access"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
