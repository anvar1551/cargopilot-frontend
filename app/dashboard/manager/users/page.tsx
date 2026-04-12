"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, Users2 } from "lucide-react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { getRoleLabel } from "@/lib/i18n/labels";
import { getUser } from "@/lib/auth";
import { deleteUser, fetchUsers, type UserRole } from "@/lib/users";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageShell from "@/components/layout/PageShell";
import CreateUserDialog from "@/components/manager/users/CreateUserDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 10;

const ROLE_TONE: Record<UserRole, string> = {
  customer: "bg-sky-500/10 text-sky-700 border-sky-500/20",
  driver: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  warehouse: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  manager: "bg-violet-500/10 text-violet-700 border-violet-500/20",
};

export default function UsersPage() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [role, setRole] = useState<UserRole | undefined>();
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const currentUser = useMemo(() => getUser(), []);

  const query = useQuery({
    queryKey: ["users", q, role, page],
    queryFn: ({ signal }) =>
      fetchUsers(
        {
          q: q || undefined,
          role,
          page,
          limit: PAGE_SIZE,
        },
        signal,
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: async (data) => {
      toast.success(data.message || t("managerUsers.deleteSuccess"));
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: unknown) => {
      const message =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { error?: unknown } } }).response?.data
          ?.error === "string"
          ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
          : t("managerUsers.deleteFailed");

      toast.error(message);
    },
  });

  const users = query.data?.data ?? [];
  const total = query.data?.total ?? 0;

  const handleDelete = (userId: string, email: string) => {
    const confirmed = window.confirm(
      t("managerUsers.deleteConfirm", { email }),
    );
    if (!confirmed) return;
    deleteMutation.mutate(userId);
  };

  return (
    <PageShell>
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[28px] border border-border/70 bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-900 text-white">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.22),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.16),transparent_42%)]" />
          <div className="relative flex flex-col gap-5 p-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-slate-100/90">
                <Users2 className="h-3.5 w-3.5" />
                {t("managerUsers.pill")}
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">{t("managerUsers.title")}</h1>
                <p className="max-w-2xl text-sm text-slate-200/80">{t("managerUsers.subtitle")}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-right">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-300/70">
                  {t("managerUsers.visibleUsers")}
                </div>
                <div className="text-2xl font-semibold">{total}</div>
              </div>
              <CreateUserDialog />
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-border/70 bg-background/95 p-5 shadow-sm shadow-black/5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row">
              <Input
                placeholder={t("managerUsers.searchPlaceholder")}
                value={q}
                onChange={(event) => {
                  setPage(1);
                  setQ(event.target.value);
                }}
                className="max-w-xl"
              />

              <Select
                value={role ?? "all"}
                onValueChange={(value) => {
                  setPage(1);
                  setRole(value === "all" ? undefined : (value as UserRole));
                }}
              >
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder={t("managerUsers.allRoles")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("managerUsers.allRoles")}</SelectItem>
                  <SelectItem value="customer">{t("common.role.customer")}</SelectItem>
                  <SelectItem value="driver">{t("common.role.driver")}</SelectItem>
                  <SelectItem value="warehouse">{t("common.role.warehouse")}</SelectItem>
                  <SelectItem value="manager">{t("common.role.manager")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="text-sm text-muted-foreground">
              {query.isFetching
                ? t("managerUsers.refreshing")
                : t("managerUsers.rowsOnPage", { count: users.length })}
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-3xl border border-border/70">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>{t("managerUsers.name")}</TableHead>
                  <TableHead>{t("managerUsers.email")}</TableHead>
                  <TableHead>{t("managerUsers.role")}</TableHead>
                  <TableHead>{t("managerUsers.customer")}</TableHead>
                  <TableHead>{t("managerUsers.warehouse")}</TableHead>
                  <TableHead>{t("managerUsers.created")}</TableHead>
                  <TableHead className="text-right">{t("managerUsers.actions")}</TableHead>
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
                        <TableCell>
                          <div className="font-medium">{user.name}</div>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`capitalize ${ROLE_TONE[user.role]}`}>
                            {getRoleLabel(user.role, t)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.customerEntity?.companyName ?? user.customerEntity?.name ?? "-"}
                        </TableCell>
                        <TableCell>{user.warehouse?.name ?? "-"}</TableCell>
                        <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-2 text-destructive hover:text-destructive"
                            disabled={isCurrentUser || deleteMutation.isPending}
                            onClick={() => handleDelete(user.id, user.email)}
                            title={isCurrentUser ? t("managerUsers.selfDeleteBlocked") : undefined}
                          >
                            <Trash2 className="h-4 w-4" />
                            {t("managerUsers.delete")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {t("managerUsers.page", {
              page: query.data?.page ?? 1,
              pageCount: query.data?.pageCount ?? 1,
            })}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              {t("managerUsers.previous")}
            </Button>
            <Button
              variant="outline"
              disabled={page >= (query.data?.pageCount ?? 1)}
              onClick={() => setPage((value) => value + 1)}
            >
              {t("managerUsers.next")}
            </Button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
