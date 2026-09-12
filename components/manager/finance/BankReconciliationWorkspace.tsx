"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Eye,
  FileUp,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  FinanceEmptyState,
  FinancePager,
  FinanceStatusBadge,
  decimalEquals,
  financeErrorMessage,
  formatDate,
  formatMoney,
  isPositiveDecimal,
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
import { Textarea } from "@/components/ui/textarea";
import { hasPermission, type AuthUser } from "@/lib/auth";
import {
  approveBankStatement,
  createBankStatement,
  getBankStatement,
  ignoreBankStatementLine,
  listBankAccounts,
  listBankStatements,
  listPaymentRuns,
  listProviderSettlements,
  reconcileBankStatementLine,
  rejectBankStatement,
  submitBankStatement,
  type BankStatementLine,
  type FinanceCurrency,
} from "@/lib/finance";

type ImportLine = {
  bookingDate: string;
  valueDate: string;
  direction: "debit" | "credit";
  amount: string;
  externalTransactionId: string;
  description: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = (): ImportLine => ({
  bookingDate: today(),
  valueDate: "",
  direction: "debit",
  amount: "",
  externalTransactionId: "",
  description: "",
});

function parseCsvRow(row: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];
    if (character === '"' && quoted && row[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else value += character;
  }
  values.push(value.trim());
  return values;
}

function normalizeHeader(value: string) {
  return value.replace(/[^a-zA-Z]/g, "").toLowerCase();
}

function parseStatementCsv(text: string): ImportLine[] {
  const rows = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((row) => row.trim());
  if (rows.length < 2)
    throw new Error("CSV must contain a header and at least one line");
  const headers = parseCsvRow(rows[0]).map(normalizeHeader);
  const required = ["bookingdate", "direction", "amount"];
  if (required.some((header) => !headers.includes(header))) {
    throw new Error("CSV requires bookingDate, direction, and amount columns");
  }
  const at = (values: string[], name: string) =>
    values[headers.indexOf(name)] ?? "";
  return rows.slice(1).map((row, index) => {
    const values = parseCsvRow(row);
    const direction = at(values, "direction").toLowerCase();
    if (direction !== "debit" && direction !== "credit")
      throw new Error(`Line ${index + 2} has invalid direction`);
    return {
      bookingDate: at(values, "bookingdate"),
      valueDate: at(values, "valuedate"),
      direction,
      amount: at(values, "amount"),
      externalTransactionId: at(values, "externaltransactionid"),
      description: at(values, "description"),
    };
  });
}

export default function BankReconciliationWorkspace({
  user,
}: {
  user: AuthUser | null;
}) {
  const queryClient = useQueryClient();
  const canManage = hasPermission(user, "finance.bankReconciliation.manage");
  const canApprove = hasPermission(user, "finance.bankReconciliation.approve");
  const canReadPaymentRuns = hasPermission(user, "finance.treasury.read");
  const canReadSettlements = hasPermission(user, "finance.settlements.read");
  const [cursor, setCursor] = useState<string | undefined>();
  const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>(
    [],
  );
  const [status, setStatus] = useState("all");
  const [importOpen, setImportOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statementForm, setStatementForm] = useState({
    bankAccountId: "",
    statementNumber: "",
    periodStart: today(),
    periodEnd: today(),
    currency: "UZS" as FinanceCurrency,
    openingBalance: "0",
    reportedClosingBalance: "0",
  });
  const [importLines, setImportLines] = useState<ImportLine[]>([emptyLine()]);
  const [selectedLine, setSelectedLine] = useState<BankStatementLine | null>(
    null,
  );
  const [targetType, setTargetType] = useState<
    "payment_run" | "provider_settlement"
  >(canReadPaymentRuns ? "payment_run" : "provider_settlement");
  const [targetId, setTargetId] = useState("");
  const [ignoreReason, setIgnoreReason] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const statementsQuery = useQuery({
    queryKey: ["finance", "bank-statements", cursor, status],
    queryFn: () =>
      listBankStatements({
        cursor,
        limit: 25,
        ...(status === "all" ? {} : { status }),
      }),
  });
  const accountsQuery = useQuery({
    queryKey: ["finance", "bank-accounts", "for-statements"],
    queryFn: () => listBankAccounts({ status: "active", limit: 100 }),
    enabled: importOpen,
  });
  const detailQuery = useQuery({
    queryKey: ["finance", "bank-statement", selectedId],
    queryFn: () => getBankStatement(selectedId!),
    enabled: Boolean(selectedId),
  });
  const paymentTargetsQuery = useQuery({
    queryKey: ["finance", "payment-runs", "executed-targets"],
    queryFn: () => listPaymentRuns({ status: "executed", limit: 100 }),
    enabled:
      Boolean(selectedLine) &&
      targetType === "payment_run" &&
      canReadPaymentRuns,
  });
  const settlementTargetsQuery = useQuery({
    queryKey: ["finance", "provider-settlements", "approved-targets"],
    queryFn: () => listProviderSettlements({ status: "approved", limit: 100 }),
    enabled:
      Boolean(selectedLine) &&
      targetType === "provider_settlement" &&
      canReadSettlements,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createBankStatement({
        ...statementForm,
        idempotencyKey: `bank-statement:${crypto.randomUUID()}`,
        lines: importLines.map((line) => ({
          bookingDate: line.bookingDate,
          valueDate: line.valueDate || null,
          direction: line.direction,
          amount: line.amount,
          externalTransactionId: line.externalTransactionId || null,
          description: line.description || null,
        })),
      }),
    onSuccess: (statement) => {
      toast.success(`Statement ${statement.statementNumber} imported`);
      setImportOpen(false);
      setImportLines([emptyLine()]);
      setStatementForm({
        bankAccountId: "",
        statementNumber: "",
        periodStart: today(),
        periodEnd: today(),
        currency: "UZS",
        openingBalance: "0",
        reportedClosingBalance: "0",
      });
      void queryClient.invalidateQueries({
        queryKey: ["finance", "bank-statements"],
      });
    },
    onError: (error) =>
      toast.error(
        financeErrorMessage(error, "Failed to import bank statement"),
      ),
  });

  const lineMutation = useMutation({
    mutationFn: ({ mode }: { mode: "reconcile" | "ignore" }) => {
      if (!selectedId || !selectedLine)
        throw new Error("Select a statement line");
      return mode === "reconcile"
        ? reconcileBankStatementLine(selectedId, selectedLine.id, {
            targetType,
            targetId,
          })
        : ignoreBankStatementLine(selectedId, selectedLine.id, ignoreReason);
    },
    onSuccess: (statement) => {
      toast.success("Statement line updated");
      queryClient.setQueryData(
        ["finance", "bank-statement", statement.id],
        statement,
      );
      setSelectedLine(null);
      setTargetId("");
      setIgnoreReason("");
      void queryClient.invalidateQueries({
        queryKey: ["finance", "bank-statements"],
      });
    },
    onError: (error) =>
      toast.error(
        financeErrorMessage(error, "Failed to update statement line"),
      ),
  });

  const workflowMutation = useMutation({
    mutationFn: ({
      action,
      id,
    }: {
      action: "submit" | "approve" | "reject";
      id: string;
    }) =>
      action === "submit"
        ? submitBankStatement(id)
        : action === "approve"
          ? approveBankStatement(id)
          : rejectBankStatement(id, rejectionReason),
    onSuccess: (statement, variables) => {
      toast.success(`Statement ${variables.action} completed`);
      queryClient.setQueryData(
        ["finance", "bank-statement", statement.id],
        statement,
      );
      setRejectionReason("");
      void queryClient.invalidateQueries({
        queryKey: ["finance", "bank-statements"],
      });
    },
    onError: (error) =>
      toast.error(financeErrorMessage(error, "Statement workflow failed")),
  });

  const statement = detailQuery.data;
  const validImport = Boolean(
    statementForm.bankAccountId &&
    statementForm.statementNumber.trim() &&
    importLines.length &&
    importLines.every(
      (line) => line.bookingDate && isPositiveDecimal(line.amount),
    ),
  );
  const targetOptions = useMemo(() => {
    if (!selectedLine) return [];
    if (targetType === "payment_run")
      return (paymentTargetsQuery.data?.items ?? [])
        .filter(
          (run) =>
            run.currency === statement?.currency &&
            run.bankAccountId === statement?.bankAccountId &&
            decimalEquals(run.totalAmount, selectedLine.amount),
        )
        .map((run) => ({
          id: run.id,
          label: `${run.runNumber} Â· ${formatMoney(run.totalAmount, run.currency)}`,
        }));
    return (settlementTargetsQuery.data?.items ?? [])
      .filter(
        (item) =>
          item.currency === statement?.currency &&
          decimalEquals(item.netAmount, selectedLine.amount),
      )
      .map((item) => ({
        id: item.id,
        label: `${item.settlementNumber} Â· ${item.providerCode} Â· ${formatMoney(item.netAmount, item.currency)}`,
      }));
  }, [
    paymentTargetsQuery.data,
    selectedLine,
    settlementTargetsQuery.data,
    statement,
    targetType,
  ]);

  const updateLine = (index: number, patch: Partial<ImportLine>) =>
    setImportLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    );
  const loadCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = parseStatementCsv(await file.text());
      setImportLines(parsed);
      toast.success(`${parsed.length} statement lines loaded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid CSV file");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <Card className="overflow-hidden rounded-3xl">
      <CardHeader className="border-b bg-slate-50/60 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Bank reconciliation</CardTitle>
          <CardDescription>
            Import statements, match exact treasury documents, resolve
            exceptions, then submit for independent approval.
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
            <SelectTrigger className="w-40 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {["draft", "submitted", "approved", "rejected"].map((item) => (
                <SelectItem key={item} value={item} className="capitalize">
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => void statementsQuery.refetch()}
            disabled={statementsQuery.isFetching}
          >
            <RefreshCw
              className={statementsQuery.isFetching ? "animate-spin" : ""}
            />{" "}
            Refresh
          </Button>
          {canManage ? (
            <Button onClick={() => setImportOpen(true)}>
              <FileUp /> Import statement
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {statementsQuery.isLoading ? (
          <div className="flex min-h-52 items-center justify-center">
            <Loader2 className="animate-spin text-slate-400" />
          </div>
        ) : statementsQuery.data?.items.length ? (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-2xl border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Statement</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Lines</TableHead>
                    <TableHead>Closing balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statementsQuery.data.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="font-semibold">{item.statementNumber}</p>
                        <p className="text-xs text-slate-500">
                          Imported {formatDate(item.createdAt, true)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p>{item.bankAccount.name}</p>
                        <p className="text-xs text-slate-500">
                          {item.bankAccount.accountIdentifierMasked}
                        </p>
                      </TableCell>
                      <TableCell>
                        {formatDate(item.periodStart)} -{" "}
                        {formatDate(item.periodEnd)}
                      </TableCell>
                      <TableCell>{item._count?.lines ?? "-"}</TableCell>
                      <TableCell className="font-semibold">
                        {formatMoney(item.closingBalance, item.currency)}
                      </TableCell>
                      <TableCell>
                        <FinanceStatusBadge status={item.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedId(item.id)}
                        >
                          <Eye /> Reconcile
                        </Button>
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
                statementsQuery.data.pageInfo.hasMore &&
                statementsQuery.data.pageInfo.nextCursor,
              )}
              onPrevious={() => {
                const history = [...cursorHistory];
                setCursor(history.pop());
                setCursorHistory(history);
              }}
              onNext={() => {
                const next = statementsQuery.data?.pageInfo.nextCursor;
                if (!next) return;
                setCursorHistory((current) => [...current, cursor]);
                setCursor(next);
              }}
            />
          </div>
        ) : (
          <FinanceEmptyState
            title="No bank statements"
            description="Import a CSV or enter statement lines manually to start reconciliation."
          />
        )}
      </CardContent>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-h-[94vh] overflow-hidden sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>Import bank statement</DialogTitle>
            <DialogDescription>
              CSV columns: bookingDate, valueDate, direction, amount,
              externalTransactionId, description. Direction must be debit or
              credit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 overflow-y-auto pr-1">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Bank account</Label>
                <Select
                  value={statementForm.bankAccountId}
                  onValueChange={(id) => {
                    const account = accountsQuery.data?.items.find(
                      (item) => item.id === id,
                    );
                    setStatementForm((current) => ({
                      ...current,
                      bankAccountId: id,
                      currency: account?.currency ?? current.currency,
                    }));
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select active account" />
                  </SelectTrigger>
                  <SelectContent>
                    {(accountsQuery.data?.items ?? []).map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} Â· {account.currency} Â·{" "}
                        {account.accountIdentifierMasked}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Statement number</Label>
                <Input
                  value={statementForm.statementNumber}
                  onChange={(event) =>
                    setStatementForm({
                      ...statementForm,
                      statementNumber: event.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input value={statementForm.currency} disabled />
              </div>
              <div className="space-y-2">
                <Label>Period start</Label>
                <Input
                  type="date"
                  value={statementForm.periodStart}
                  onChange={(event) =>
                    setStatementForm({
                      ...statementForm,
                      periodStart: event.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Period end</Label>
                <Input
                  type="date"
                  value={statementForm.periodEnd}
                  onChange={(event) =>
                    setStatementForm({
                      ...statementForm,
                      periodEnd: event.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Opening balance</Label>
                <Input
                  inputMode="decimal"
                  value={statementForm.openingBalance}
                  onChange={(event) =>
                    setStatementForm({
                      ...statementForm,
                      openingBalance: event.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Reported closing balance</Label>
                <Input
                  inputMode="decimal"
                  value={statementForm.reportedClosingBalance}
                  onChange={(event) =>
                    setStatementForm({
                      ...statementForm,
                      reportedClosingBalance: event.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">Statement lines</p>
                <p className="text-xs text-slate-500">
                  Review imported data before saving the draft.
                </p>
              </div>
              <div className="flex gap-2">
                <Label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border bg-white px-3 shadow-sm">
                  <FileUp className="h-4 w-4" /> Load CSV
                  <Input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={loadCsv}
                  />
                </Label>
                <Button
                  variant="outline"
                  onClick={() =>
                    setImportLines((current) => [...current, emptyLine()])
                  }
                >
                  <Plus /> Add line
                </Button>
              </div>
            </div>
            <div className="space-y-3">
              {importLines.map((line, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-2xl border bg-slate-50/50 p-3 md:grid-cols-12"
                >
                  <div className="space-y-1 md:col-span-2">
                    <Label>Booking date</Label>
                    <Input
                      type="date"
                      value={line.bookingDate}
                      onChange={(event) =>
                        updateLine(index, { bookingDate: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label>Value date</Label>
                    <Input
                      type="date"
                      value={line.valueDate}
                      onChange={(event) =>
                        updateLine(index, { valueDate: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label>Direction</Label>
                    <Select
                      value={line.direction}
                      onValueChange={(value) =>
                        updateLine(index, {
                          direction: value as "debit" | "credit",
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="debit">Debit</SelectItem>
                        <SelectItem value="credit">Credit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label>Amount</Label>
                    <Input
                      inputMode="decimal"
                      value={line.amount}
                      onChange={(event) =>
                        updateLine(index, { amount: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1 md:col-span-3">
                    <Label>Bank reference / description</Label>
                    <Input
                      value={line.externalTransactionId}
                      onChange={(event) =>
                        updateLine(index, {
                          externalTransactionId: event.target.value,
                        })
                      }
                      placeholder="External transaction ID"
                    />
                  </div>
                  <div className="flex items-end md:col-span-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={importLines.length === 1}
                      onClick={() =>
                        setImportLines((current) =>
                          current.filter((_, lineIndex) => lineIndex !== index),
                        )
                      }
                    >
                      <Trash2 className="text-rose-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!validImport || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <FileUp />
              )}{" "}
              Import draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
            setSelectedLine(null);
            setRejectionReason("");
          }
        }}
      >
        <DialogContent className="max-h-[94vh] overflow-hidden sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>
              {statement
                ? `Statement ${statement.statementNumber}`
                : "Loading statement"}
            </DialogTitle>
            <DialogDescription>
              All lines must be matched or explicitly ignored before submission.
            </DialogDescription>
          </DialogHeader>
          {detailQuery.isLoading || !statement ? (
            <div className="flex min-h-52 items-center justify-center">
              <Loader2 className="animate-spin" />
            </div>
          ) : (
            <div className="space-y-5 overflow-y-auto pr-1">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-slate-500">Status</p>
                  <div className="mt-2">
                    <FinanceStatusBadge status={statement.status} />
                  </div>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-slate-500">Opening</p>
                  <p className="mt-1 font-bold">
                    {formatMoney(statement.openingBalance, statement.currency)}
                  </p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-slate-500">Debits</p>
                  <p className="mt-1 font-bold">
                    {formatMoney(statement.totalDebits, statement.currency)}
                  </p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-slate-500">Credits</p>
                  <p className="mt-1 font-bold">
                    {formatMoney(statement.totalCredits, statement.currency)}
                  </p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-slate-500">Closing</p>
                  <p className="mt-1 font-bold">
                    {formatMoney(statement.closingBalance, statement.currency)}
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto rounded-2xl border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>#</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Reconciliation</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(statement.lines ?? []).map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>{line.sequence}</TableCell>
                        <TableCell>{formatDate(line.bookingDate)}</TableCell>
                        <TableCell className="capitalize">
                          {line.direction}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatMoney(line.amount, statement.currency)}
                        </TableCell>
                        <TableCell>
                          <p>{line.externalTransactionId || "-"}</p>
                          <p className="max-w-56 truncate text-xs text-slate-500">
                            {line.description}
                          </p>
                        </TableCell>
                        <TableCell>
                          <FinanceStatusBadge
                            status={line.reconciliationStatus}
                          />
                          {line.reconciliationMessage ? (
                            <p className="mt-1 text-xs text-slate-500">
                              {line.reconciliationMessage}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">
                          {statement.status === "draft" &&
                          line.reconciliationStatus === "unmatched" &&
                          canManage ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedLine(line);
                                setTargetType(
                                  canReadPaymentRuns
                                    ? "payment_run"
                                    : "provider_settlement",
                                );
                                setTargetId("");
                                setIgnoreReason("");
                              }}
                            >
                              Resolve
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
              {statement.status === "submitted" && canApprove ? (
                <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
                  <Label>Rejection reason</Label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    className="mt-2 bg-white"
                  />
                </div>
              ) : null}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedId(null)}>
              Close
            </Button>
            {statement?.status === "draft" && canManage ? (
              <Button
                onClick={() =>
                  workflowMutation.mutate({
                    action: "submit",
                    id: statement.id,
                  })
                }
                disabled={workflowMutation.isPending}
              >
                <Send /> Submit
              </Button>
            ) : null}
            {statement?.status === "submitted" && canApprove ? (
              <Button
                variant="destructive"
                onClick={() =>
                  workflowMutation.mutate({
                    action: "reject",
                    id: statement.id,
                  })
                }
                disabled={
                  rejectionReason.trim().length < 3 ||
                  workflowMutation.isPending
                }
              >
                <XCircle /> Reject
              </Button>
            ) : null}
            {statement?.status === "submitted" && canApprove ? (
              <Button
                onClick={() =>
                  workflowMutation.mutate({
                    action: "approve",
                    id: statement.id,
                  })
                }
                disabled={workflowMutation.isPending}
              >
                <CheckCircle2 /> Approve
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(selectedLine)}
        onOpenChange={(open) => {
          if (!open) setSelectedLine(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Resolve statement line</DialogTitle>
            <DialogDescription>
              {selectedLine && statement
                ? `${formatMoney(selectedLine.amount, statement.currency)} on ${formatDate(selectedLine.bookingDate)}`
                : "Select a target or document an exception."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="rounded-2xl border p-4">
              <p className="mb-3 font-semibold">Match exact finance document</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  value={targetType}
                  onValueChange={(value) => {
                    setTargetType(
                      value as "payment_run" | "provider_settlement",
                    );
                    setTargetId("");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {canReadPaymentRuns ? (
                      <SelectItem value="payment_run">
                        Executed payment run
                      </SelectItem>
                    ) : null}
                    {canReadSettlements ? (
                      <SelectItem value="provider_settlement">
                        Approved provider settlement
                      </SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
                <Select value={targetId} onValueChange={setTargetId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select exact amount match" />
                  </SelectTrigger>
                  <SelectContent>
                    {targetOptions.map((target) => (
                      <SelectItem key={target.id} value={target.id}>
                        {target.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!targetOptions.length ? (
                <p className="mt-2 text-xs text-amber-700">
                  No exact account, currency, and amount match is available in
                  the loaded target window.
                </p>
              ) : null}
              <Button
                className="mt-3"
                disabled={!targetId || lineMutation.isPending}
                onClick={() => lineMutation.mutate({ mode: "reconcile" })}
              >
                <CheckCircle2 /> Match line
              </Button>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
              <Label>Ignore as documented bank exception</Label>
              <Textarea
                value={ignoreReason}
                onChange={(event) => setIgnoreReason(event.target.value)}
                className="mt-2 bg-white"
                placeholder="Bank fee, opening adjustment, duplicate export..."
              />
              <Button
                variant="outline"
                className="mt-3"
                disabled={
                  ignoreReason.trim().length < 3 || lineMutation.isPending
                }
                onClick={() => lineMutation.mutate({ mode: "ignore" })}
              >
                Ignore with reason
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
