"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Eye,
  FilePlus2,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  FinanceEmptyState,
  FinancePager,
  FinanceStatusBadge,
  financeErrorMessage,
  formatDate,
  formatMoney,
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
import {
  approveProviderSettlement,
  createProviderSettlement,
  getProviderSettlement,
  listProviderSettlements,
  rejectProviderSettlement,
  submitProviderSettlement,
  type FinanceCurrency,
} from "@/lib/finance";
import { listPaymentProviderConfigs } from "@/lib/paymentProviders";
import { hasPermission, type AuthUser } from "@/lib/auth";

const today = () => new Date().toISOString().slice(0, 10);
type SettlementLine = {
  type: "payment" | "refund" | "fee" | "adjustment";
  amount: string;
  externalTransactionId: string;
  orderId: string;
  occurredAt: string;
  description: string;
};
const emptyLine = (): SettlementLine => ({
  type: "payment",
  amount: "",
  externalTransactionId: "",
  orderId: "",
  occurredAt: "",
  description: "",
});

export default function SettlementsWorkspace({
  user,
}: {
  user: AuthUser | null;
}) {
  const client = useQueryClient();
  const canManage = hasPermission(user, "finance.settlements.manage");
  const canApprove = hasPermission(user, "finance.settlements.approve");
  const [page, setPage] = useState(1);
  const [cursors, setCursors] = useState<Array<string | undefined>>([
    undefined,
  ]);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [form, setForm] = useState({
    providerConfigId: "",
    externalReference: "",
    periodStart: today(),
    periodEnd: today(),
    currency: "USD" as FinanceCurrency,
    fxRate: "1",
    reportedNetAmount: "",
    lines: [emptyLine()],
  });
  const cursor = cursors[page - 1];
  const settlements = useQuery({
    queryKey: ["finance", "provider-settlements", page, cursor],
    queryFn: () => listProviderSettlements({ cursor, limit: 25 }),
  });
  const providers = useQuery({
    queryKey: ["payment-providers", "finance-settlement"],
    queryFn: () => listPaymentProviderConfigs({ enabledOnly: true }),
    enabled: createOpen,
  });
  const detail = useQuery({
    queryKey: ["finance", "provider-settlement", detailId],
    queryFn: () => getProviderSettlement(detailId as string),
    enabled: Boolean(detailId),
  });
  const invalidate = () =>
    client.invalidateQueries({ queryKey: ["finance", "provider-settlements"] });
  const createMutation = useMutation({
    mutationFn: () =>
      createProviderSettlement({
        idempotencyKey: crypto.randomUUID(),
        providerConfigId: form.providerConfigId,
        externalReference: form.externalReference.trim() || null,
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
        currency: form.currency,
        fxRate: form.fxRate,
        fxRateAsOf: form.currency === "UZS" ? null : new Date().toISOString(),
        reportedNetAmount: form.reportedNetAmount || null,
        lines: form.lines.map((line) => ({
          type: line.type,
          amount: line.amount,
          externalTransactionId: line.externalTransactionId.trim() || null,
          orderId: line.orderId.trim() || null,
          occurredAt: line.occurredAt
            ? new Date(line.occurredAt).toISOString()
            : null,
          description: line.description.trim() || null,
        })),
      }),
    onSuccess: async () => {
      await invalidate();
      setCreateOpen(false);
      toast.success("Provider settlement created");
    },
    onError: (error) =>
      toast.error(financeErrorMessage(error, "Could not create settlement")),
  });
  const submit = useMutation({
    mutationFn: submitProviderSettlement,
    onSuccess: async () => {
      await invalidate();
      toast.success("Settlement submitted");
    },
    onError: (error) =>
      toast.error(financeErrorMessage(error, "Could not submit settlement")),
  });
  const approve = useMutation({
    mutationFn: approveProviderSettlement,
    onSuccess: async () => {
      await invalidate();
      toast.success("Settlement approved and posted");
    },
    onError: (error) =>
      toast.error(financeErrorMessage(error, "Could not approve settlement")),
  });
  const reject = useMutation({
    mutationFn: () =>
      rejectProviderSettlement(rejectId as string, rejectReason.trim()),
    onSuccess: async () => {
      await invalidate();
      setRejectId(null);
      setRejectReason("");
      toast.success("Settlement rejected");
    },
    onError: (error) =>
      toast.error(financeErrorMessage(error, "Could not reject settlement")),
  });
  const updateLine = (index: number, patch: Partial<SettlementLine>) =>
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    }));
  const next = () => {
    const nextCursor = settlements.data?.pageInfo.nextCursor;
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
          <CardTitle>Payment-provider settlements</CardTitle>
          <CardDescription>
            Reconcile provider payments, refunds, fees, and adjustments before
            ledger approval.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void settlements.refetch()}>
            <RefreshCw /> Refresh
          </Button>
          {canManage ? (
            <Button onClick={() => setCreateOpen(true)}>
              <FilePlus2 /> New settlement
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {settlements.data?.items.length ? (
          <div className="overflow-hidden rounded-2xl border">
            <div className="max-h-[550px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-white">
                  <TableRow>
                    <TableHead>Settlement</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Net amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Workflow</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settlements.data.items.map((settlement) => (
                    <TableRow key={settlement.id}>
                      <TableCell className="font-mono font-semibold">
                        {settlement.settlementNumber}
                      </TableCell>
                      <TableCell>{settlement.providerCode}</TableCell>
                      <TableCell className="font-semibold">
                        {formatMoney(settlement.netAmount, settlement.currency)}
                      </TableCell>
                      <TableCell>
                        <FinanceStatusBadge status={settlement.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDetailId(settlement.id)}
                          >
                            <Eye />
                          </Button>
                          {canManage && settlement.status === "draft" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => submit.mutate(settlement.id)}
                            >
                              <Send /> Submit
                            </Button>
                          ) : null}
                          {canApprove && settlement.status === "submitted" ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => approve.mutate(settlement.id)}
                              >
                                <Check /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-rose-700"
                                onClick={() => setRejectId(settlement.id)}
                              >
                                <X /> Reject
                              </Button>
                            </>
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
                canNext={Boolean(settlements.data.pageInfo.hasMore)}
                onPrevious={() => setPage((value) => value - 1)}
                onNext={next}
              />
            </div>
          </div>
        ) : (
          <FinanceEmptyState
            title="No provider settlements"
            description="Import or enter a payment-provider statement to reconcile fees and net payouts."
          />
        )}
      </CardContent>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Create provider settlement</DialogTitle>
            <DialogDescription>
              Capture the provider statement exactly as issued. Automatic
              matching runs before approval.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2 lg:col-span-2">
              <Label>Payment provider configuration</Label>
              <Select
                value={form.providerConfigId}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    providerConfigId: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select configured provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.data?.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.provider} · {provider.environment}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>External statement reference</Label>
              <Input
                value={form.externalReference}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    externalReference: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Period start</Label>
              <Input
                type="date"
                value={form.periodStart}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    periodStart: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Period end</Label>
              <Input
                type="date"
                value={form.periodEnd}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    periodEnd: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
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
                    <SelectItem value="UZS">UZS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="CNY">CNY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>FX rate</Label>
                <Input
                  value={form.fxRate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      fxRate: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Provider-reported net</Label>
              <Input
                inputMode="decimal"
                value={form.reportedNetAmount}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    reportedNetAmount: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Statement lines</h3>
                <p className="text-xs text-slate-500">
                  Payment and refund lines can be matched using provider
                  transaction references.
                </p>
              </div>
              <Button
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
                className="grid gap-3 rounded-2xl border bg-slate-50/60 p-4 sm:grid-cols-2 lg:grid-cols-[0.8fr_0.8fr_1.2fr_1.2fr_auto]"
              >
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={line.type}
                    onValueChange={(value) =>
                      updateLine(index, {
                        type: value as SettlementLine["type"],
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="payment">Payment</SelectItem>
                      <SelectItem value="refund">Refund</SelectItem>
                      <SelectItem value="fee">Fee</SelectItem>
                      <SelectItem value="adjustment">Adjustment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    inputMode="decimal"
                    value={line.amount}
                    onChange={(event) =>
                      updateLine(index, { amount: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>External transaction ID</Label>
                  <Input
                    value={line.externalTransactionId}
                    onChange={(event) =>
                      updateLine(index, {
                        externalTransactionId: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Order ID (optional)</Label>
                  <Input
                    value={line.orderId}
                    onChange={(event) =>
                      updateLine(index, { orderId: event.target.value })
                    }
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="self-end"
                  disabled={form.lines.length === 1}
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
                <div className="space-y-2 lg:col-span-2">
                  <Label>Occurred at</Label>
                  <Input
                    type="datetime-local"
                    value={line.occurredAt}
                    onChange={(event) =>
                      updateLine(index, { occurredAt: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-2 lg:col-span-3">
                  <Label>Description</Label>
                  <Input
                    value={line.description}
                    onChange={(event) =>
                      updateLine(index, { description: event.target.value })
                    }
                  />
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={
                createMutation.isPending ||
                !form.providerConfigId ||
                form.lines.some((line) => !line.amount)
              }
            >
              {createMutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : null}{" "}
              Create settlement
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
              {detail.data?.settlementNumber ?? "Settlement details"}
            </DialogTitle>
            <DialogDescription>
              {detail.data
                ? `${detail.data.providerCode} · ${formatDate(detail.data.periodStart)} to ${formatDate(detail.data.periodEnd)}`
                : "Provider settlement"}
            </DialogDescription>
          </DialogHeader>
          {detail.data ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-slate-500">Gross</p>
                  <strong>
                    {formatMoney(detail.data.grossAmount, detail.data.currency)}
                  </strong>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-slate-500">Refunds</p>
                  <strong>
                    {formatMoney(
                      detail.data.refundAmount,
                      detail.data.currency,
                    )}
                  </strong>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-slate-500">Fees</p>
                  <strong>
                    {formatMoney(detail.data.feeAmount, detail.data.currency)}
                  </strong>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-slate-500">Net</p>
                  <strong>
                    {formatMoney(detail.data.netAmount, detail.data.currency)}
                  </strong>
                </div>
              </div>
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Match</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.data.lines?.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>{line.sequence}</TableCell>
                        <TableCell className="capitalize">
                          {line.type}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {line.externalTransactionId ?? "-"}
                        </TableCell>
                        <TableCell>
                          <FinanceStatusBadge
                            status={line.reconciliationStatus}
                          />
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatMoney(line.amount, detail.data.currency)}
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
        open={Boolean(rejectId)}
        onOpenChange={(open) => {
          if (!open) setRejectId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject provider settlement</DialogTitle>
            <DialogDescription>
              Record the reconciliation issue for correction.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Rejection reason</Label>
            <Textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => reject.mutate()}
              disabled={reject.isPending || rejectReason.trim().length < 3}
            >
              {reject.isPending ? <Loader2 className="animate-spin" /> : null}{" "}
              Reject settlement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
