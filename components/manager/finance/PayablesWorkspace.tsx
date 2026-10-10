"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Loader2,
  Plus,
  RefreshCw,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import {
  FinanceEmptyState,
  FinancePager,
  FinanceStatusBadge,
  MetricCard,
  decimalLessThanOrEqual,
  financeErrorMessage,
  formatDate,
  formatMoney,
  isPositiveDecimal,
  sumDecimals,
} from "@/components/manager/finance/finance-ui";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  createPaymentRun,
  getPayablesAging,
  listBankAccounts,
  type FinanceCurrency,
  type PayableAgingItem,
} from "@/lib/finance";

const today = () => new Date().toISOString().slice(0, 10);

export default function PayablesWorkspace({ user }: { user: AuthUser | null }) {
  const queryClient = useQueryClient();
  const canCreateRun = hasPermission(user, "finance.treasury.manage");
  const [asOf, setAsOf] = useState(today());
  const [currency, setCurrency] = useState<FinanceCurrency | "all">("all");
  const [cursor, setCursor] = useState<string | undefined>();
  const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>(
    [],
  );
  const [selected, setSelected] = useState<Record<string, PayableAgingItem>>(
    {},
  );
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [bankAccountId, setBankAccountId] = useState("");
  const [paymentDate, setPaymentDate] = useState(today());
  const [fxRate, setFxRate] = useState("1");
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const agingQuery = useQuery({
    queryKey: ["finance", "payables-aging", asOf, currency, cursor],
    queryFn: () =>
      getPayablesAging({
        asOf,
        cursor,
        limit: 25,
        ...(currency === "all" ? {} : { currency }),
      }),
  });

  const accountsQuery = useQuery({
    queryKey: ["finance", "bank-accounts", "active-for-runs"],
    queryFn: () => listBankAccounts({ status: "active", limit: 100 }),
    enabled: runDialogOpen,
  });

  const selectedItems = useMemo(() => Object.values(selected), [selected]);
  const selectedCurrency = selectedItems[0]?.currency;
  const selectedTotal = useMemo(
    () =>
      sumDecimals(
        selectedItems.map((item) => amounts[item.id] ?? item.outstandingAmount),
      ),
    [amounts, selectedItems],
  );
  const matchingAccounts = useMemo(
    () =>
      (accountsQuery.data?.items ?? []).filter(
        (account) => account.currency === selectedCurrency && account.isActive,
      ),
    [accountsQuery.data, selectedCurrency],
  );

  const createRunMutation = useMutation({
    mutationFn: () => {
      if (!selectedCurrency) throw new Error("Select at least one payable");
      return createPaymentRun({
        bankAccountId,
        idempotencyKey: `payment-run:${crypto.randomUUID()}`,
        paymentDate,
        currency: selectedCurrency,
        fxRate,
        fxRateAsOf: new Date().toISOString(),
        lines: selectedItems.map((item) => ({
          payableItemId: item.id,
          amount: amounts[item.id] ?? item.outstandingAmount,
        })),
      });
    },
    onSuccess: (run) => {
      toast.success(`Payment run ${run.runNumber} created as draft`);
      setSelected({});
      setAmounts({});
      setBankAccountId("");
      setRunDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
    onError: (error) =>
      toast.error(financeErrorMessage(error, "Failed to create payment run")),
  });

  const togglePayable = (item: PayableAgingItem, checked: boolean) => {
    if (!checked) {
      setSelected((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      setAmounts((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      return;
    }
    if (selectedCurrency && selectedCurrency !== item.currency) {
      toast.error("A payment run can contain only one currency");
      return;
    }
    setSelected((current) => ({ ...current, [item.id]: item }));
    setAmounts((current) => ({
      ...current,
      [item.id]: item.outstandingAmount,
    }));
  };

  const resetPaging = () => {
    setCursor(undefined);
    setCursorHistory([]);
    setSelected({});
    setAmounts({});
  };
  const validAmounts = selectedItems.every((item) => {
    const amount = amounts[item.id] ?? "0";
    return (
      isPositiveDecimal(amount) &&
      decimalLessThanOrEqual(amount, item.outstandingAmount)
    );
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(agingQuery.data?.summary ?? []).map((summary) => (
          <MetricCard
            key={summary.currency}
            label={`${summary.currency} payable exposure`}
            value={formatMoney(summary.total, summary.currency)}
            detail={`${formatMoney(summary.daysOver90, summary.currency)} over 90 days`}
            tone={
              summary.currency === "UZS"
                ? "teal"
                : summary.currency === "USD"
                  ? "blue"
                  : "amber"
            }
          />
        ))}
        {!agingQuery.data?.summary.length ? (
          <MetricCard
            label="Payable exposure"
            value="No open balance"
            detail={`As of ${formatDate(asOf)}`}
          />
        ) : null}
      </div>

      <Card className="overflow-hidden rounded-3xl">
        <CardHeader className="border-b bg-slate-50/60 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Accounts payable aging</CardTitle>
            <CardDescription>
              Outstanding carrier bills ordered by due date. Totals remain
              separated by transaction currency.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="date"
                value={asOf}
                onChange={(event) => {
                  setAsOf(event.target.value);
                  resetPaging();
                }}
                className="w-40 pl-9 bg-white"
              />
            </div>
            <Select
              value={currency}
              onValueChange={(value) => {
                setCurrency(value as FinanceCurrency | "all");
                resetPaging();
              }}
            >
              <SelectTrigger className="w-36 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All currencies</SelectItem>
                {["UZS", "USD", "CNY"].map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => void agingQuery.refetch()}
              disabled={agingQuery.isFetching}
            >
              <RefreshCw
                className={agingQuery.isFetching ? "animate-spin" : ""}
              />{" "}
              Refresh
            </Button>
            {canCreateRun ? (
              <Button
                onClick={() => setRunDialogOpen(true)}
                disabled={!selectedItems.length}
              >
                <WalletCards /> Create run ({selectedItems.length})
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {agingQuery.isLoading ? (
            <div className="flex min-h-52 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : agingQuery.data?.items.length ? (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-2xl border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="w-10" />
                      <TableHead>Bill</TableHead>
                      <TableHead>Carrier</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Original</TableHead>
                      <TableHead>Outstanding</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agingQuery.data.items.map((item) => (
                      <TableRow
                        key={item.id}
                        data-state={selected[item.id] ? "selected" : undefined}
                      >
                        <TableCell>
                          <Checkbox
                            checked={Boolean(selected[item.id])}
                            onCheckedChange={(checked) =>
                              togglePayable(item, checked === true)
                            }
                            disabled={
                              !canCreateRun ||
                              Boolean(
                                selectedCurrency &&
                                selectedCurrency !== item.currency,
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <p className="font-semibold">{item.billNumber}</p>
                          <p className="text-xs text-slate-500">
                            Invoice {item.supplierInvoiceNumber}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p>{item.carrierCode}</p>
                          <p className="text-xs text-slate-500">
                            Document {formatDate(item.documentDate)}
                          </p>
                        </TableCell>
                        <TableCell
                          className={
                            new Date(item.dueDate) < new Date(asOf)
                              ? "font-semibold text-rose-700"
                              : ""
                          }
                        >
                          {formatDate(item.dueDate)}
                        </TableCell>
                        <TableCell>
                          {formatMoney(item.originalAmount, item.currency)}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatMoney(item.outstandingAmount, item.currency)}
                        </TableCell>
                        <TableCell>
                          <FinanceStatusBadge status={item.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <FinancePager
                page={cursorHistory.length + 1}
                canPrevious={cursorHistory.length > 0}
                canNext={Boolean(agingQuery.data.nextCursor)}
                onPrevious={() => {
                  const history = [...cursorHistory];
                  setCursor(history.pop());
                  setCursorHistory(history);
                }}
                onNext={() => {
                  if (!agingQuery.data?.nextCursor) return;
                  setCursorHistory((current) => [...current, cursor]);
                  setCursor(agingQuery.data.nextCursor ?? undefined);
                }}
              />
            </div>
          ) : (
            <FinanceEmptyState
              title="No outstanding payables"
              description="Approved carrier bills with an unpaid balance will appear here automatically."
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={runDialogOpen} onOpenChange={setRunDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-hidden sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Create payment run</DialogTitle>
            <DialogDescription>
              Build a draft from selected {selectedCurrency} payables. A
              different user must approve it before execution.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 overflow-y-auto pr-1">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Bank account</Label>
                <Select value={bankAccountId} onValueChange={setBankAccountId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select matching account" />
                  </SelectTrigger>
                  <SelectContent>
                    {matchingAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} · {account.accountIdentifierMasked}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {accountsQuery.isSuccess && !matchingAccounts.length ? (
                  <p className="text-xs text-rose-600">
                    No active {selectedCurrency} bank account exists.
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Payment date</Label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(event) => setPaymentDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>FX rate snapshot</Label>
                <Input
                  inputMode="decimal"
                  value={fxRate}
                  onChange={(event) => setFxRate(event.target.value)}
                />
                <p className="text-xs text-slate-500">
                  Explicitly recorded for audit, including rate 1.
                </p>
              </div>
            </div>
            <div className="overflow-x-auto rounded-2xl border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Bill</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead className="w-48">Pay amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="font-medium">{item.billNumber}</p>
                        <p className="text-xs text-slate-500">
                          {item.carrierCode}
                        </p>
                      </TableCell>
                      <TableCell>{formatDate(item.dueDate)}</TableCell>
                      <TableCell>
                        {formatMoney(item.outstandingAmount, item.currency)}
                      </TableCell>
                      <TableCell>
                        <Input
                          inputMode="decimal"
                          value={amounts[item.id] ?? ""}
                          onChange={(event) =>
                            setAmounts((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end text-lg font-bold">
              Run total: {formatMoney(selectedTotal, selectedCurrency ?? "")}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRunDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                !bankAccountId ||
                !paymentDate ||
                !isPositiveDecimal(fxRate, 10) ||
                !validAmounts ||
                createRunMutation.isPending
              }
              onClick={() => createRunMutation.mutate()}
            >
              {createRunMutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Plus />
              )}{" "}
              Create draft run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
