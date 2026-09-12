"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BanknoteArrowDown,
  CalendarDays,
  RefreshCw,
  WalletCards,
} from "lucide-react";

import {
  FinanceEmptyState,
  FinancePager,
  FinanceStatusBadge,
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
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getReceivablesAging,
  listUnappliedCash,
  type FinanceCurrency,
} from "@/lib/finance";

const today = () => new Date().toISOString().slice(0, 10);

function overdueDays(dueDate: string, asOf: string) {
  return Math.max(
    0,
    Math.floor(
      (new Date(asOf).getTime() - new Date(dueDate).getTime()) / 86_400_000,
    ),
  );
}

export default function ReceivablesWorkspace() {
  const [asOf, setAsOf] = useState(today());
  const [currency, setCurrency] = useState<FinanceCurrency | "all">("all");
  const [agingPage, setAgingPage] = useState(1);
  const [agingCursors, setAgingCursors] = useState<Array<string | undefined>>([
    undefined,
  ]);
  const [cashPage, setCashPage] = useState(1);
  const [cashCursors, setCashCursors] = useState<Array<string | undefined>>([
    undefined,
  ]);
  const agingCursor = agingCursors[agingPage - 1];
  const cashCursor = cashCursors[cashPage - 1];
  const aging = useQuery({
    queryKey: [
      "finance",
      "receivables",
      asOf,
      currency,
      agingPage,
      agingCursor,
    ],
    queryFn: () =>
      getReceivablesAging({
        asOf,
        currency: currency === "all" ? undefined : currency,
        cursor: agingCursor,
        limit: 25,
      }),
  });
  const unapplied = useQuery({
    queryKey: ["finance", "unapplied-cash", currency, cashPage, cashCursor],
    queryFn: () =>
      listUnappliedCash({
        currency: currency === "all" ? undefined : currency,
        cursor: cashCursor,
        limit: 25,
        status: "open",
      }),
  });
  const agingNext = () => {
    if (!aging.data?.nextCursor) return;
    setAgingCursors((current) => {
      const copy = [...current];
      copy[agingPage] = aging.data?.nextCursor ?? undefined;
      return copy;
    });
    setAgingPage((value) => value + 1);
  };
  const cashNext = () => {
    if (!unapplied.data?.nextCursor) return;
    setCashCursors((current) => {
      const copy = [...current];
      copy[cashPage] = unapplied.data?.nextCursor ?? undefined;
      return copy;
    });
    setCashPage((value) => value + 1);
  };
  const resetPages = () => {
    setAgingPage(1);
    setAgingCursors([undefined]);
    setCashPage(1);
    setCashCursors([undefined]);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-teal-50 p-2 text-teal-700">
              <CalendarDays />
            </span>
            <div>
              <p className="font-semibold">Customer subledger date</p>
              <p className="text-xs text-slate-500">
                Aging is reconstructed as of the selected date.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              type="date"
              className="w-40"
              value={asOf}
              onChange={(event) => {
                setAsOf(event.target.value);
                resetPages();
              }}
            />
            <Select
              value={currency}
              onValueChange={(value) => {
                setCurrency(value as FinanceCurrency | "all");
                resetPages();
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All currencies</SelectItem>
                <SelectItem value="UZS">UZS</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="CNY">CNY</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => {
                void aging.refetch();
                void unapplied.refetch();
              }}
            >
              <RefreshCw /> Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {aging.data?.summary.length ? (
          aging.data.summary.map((item) => (
            <Card key={item.currency} className="overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-teal-500 to-cyan-600" />
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Open receivables · {item.currency}
                </p>
                <p className="mt-2 text-2xl font-bold">
                  {formatMoney(item.total, item.currency)}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-slate-500">Current</p>
                    <strong>{formatMoney(item.current, item.currency)}</strong>
                  </div>
                  <div>
                    <p className="text-slate-500">1-30 days</p>
                    <strong>
                      {formatMoney(item.days1To30, item.currency)}
                    </strong>
                  </div>
                  <div>
                    <p className="text-slate-500">90+ days</p>
                    <strong className="text-rose-700">
                      {formatMoney(item.daysOver90, item.currency)}
                    </strong>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="sm:col-span-2 xl:col-span-3">
            <CardContent className="p-5 text-sm text-slate-500">
              No open customer balances for this date and currency filter.
            </CardContent>
          </Card>
        )}
      </div>
      <Tabs defaultValue="aging" className="space-y-4">
        <TabsList className="h-auto rounded-2xl border bg-white p-1.5">
          <TabsTrigger
            value="aging"
            className="h-10 rounded-xl data-[state=active]:bg-slate-950 data-[state=active]:text-white"
          >
            <WalletCards /> Aging ledger
          </TabsTrigger>
          <TabsTrigger
            value="unapplied"
            className="h-10 rounded-xl data-[state=active]:bg-slate-950 data-[state=active]:text-white"
          >
            <BanknoteArrowDown /> Unapplied cash
          </TabsTrigger>
        </TabsList>
        <TabsContent value="aging">
          <Card>
            <CardHeader>
              <CardTitle>Receivable items</CardTitle>
              <CardDescription>
                Customer invoices with open balances, ordered by due date.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {aging.data?.items.length ? (
                <div className="overflow-hidden rounded-2xl border">
                  <div className="max-h-[520px] overflow-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-white">
                        <TableRow>
                          <TableHead>Invoice</TableHead>
                          <TableHead>Due date</TableHead>
                          <TableHead>Age</TableHead>
                          <TableHead>Original</TableHead>
                          <TableHead>Outstanding</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {aging.data.items.map((item) => {
                          const days = overdueDays(item.dueDate, asOf);
                          return (
                            <TableRow key={item.id}>
                              <TableCell>
                                <p className="font-mono font-semibold">
                                  {item.invoiceNumber}
                                </p>
                                <p className="text-xs text-slate-500">
                                  Order {item.orderId.slice(0, 8)}
                                </p>
                              </TableCell>
                              <TableCell>{formatDate(item.dueDate)}</TableCell>
                              <TableCell>
                                <span
                                  className={
                                    days > 90
                                      ? "font-semibold text-rose-700"
                                      : days > 0
                                        ? "text-amber-700"
                                        : "text-slate-500"
                                  }
                                >
                                  {days ? `${days} days overdue` : "Current"}
                                </span>
                              </TableCell>
                              <TableCell>
                                {formatMoney(
                                  item.originalAmount,
                                  item.currency,
                                )}
                              </TableCell>
                              <TableCell className="font-semibold">
                                {formatMoney(
                                  item.outstandingAmount,
                                  item.currency,
                                )}
                              </TableCell>
                              <TableCell>
                                <FinanceStatusBadge status={item.status} />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="px-4 pb-4">
                    <FinancePager
                      page={agingPage}
                      canPrevious={agingPage > 1}
                      canNext={Boolean(aging.data.nextCursor)}
                      onPrevious={() => setAgingPage((value) => value - 1)}
                      onNext={agingNext}
                    />
                  </div>
                </div>
              ) : (
                <FinanceEmptyState
                  title="No receivables"
                  description="Issued customer invoices with outstanding balances will appear here."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="unapplied">
          <Card>
            <CardHeader>
              <CardTitle>Unapplied customer cash</CardTitle>
              <CardDescription>
                Receipts and refunds that are not yet fully allocated to
                receivable items.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {unapplied.data?.items.length ? (
                <div className="overflow-hidden rounded-2xl border">
                  <div className="max-h-[520px] overflow-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-white">
                        <TableRow>
                          <TableHead>Cash event</TableHead>
                          <TableHead>Order</TableHead>
                          <TableHead>Occurred</TableHead>
                          <TableHead>Original</TableHead>
                          <TableHead>Remaining</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {unapplied.data.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="capitalize">
                              {item.type}
                            </TableCell>
                            <TableCell className="font-mono">
                              {item.orderId.slice(0, 12)}
                            </TableCell>
                            <TableCell>
                              {formatDate(item.occurredAt, true)}
                            </TableCell>
                            <TableCell>
                              {formatMoney(item.originalAmount, item.currency)}
                            </TableCell>
                            <TableCell className="font-semibold">
                              {formatMoney(item.remainingAmount, item.currency)}
                            </TableCell>
                            <TableCell>
                              <FinanceStatusBadge status={item.status} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="px-4 pb-4">
                    <FinancePager
                      page={cashPage}
                      canPrevious={cashPage > 1}
                      canNext={Boolean(unapplied.data.nextCursor)}
                      onPrevious={() => setCashPage((value) => value - 1)}
                      onNext={cashNext}
                    />
                  </div>
                </div>
              ) : (
                <FinanceEmptyState
                  title="No unapplied cash"
                  description="All customer cash is fully allocated, or no receipt/refund events have been posted."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
