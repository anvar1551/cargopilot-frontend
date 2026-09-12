"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  FinanceEmptyState,
  FinancePager,
  FinanceStatusBadge,
  financeErrorMessage,
  formatDate,
} from "@/components/manager/finance/finance-ui";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { hasPermission, type AuthUser } from "@/lib/auth";
import {
  changeBankAccountStatus,
  createBankAccount,
  listBankAccounts,
  type FinanceCurrency,
} from "@/lib/finance";

const EMPTY_FORM = {
  code: "",
  name: "",
  bankName: "",
  accountIdentifier: "",
  currency: "UZS" as FinanceCurrency,
};

export default function BankAccountsWorkspace({
  user,
}: {
  user: AuthUser | null;
}) {
  const queryClient = useQueryClient();
  const canManage = hasPermission(user, "finance.treasury.manage");
  const [cursor, setCursor] = useState<string | undefined>();
  const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>(
    [],
  );
  const [status, setStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const accountsQuery = useQuery({
    queryKey: ["finance", "bank-accounts", cursor, status],
    queryFn: () =>
      listBankAccounts({
        cursor,
        limit: 25,
        ...(status === "all" ? {} : { status }),
      }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createBankAccount({
        ...form,
        idempotencyKey: `bank-account:${crypto.randomUUID()}`,
      }),
    onSuccess: () => {
      toast.success("Bank account created");
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      void queryClient.invalidateQueries({
        queryKey: ["finance", "bank-accounts"],
      });
    },
    onError: (error) =>
      toast.error(financeErrorMessage(error, "Failed to create bank account")),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      changeBankAccountStatus(id, isActive),
    onSuccess: () => {
      toast.success("Bank account status updated");
      void queryClient.invalidateQueries({
        queryKey: ["finance", "bank-accounts"],
      });
    },
    onError: (error) =>
      toast.error(financeErrorMessage(error, "Failed to update bank account")),
  });

  const canCreate = useMemo(
    () =>
      Boolean(
        form.code.trim() &&
        form.name.trim() &&
        form.bankName.trim() &&
        form.accountIdentifier.trim(),
      ),
    [form],
  );

  return (
    <Card className="overflow-hidden rounded-3xl">
      <CardHeader className="border-b bg-slate-50/60 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Bank account registry</CardTitle>
          <CardDescription>
            Company-owned settlement accounts. Full identifiers are protected
            and never returned.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setCursor(undefined);
              setCursorHistory([]);
            }}
          >
            <SelectTrigger className="w-36 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => void accountsQuery.refetch()}
            disabled={accountsQuery.isFetching}
          >
            <RefreshCw
              className={accountsQuery.isFetching ? "animate-spin" : ""}
            />{" "}
            Refresh
          </Button>
          {canManage ? (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus /> Add account
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {accountsQuery.isLoading ? (
          <div className="flex min-h-52 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : accountsQuery.data?.items.length ? (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-2xl border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Account</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead>Identifier</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accountsQuery.data.items.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <p className="font-semibold">{account.name}</p>
                        <p className="text-xs text-slate-500">{account.code}</p>
                      </TableCell>
                      <TableCell>{account.bankName}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {account.accountIdentifierMasked}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {account.currency}
                      </TableCell>
                      <TableCell>
                        <FinanceStatusBadge
                          status={account.isActive ? "active" : "inactive"}
                        />
                      </TableCell>
                      <TableCell>{formatDate(account.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        {canManage ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={statusMutation.isPending}
                            onClick={() =>
                              statusMutation.mutate({
                                id: account.id,
                                isActive: !account.isActive,
                              })
                            }
                          >
                            {account.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <FinancePager
              page={cursorHistory.length + 1}
              canPrevious={cursorHistory.length > 0}
              canNext={Boolean(
                accountsQuery.data.pageInfo.hasMore &&
                accountsQuery.data.pageInfo.nextCursor,
              )}
              onPrevious={() => {
                const history = [...cursorHistory];
                setCursor(history.pop());
                setCursorHistory(history);
              }}
              onNext={() => {
                if (!accountsQuery.data?.pageInfo.nextCursor) return;
                setCursorHistory((current) => [...current, cursor]);
                setCursor(accountsQuery.data.pageInfo.nextCursor ?? undefined);
              }}
            />
          </div>
        ) : (
          <FinanceEmptyState
            title="No bank accounts"
            description="Create the first active settlement account before building a payment run or importing a bank statement."
          />
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-teal-700" /> Register bank
              account
            </DialogTitle>
            <DialogDescription>
              The raw identifier is write-only. Only a one-way fingerprint and
              masked display value are retained.
            </DialogDescription>
          </DialogHeader>
          <div className="grid overflow-y-auto pr-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Internal code</Label>
              <Input
                value={form.code}
                onChange={(event) =>
                  setForm({ ...form, code: event.target.value })
                }
                placeholder="UZS-OPERATING"
              />
            </div>
            <div className="space-y-2">
              <Label>Account name</Label>
              <Input
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                placeholder="UZS operating account"
              />
            </div>
            <div className="space-y-2">
              <Label>Bank name</Label>
              <Input
                value={form.bankName}
                onChange={(event) =>
                  setForm({ ...form, bankName: event.target.value })
                }
                placeholder="Bank name"
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select
                value={form.currency}
                onValueChange={(currency) =>
                  setForm({ ...form, currency: currency as FinanceCurrency })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["UZS", "USD", "CNY"].map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Account identifier / IBAN</Label>
              <Input
                value={form.accountIdentifier}
                onChange={(event) =>
                  setForm({ ...form, accountIdentifier: event.target.value })
                }
                placeholder="Enter once; only the masked value remains visible"
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!canCreate || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Plus />
              )}{" "}
              Create account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
