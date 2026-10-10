"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Eye,
  Loader2,
  Play,
  RefreshCw,
  Send,
  XCircle,
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
import { hasPermission, type AuthUser } from "@/lib/auth";
import {
  approvePaymentRun,
  executePaymentRun,
  getPaymentRun,
  listPaymentRuns,
  rejectPaymentRun,
  submitPaymentRun,
} from "@/lib/finance";

type WorkflowAction = "submit" | "approve" | "reject" | "execute";

export default function PaymentRunsWorkspace({
  user,
}: {
  user: AuthUser | null;
}) {
  const queryClient = useQueryClient();
  const canManage = hasPermission(user, "finance.treasury.manage");
  const canApprove = hasPermission(user, "finance.treasury.approve");
  const canExecute = hasPermission(user, "finance.treasury.execute");
  const [cursor, setCursor] = useState<string | undefined>();
  const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>(
    [],
  );
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [bankReference, setBankReference] = useState("");

  const runsQuery = useQuery({
    queryKey: ["finance", "payment-runs", cursor, status],
    queryFn: () =>
      listPaymentRuns({
        cursor,
        limit: 25,
        ...(status === "all" ? {} : { status }),
      }),
  });
  const detailQuery = useQuery({
    queryKey: ["finance", "payment-run", selectedId],
    queryFn: () => getPaymentRun(selectedId!),
    enabled: Boolean(selectedId),
  });

  const workflowMutation = useMutation({
    mutationFn: ({ action, id }: { action: WorkflowAction; id: string }) => {
      if (action === "submit") return submitPaymentRun(id);
      if (action === "approve") return approvePaymentRun(id);
      if (action === "reject") return rejectPaymentRun(id, rejectionReason);
      return executePaymentRun(id, {
        bankReference,
        executedAt: new Date().toISOString(),
      });
    },
    onSuccess: (run, variables) => {
      toast.success(`Payment run ${variables.action} completed`);
      setRejectionReason("");
      setBankReference("");
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
      queryClient.setQueryData(["finance", "payment-run", run.id], run);
    },
    onError: (error) =>
      toast.error(financeErrorMessage(error, "Payment run workflow failed")),
  });

  const run = detailQuery.data;
  const act = (action: WorkflowAction) =>
    run && workflowMutation.mutate({ action, id: run.id });

  return (
    <Card className="overflow-hidden rounded-3xl">
      <CardHeader className="border-b bg-slate-50/60 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Treasury payment runs</CardTitle>
          <CardDescription>
            Maker-checker controlled batches. Approval and execution are
            separate audited actions.
          </CardDescription>
        </div>
        <div className="flex gap-2">
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
              {["draft", "submitted", "approved", "rejected", "executed"].map(
                (item) => (
                  <SelectItem key={item} value={item} className="capitalize">
                    {item}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => void runsQuery.refetch()}
            disabled={runsQuery.isFetching}
          >
            <RefreshCw className={runsQuery.isFetching ? "animate-spin" : ""} />{" "}
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {runsQuery.isLoading ? (
          <div className="flex min-h-52 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : runsQuery.data?.items.length ? (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-2xl border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Run</TableHead>
                    <TableHead>Payment date</TableHead>
                    <TableHead>Bank account</TableHead>
                    <TableHead>Lines</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runsQuery.data.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="font-semibold">{item.runNumber}</p>
                        <p className="text-xs text-slate-500">
                          Created {formatDate(item.createdAt, true)}
                        </p>
                      </TableCell>
                      <TableCell>{formatDate(item.paymentDate)}</TableCell>
                      <TableCell>
                        <p>{item.bankAccount.name}</p>
                        <p className="font-mono text-xs text-slate-500">
                          {item.bankAccount.accountIdentifierMasked}
                        </p>
                      </TableCell>
                      <TableCell>{item._count?.lines ?? "-"}</TableCell>
                      <TableCell className="font-semibold">
                        {formatMoney(item.totalAmount, item.currency)}
                      </TableCell>
                      <TableCell>
                        <FinanceStatusBadge status={item.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedId(item.id)}
                        >
                          <Eye /> Review
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
                runsQuery.data.pageInfo.hasMore &&
                runsQuery.data.pageInfo.nextCursor,
              )}
              onPrevious={() => {
                const history = [...cursorHistory];
                setCursor(history.pop());
                setCursorHistory(history);
              }}
              onNext={() => {
                const next = runsQuery.data?.pageInfo.nextCursor;
                if (!next) return;
                setCursorHistory((current) => [...current, cursor]);
                setCursor(next);
              }}
            />
          </div>
        ) : (
          <FinanceEmptyState
            title="No payment runs"
            description="Select outstanding payables in the Payables workspace to create the first draft run."
          />
        )}
      </CardContent>

      <Dialog
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
            setRejectionReason("");
            setBankReference("");
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-hidden sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {run ? `Payment run ${run.runNumber}` : "Loading payment run"}
            </DialogTitle>
            <DialogDescription>
              Review every payable before moving this batch through treasury
              control.
            </DialogDescription>
          </DialogHeader>
          {detailQuery.isLoading || !run ? (
            <div className="flex min-h-52 items-center justify-center">
              <Loader2 className="animate-spin" />
            </div>
          ) : (
            <div className="space-y-5 overflow-y-auto pr-1">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-slate-500">Status</p>
                  <div className="mt-2">
                    <FinanceStatusBadge status={run.status} />
                  </div>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-slate-500">Total</p>
                  <p className="mt-1 font-bold">
                    {formatMoney(run.totalAmount, run.currency)}
                  </p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-slate-500">Payment date</p>
                  <p className="mt-1 font-semibold">
                    {formatDate(run.paymentDate)}
                  </p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-slate-500">FX snapshot</p>
                  <p className="mt-1 font-semibold">{run.fxRate}</p>
                </div>
              </div>
              <div className="overflow-x-auto rounded-2xl border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>#</TableHead>
                      <TableHead>Payable</TableHead>
                      <TableHead>Carrier</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(run.lines ?? []).map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>{line.sequence}</TableCell>
                        <TableCell>
                          <p className="font-medium">
                            {line.payableItem.billNumber}
                          </p>
                          <p className="text-xs text-slate-500">
                            {line.payableItem.supplierInvoiceNumber}
                          </p>
                        </TableCell>
                        <TableCell>{line.carrierCode}</TableCell>
                        <TableCell>
                          {formatDate(line.payableItem.dueDate)}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatMoney(line.amount, run.currency)}
                        </TableCell>
                        <TableCell>
                          <FinanceStatusBadge status={line.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {run.status === "submitted" && canApprove ? (
                <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
                  <Label>Rejection reason (required only when rejecting)</Label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    className="mt-2 bg-white"
                    placeholder="Explain the control exception"
                  />
                </div>
              ) : null}
              {run.status === "approved" && canExecute ? (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
                  <Label>Bank execution reference</Label>
                  <Input
                    value={bankReference}
                    onChange={(event) => setBankReference(event.target.value)}
                    className="mt-2 bg-white"
                    placeholder="Bank transfer batch/reference"
                  />
                </div>
              ) : null}
              {run.rejectionReason ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                  Rejected: {run.rejectionReason}
                </p>
              ) : null}
              {run.bankReference ? (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  Executed with bank reference: {run.bankReference}
                </p>
              ) : null}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedId(null)}>
              Close
            </Button>
            {run?.status === "draft" && canManage ? (
              <Button
                onClick={() => act("submit")}
                disabled={workflowMutation.isPending}
              >
                <Send /> Submit for approval
              </Button>
            ) : null}
            {run?.status === "submitted" && canApprove ? (
              <Button
                variant="destructive"
                onClick={() => act("reject")}
                disabled={
                  rejectionReason.trim().length < 3 ||
                  workflowMutation.isPending
                }
              >
                <XCircle /> Reject
              </Button>
            ) : null}
            {run?.status === "submitted" && canApprove ? (
              <Button
                onClick={() => act("approve")}
                disabled={workflowMutation.isPending}
              >
                <CheckCircle2 /> Approve
              </Button>
            ) : null}
            {run?.status === "approved" && canExecute ? (
              <Button
                onClick={() => act("execute")}
                disabled={!bankReference.trim() || workflowMutation.isPending}
              >
                <Play /> Mark executed
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
