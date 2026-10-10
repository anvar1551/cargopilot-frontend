"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
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
  approveCarrierBill,
  createCarrierBill,
  listCarrierBills,
  rejectCarrierBill,
  submitCarrierBill,
  type FinanceCurrency,
} from "@/lib/finance";
import { listIntegrationProviders } from "@/lib/integrations";
import { fetchOrderLegs, fetchOrdersPaged } from "@/lib/orders";
import { hasPermission, type AuthUser } from "@/lib/auth";

const today = () => new Date().toISOString().slice(0, 10);
type BillLineDraft = {
  orderId: string;
  orderLabel: string;
  orderLegId: string;
  legLabel: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxAmount: string;
};

export default function CarrierBillsWorkspace({
  user,
}: {
  user: AuthUser | null;
}) {
  const client = useQueryClient();
  const canManage = hasPermission(user, "finance.payables.manage");
  const canApprove = hasPermission(user, "finance.payables.approve");
  const [page, setPage] = useState(1);
  const [cursors, setCursors] = useState<Array<string | undefined>>([
    undefined,
  ]);
  const [createOpen, setCreateOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [lineDraft, setLineDraft] = useState({
    orderLegId: "",
    description: "Carrier transport",
    quantity: "1",
    unitPrice: "",
    taxAmount: "0",
  });
  const [form, setForm] = useState({
    carrierProviderId: "",
    supplierInvoiceNumber: "",
    invoiceDate: today(),
    dueDate: "",
    currency: "USD" as FinanceCurrency,
    fxRate: "1",
    lines: [] as BillLineDraft[],
  });
  const cursor = cursors[page - 1];
  const bills = useQuery({
    queryKey: ["finance", "carrier-bills", page, cursor],
    queryFn: () => listCarrierBills({ cursor, limit: 25 }),
  });
  const providers = useQuery({
    queryKey: ["integrations", "providers", "carrier", "active"],
    queryFn: () =>
      listIntegrationProviders({ domain: "carrier", status: "active" }),
    enabled: createOpen,
  });
  const orders = useQuery({
    queryKey: ["orders", "finance-bill-selector"],
    queryFn: () => fetchOrdersPaged({ page: 1, limit: 100 }),
    enabled: createOpen,
  });
  const legs = useQuery({
    queryKey: ["orders", selectedOrderId, "legs", "finance-bill"],
    queryFn: () => fetchOrderLegs(selectedOrderId),
    enabled: Boolean(selectedOrderId),
  });
  const orderOptions = orders.data?.orders ?? [];
  const selectedOrder = orderOptions.find(
    (order) => order.id === selectedOrderId,
  );
  const selectedLeg = legs.data?.find((leg) => leg.id === lineDraft.orderLegId);
  const draftTotal = useMemo(
    () =>
      form.lines.reduce(
        (sum, line) =>
          sum +
          Number(line.quantity || 0) * Number(line.unitPrice || 0) +
          Number(line.taxAmount || 0),
        0,
      ),
    [form.lines],
  );

  const invalidate = () =>
    client.invalidateQueries({ queryKey: ["finance", "carrier-bills"] });
  const createMutation = useMutation({
    mutationFn: () =>
      createCarrierBill({
        idempotencyKey: crypto.randomUUID(),
        carrierProviderId: form.carrierProviderId,
        supplierInvoiceNumber: form.supplierInvoiceNumber.trim(),
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate || null,
        currency: form.currency,
        fxRate: form.fxRate,
        fxRateAsOf: form.currency === "UZS" ? null : new Date().toISOString(),
        lines: form.lines.map((line) => ({
          orderId: line.orderId,
          orderLegId: line.orderLegId,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          taxAmount: line.taxAmount,
        })),
      }),
    onSuccess: async () => {
      await invalidate();
      setCreateOpen(false);
      toast.success("Carrier bill created as draft");
    },
    onError: (error) =>
      toast.error(financeErrorMessage(error, "Could not create carrier bill")),
  });
  const submit = useMutation({
    mutationFn: submitCarrierBill,
    onSuccess: async () => {
      await invalidate();
      toast.success("Carrier bill submitted for approval");
    },
    onError: (error) =>
      toast.error(financeErrorMessage(error, "Could not submit carrier bill")),
  });
  const approve = useMutation({
    mutationFn: approveCarrierBill,
    onSuccess: async () => {
      await invalidate();
      toast.success("Carrier bill approved and posted to payables");
    },
    onError: (error) =>
      toast.error(financeErrorMessage(error, "Could not approve carrier bill")),
  });
  const reject = useMutation({
    mutationFn: () =>
      rejectCarrierBill(rejectId as string, rejectReason.trim()),
    onSuccess: async () => {
      await invalidate();
      setRejectId(null);
      setRejectReason("");
      toast.success("Carrier bill rejected");
    },
    onError: (error) =>
      toast.error(financeErrorMessage(error, "Could not reject carrier bill")),
  });

  const addLine = () => {
    if (!selectedOrder || !selectedLeg || !lineDraft.unitPrice) return;
    setForm((current) => ({
      ...current,
      lines: [
        ...current.lines,
        {
          orderId: selectedOrder.id,
          orderLabel: `#${selectedOrder.orderNumber ?? selectedOrder.id.slice(0, 8)}`,
          legLabel: `Leg ${selectedLeg.sequence} · ${selectedLeg.mode ?? "transport"}`,
          ...lineDraft,
        },
      ],
    }));
    setLineDraft({
      orderLegId: "",
      description: "Carrier transport",
      quantity: "1",
      unitPrice: "",
      taxAmount: "0",
    });
  };
  const next = () => {
    const nextCursor = bills.data?.pageInfo.nextCursor;
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
          <CardTitle>Carrier bills</CardTitle>
          <CardDescription>
            Supplier invoices matched to actual order legs before approval
            creates the payable.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void bills.refetch()}>
            <RefreshCw /> Refresh
          </Button>
          {canManage ? (
            <Button onClick={() => setCreateOpen(true)}>
              <FilePlus2 /> New carrier bill
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {bills.data?.items.length ? (
          <div className="overflow-hidden rounded-2xl border">
            <div className="max-h-[540px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-white">
                  <TableRow>
                    <TableHead>Bill</TableHead>
                    <TableHead>Carrier</TableHead>
                    <TableHead>Invoice date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Workflow</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bills.data.items.map((bill) => (
                    <TableRow key={bill.id}>
                      <TableCell>
                        <p className="font-mono font-semibold">
                          {bill.billNumber}
                        </p>
                        <p className="text-xs text-slate-500">
                          Supplier ref: {bill.supplierInvoiceNumber}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{bill.carrierCode}</p>
                        <p className="text-xs text-slate-500">
                          {bill.lines?.length ?? 0} transport line(s)
                        </p>
                      </TableCell>
                      <TableCell>
                        <p>{formatDate(bill.invoiceDate)}</p>
                        <p className="text-xs text-slate-500">
                          Due {formatDate(bill.dueDate)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold">
                          {formatMoney(bill.totalAmount, bill.currency)}
                        </p>
                        <p className="text-xs text-slate-500">
                          Tax {formatMoney(bill.taxAmount, bill.currency)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <FinanceStatusBadge status={bill.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {canManage && bill.status === "draft" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => submit.mutate(bill.id)}
                            >
                              <Send /> Submit
                            </Button>
                          ) : null}
                          {canApprove && bill.status === "submitted" ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => approve.mutate(bill.id)}
                              >
                                <Check /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-rose-700"
                                onClick={() => setRejectId(bill.id)}
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
                canNext={Boolean(bills.data.pageInfo.hasMore)}
                onPrevious={() => setPage((value) => value - 1)}
                onNext={next}
              />
            </div>
          </div>
        ) : (
          <FinanceEmptyState
            title="No carrier bills"
            description="Create a supplier bill and match every charge to the order leg that incurred it."
          />
        )}
      </CardContent>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Create carrier bill</DialogTitle>
            <DialogDescription>
              Build the supplier invoice from verified order-leg charges.
              Approval is a separate step.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2 lg:col-span-2">
              <Label>Carrier provider</Label>
              <Select
                value={form.carrierProviderId}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    carrierProviderId: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select active carrier" />
                </SelectTrigger>
                <SelectContent>
                  {providers.data?.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.providerCode} · {provider.environment}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Supplier invoice number</Label>
              <Input
                value={form.supplierInvoiceNumber}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    supplierInvoiceNumber: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Invoice date</Label>
              <Input
                type="date"
                value={form.invoiceDate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    invoiceDate: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Due date</Label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    dueDate: event.target.value,
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
          </div>
          <div className="rounded-2xl border bg-slate-50/60 p-4">
            <div className="mb-4">
              <h3 className="font-semibold">Add verified transport line</h3>
              <p className="text-xs text-slate-500">
                Select an order and one of its actual route legs.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2 lg:col-span-2">
                <Label>Order</Label>
                <Select
                  value={selectedOrderId}
                  onValueChange={(value) => {
                    setSelectedOrderId(value);
                    setLineDraft((current) => ({ ...current, orderLegId: "" }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select order" />
                  </SelectTrigger>
                  <SelectContent>
                    {orderOptions.map((order) => (
                      <SelectItem key={order.id} value={order.id}>
                        #{order.orderNumber ?? order.id.slice(0, 8)} ·{" "}
                        {order.pickupAddress ?? "Origin"} →{" "}
                        {order.dropoffAddress ?? "Destination"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label>Order leg</Label>
                <Select
                  value={lineDraft.orderLegId}
                  disabled={!selectedOrderId || legs.isLoading}
                  onValueChange={(value) =>
                    setLineDraft((current) => ({
                      ...current,
                      orderLegId: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select route leg" />
                  </SelectTrigger>
                  <SelectContent>
                    {legs.data?.map((leg) => (
                      <SelectItem key={leg.id} value={leg.id}>
                        Leg {leg.sequence} · {leg.fromCountry ?? "?"} →{" "}
                        {leg.toCountry ?? "?"} · {leg.mode ?? "transport"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label>Description</Label>
                <Input
                  value={lineDraft.description}
                  onChange={(event) =>
                    setLineDraft((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  inputMode="decimal"
                  value={lineDraft.quantity}
                  onChange={(event) =>
                    setLineDraft((current) => ({
                      ...current,
                      quantity: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Unit price</Label>
                <Input
                  inputMode="decimal"
                  value={lineDraft.unitPrice}
                  onChange={(event) =>
                    setLineDraft((current) => ({
                      ...current,
                      unitPrice: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Tax</Label>
                <Input
                  inputMode="decimal"
                  value={lineDraft.taxAmount}
                  onChange={(event) =>
                    setLineDraft((current) => ({
                      ...current,
                      taxAmount: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={addLine}
                  disabled={!selectedLeg || !lineDraft.unitPrice}
                >
                  <Plus /> Add charge
                </Button>
              </div>
            </div>
          </div>
          {form.lines.length ? (
            <div className="overflow-hidden rounded-2xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order / leg</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit price</TableHead>
                    <TableHead>Tax</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {form.lines.map((line, index) => (
                    <TableRow key={`${line.orderLegId}-${index}`}>
                      <TableCell>
                        <p className="font-semibold">{line.orderLabel}</p>
                        <p className="text-xs text-slate-500">
                          {line.legLabel}
                        </p>
                      </TableCell>
                      <TableCell>{line.description}</TableCell>
                      <TableCell>{line.quantity}</TableCell>
                      <TableCell>
                        {formatMoney(line.unitPrice, form.currency)}
                      </TableCell>
                      <TableCell>
                        {formatMoney(line.taxAmount, form.currency)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="border-t bg-slate-50 px-4 py-3 text-right font-semibold">
                Draft total: {formatMoney(String(draftTotal), form.currency)}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={
                createMutation.isPending ||
                !form.carrierProviderId ||
                !form.supplierInvoiceNumber.trim() ||
                form.lines.length === 0
              }
            >
              {createMutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : null}{" "}
              Create draft bill
            </Button>
          </DialogFooter>
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
            <DialogTitle>Reject carrier bill</DialogTitle>
            <DialogDescription>
              Record the discrepancy so the supplier invoice can be corrected
              and resubmitted.
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
              Reject bill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
