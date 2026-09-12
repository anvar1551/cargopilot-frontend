"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Trash2,
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
  sumDecimals,
} from "@/components/manager/finance/finance-ui";
import { Button } from "@/components/ui/button";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  createFinanceJournal,
  getFinanceJournal,
  listFinanceAccounts,
  listFinanceJournals,
  postFinanceJournal,
  reverseFinanceJournal,
  type FinanceCurrency,
} from "@/lib/finance";
import { hasPermission, type AuthUser } from "@/lib/auth";

type JournalLineForm = {
  accountId: string;
  debitAmount: string;
  creditAmount: string;
  description: string;
};
const emptyLine = (): JournalLineForm => ({
  accountId: "",
  debitAmount: "0",
  creditAmount: "0",
  description: "",
});
const today = () => new Date().toISOString().slice(0, 10);

export default function JournalsWorkspace({ user }: { user: AuthUser | null }) {
  const client = useQueryClient();
  const canCreate = hasPermission(user, "finance.journals.create");
  const canPost = hasPermission(user, "finance.journals.post");
  const canReverse = hasPermission(user, "finance.journals.reverse");
  const [page, setPage] = useState(1);
  const [cursors, setCursors] = useState<Array<string | undefined>>([
    undefined,
  ]);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [reverseId, setReverseId] = useState<string | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [reverseDate, setReverseDate] = useState(today());
  const [form, setForm] = useState({
    documentDate: today(),
    postingDate: today(),
    currency: "UZS" as FinanceCurrency,
    fxRate: "1",
    description: "",
    lines: [emptyLine(), emptyLine()],
  });

  const cursor = cursors[page - 1];
  const journals = useQuery({
    queryKey: ["finance", "journals", page, cursor],
    queryFn: () => listFinanceJournals({ cursor, limit: 25 }),
  });
  const accounts = useQuery({
    queryKey: ["finance", "accounts", "journal-selector"],
    queryFn: () => listFinanceAccounts({ limit: 100 }),
  });
  const detail = useQuery({
    queryKey: ["finance", "journal", detailId],
    queryFn: () => getFinanceJournal(detailId as string),
    enabled: Boolean(detailId),
  });
  const postableAccounts = useMemo(
    () =>
      accounts.data?.items.filter(
        (account) => account.allowPosting && account.status === "active",
      ) ?? [],
    [accounts.data],
  );
  const totalDebit = sumDecimals(
    form.lines.map((line) => line.debitAmount || "0"),
  );
  const totalCredit = sumDecimals(
    form.lines.map((line) => line.creditAmount || "0"),
  );
  const balanced = decimalEquals(totalDebit, totalCredit) && totalDebit !== "0";

  const createMutation = useMutation({
    mutationFn: () =>
      createFinanceJournal({
        idempotencyKey: crypto.randomUUID(),
        documentDate: form.documentDate,
        postingDate: form.postingDate,
        currency: form.currency,
        fxRate: form.fxRate,
        fxRateAsOf: form.currency === "UZS" ? null : new Date().toISOString(),
        description: form.description.trim() || null,
        lines: form.lines.map((line) => ({
          accountId: line.accountId,
          debitAmount: line.debitAmount || "0",
          creditAmount: line.creditAmount || "0",
          description: line.description.trim() || undefined,
        })),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["finance", "journals"] });
      setCreateOpen(false);
      setForm({
        documentDate: today(),
        postingDate: today(),
        currency: "UZS",
        fxRate: "1",
        description: "",
        lines: [emptyLine(), emptyLine()],
      });
      toast.success("Draft journal created");
    },
    onError: (error) =>
      toast.error(financeErrorMessage(error, "Could not create journal")),
  });
  const postMutation = useMutation({
    mutationFn: postFinanceJournal,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["finance", "journals"] });
      toast.success("Journal posted to the ledger");
    },
    onError: (error) =>
      toast.error(financeErrorMessage(error, "Could not post journal")),
  });
  const reverseMutation = useMutation({
    mutationFn: () =>
      reverseFinanceJournal(reverseId as string, {
        postingDate: reverseDate,
        reason: reverseReason.trim(),
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["finance", "journals"] });
      setReverseId(null);
      setReverseReason("");
      toast.success("Reversal journal posted");
    },
    onError: (error) =>
      toast.error(financeErrorMessage(error, "Could not reverse journal")),
  });

  const updateLine = (index: number, patch: Partial<JournalLineForm>) =>
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    }));
  const next = () => {
    const nextCursor = journals.data?.pageInfo.nextCursor;
    if (!nextCursor) return;
    setCursors((current) => {
      const copy = [...current];
      copy[page] = nextCursor;
      return copy;
    });
    setPage((value) => value + 1);
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Journal entries</CardTitle>
          <CardDescription>
            Double-entry documents with controlled posting and immutable
            reversal.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void journals.refetch()}>
            <RefreshCw /> Refresh
          </Button>
          {canCreate ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus /> Manual journal
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {journals.data?.items.length ? (
          <div className="overflow-hidden rounded-2xl border">
            <div className="max-h-[560px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-white">
                  <TableRow>
                    <TableHead>Journal</TableHead>
                    <TableHead>Posting date</TableHead>
                    <TableHead>Source document</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {journals.data.items.map((journal) => (
                    <TableRow key={journal.id}>
                      <TableCell>
                        <p className="font-mono font-semibold">
                          {journal.journalNumber}
                        </p>
                        <p className="max-w-64 truncate text-xs text-slate-500">
                          {journal.description || "No description"}
                        </p>
                      </TableCell>
                      <TableCell>{formatDate(journal.postingDate)}</TableCell>
                      <TableCell>
                        <p className="font-medium">
                          {journal.document?.documentNumber ?? "-"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {journal.document?.sourceType ?? "manual"}
                        </p>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatMoney(
                          journal.document?.totalAmount ??
                            journal.totalDebitBase,
                          journal.document?.currency ?? "UZS",
                        )}
                      </TableCell>
                      <TableCell>
                        <FinanceStatusBadge status={journal.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="View journal"
                            onClick={() => setDetailId(journal.id)}
                          >
                            <Eye />
                          </Button>
                          {canPost && journal.status === "draft" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => postMutation.mutate(journal.id)}
                              disabled={postMutation.isPending}
                            >
                              <Send /> Post
                            </Button>
                          ) : null}
                          {canReverse && journal.status === "posted" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setReverseId(journal.id)}
                            >
                              <RotateCcw /> Reverse
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="px-4 pb-4">
              <FinancePager
                page={page}
                canPrevious={page > 1}
                canNext={Boolean(journals.data.pageInfo.hasMore)}
                onPrevious={() => setPage((value) => value - 1)}
                onNext={next}
              />
            </div>
          </div>
        ) : (
          <FinanceEmptyState
            title="No journal entries"
            description="Operational posting rules will create journals automatically. Authorized accountants may also add balanced manual journals."
          />
        )}
      </CardContent>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Create manual journal</DialogTitle>
            <DialogDescription>
              Debits and credits must balance. Posting remains a separate
              permission-controlled action.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label>Document date</Label>
              <Input
                type="date"
                value={form.documentDate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    documentDate: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Posting date</Label>
              <Input
                type="date"
                value={form.postingDate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    postingDate: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select
                value={form.currency}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    currency: value as FinanceCurrency,
                    fxRate: value === "UZS" ? "1" : current.fxRate,
                  }))
                }
              >
                <SelectTrigger>
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
            <div className="space-y-2">
              <Label>FX rate to base</Label>
              <Input
                inputMode="decimal"
                value={form.fxRate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    fxRate: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-4">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Journal lines</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    lines: [...current.lines, emptyLine()],
                  }))
                }
              >
                <Plus /> Add line
              </Button>
            </div>
            {form.lines.map((line, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-2xl border bg-slate-50/50 p-4 sm:grid-cols-[1.5fr_0.7fr_0.7fr_1fr_auto]"
              >
                <div className="space-y-2">
                  <Label>Account</Label>
                  <Select
                    value={line.accountId}
                    onValueChange={(value) =>
                      updateLine(index, { accountId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {postableAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Debit</Label>
                  <Input
                    inputMode="decimal"
                    value={line.debitAmount}
                    onChange={(event) =>
                      updateLine(index, {
                        debitAmount: event.target.value,
                        creditAmount:
                          event.target.value !== "0" ? "0" : line.creditAmount,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Credit</Label>
                  <Input
                    inputMode="decimal"
                    value={line.creditAmount}
                    onChange={(event) =>
                      updateLine(index, {
                        creditAmount: event.target.value,
                        debitAmount:
                          event.target.value !== "0" ? "0" : line.debitAmount,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Line description</Label>
                  <Input
                    value={line.description}
                    onChange={(event) =>
                      updateLine(index, { description: event.target.value })
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="self-end"
                  disabled={form.lines.length <= 2}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      lines: current.lines.filter(
                        (_, lineIndex) => lineIndex !== index,
                      ),
                    }))
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
          <div
            className={`flex flex-wrap justify-end gap-6 rounded-xl border p-3 text-sm ${balanced ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}
          >
            <span>
              Debit: <strong>{formatMoney(totalDebit, form.currency)}</strong>
            </span>
            <span>
              Credit: <strong>{formatMoney(totalCredit, form.currency)}</strong>
            </span>
            <strong>{balanced ? "Balanced" : "Not balanced"}</strong>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={
                createMutation.isPending ||
                !balanced ||
                form.lines.some((line) => !line.accountId)
              }
            >
              {createMutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : null}{" "}
              Create draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(detailId)}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {detail.data?.journalNumber ?? "Journal details"}
            </DialogTitle>
            <DialogDescription>
              {detail.data?.description || "Double-entry ledger document"}
            </DialogDescription>
          </DialogHeader>
          {detail.isLoading ? (
            <div className="h-52 animate-pulse rounded-2xl bg-slate-100" />
          ) : detail.data ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-slate-500">Status</p>
                  <div className="mt-2">
                    <FinanceStatusBadge status={detail.data.status} />
                  </div>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-slate-500">Posting date</p>
                  <p className="mt-2 font-semibold">
                    {formatDate(detail.data.postingDate)}
                  </p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-slate-500">Document</p>
                  <p className="mt-2 font-semibold">
                    {detail.data.document.documentNumber}
                  </p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-slate-500">Base total</p>
                  <p className="mt-2 font-semibold">
                    {formatMoney(
                      detail.data.totalDebitBase,
                      detail.data.document.currency,
                    )}
                  </p>
                </div>
              </div>
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.data.lines?.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>{line.lineNumber}</TableCell>
                        <TableCell>
                          <strong>{line.account.code}</strong>{" "}
                          {line.account.name}
                        </TableCell>
                        <TableCell>{line.description ?? "-"}</TableCell>
                        <TableCell className="text-right">
                          {formatMoney(line.debitAmount, line.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMoney(line.creditAmount, line.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(reverseId)}
        onOpenChange={(open) => {
          if (!open) setReverseId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse posted journal</DialogTitle>
            <DialogDescription>
              A new opposite journal will be posted. The original entry remains
              immutable.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reversal posting date</Label>
              <Input
                type="date"
                value={reverseDate}
                onChange={(event) => setReverseDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                value={reverseReason}
                onChange={(event) => setReverseReason(event.target.value)}
                placeholder="Required audit reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReverseId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => reverseMutation.mutate()}
              disabled={
                reverseMutation.isPending || reverseReason.trim().length < 3
              }
            >
              {reverseMutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : null}{" "}
              Post reversal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
