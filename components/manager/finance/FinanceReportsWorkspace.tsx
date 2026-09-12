"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, RefreshCw, Scale } from "lucide-react";

import {
  FinanceEmptyState,
  formatMoney,
} from "@/components/manager/finance/finance-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getTrialBalance } from "@/lib/finance";

function currentMonthStart() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}
const today = () => new Date().toISOString().slice(0, 10);
const csvCell = (value: unknown) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

export default function FinanceReportsWorkspace() {
  const [from, setFrom] = useState(currentMonthStart());
  const [to, setTo] = useState(today());
  const report = useQuery({
    queryKey: ["finance", "reports", "trial-balance", from, to],
    queryFn: () => getTrialBalance({ from, to }),
    enabled: Boolean(from && to),
  });

  const exportCsv = () => {
    if (!report.data) return;
    const rows = [
      [
        "Account code",
        "Account name",
        "Type",
        "Debit",
        "Credit",
        "Balance",
        "Base currency",
      ],
      ...report.data.rows.map((row) => [
        row.account.code,
        row.account.name,
        row.account.type,
        row.debit,
        row.credit,
        row.balance,
        report.data.baseCurrency,
      ]),
    ];
    const blob = new Blob(
      [rows.map((row) => row.map(csvCell).join(",")).join("\n")],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `trial-balance-${from}-${to}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Financial reports</CardTitle>
            <CardDescription>
              Ledger-grounded reports use posted journals only. No operational
              estimates are presented as accounting truth.
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className="border-teal-200 bg-teal-50 text-teal-700"
          >
            <Scale /> Double-entry source
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label>From</Label>
              <Input
                type="date"
                className="w-44"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input
                type="date"
                className="w-44"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </div>
            <Button variant="outline" onClick={() => void report.refetch()}>
              <RefreshCw /> Refresh
            </Button>
            <Button onClick={exportCsv} disabled={!report.data?.rows.length}>
              <Download /> Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>
      {report.data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total debit
                </p>
                <p className="mt-2 text-2xl font-bold">
                  {formatMoney(
                    report.data.totalDebit,
                    report.data.baseCurrency,
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total credit
                </p>
                <p className="mt-2 text-2xl font-bold">
                  {formatMoney(
                    report.data.totalCredit,
                    report.data.baseCurrency,
                  )}
                </p>
              </CardContent>
            </Card>
            <Card
              className={
                report.data.balanced
                  ? "border-emerald-200 bg-emerald-50/50"
                  : "border-rose-200 bg-rose-50/50"
              }
            >
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Ledger integrity
                </p>
                <p
                  className={`mt-2 text-2xl font-bold ${report.data.balanced ? "text-emerald-800" : "text-rose-800"}`}
                >
                  {report.data.balanced ? "Balanced" : "Out of balance"}
                </p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Trial balance</CardTitle>
              <CardDescription>
                {from} to {to} · presented in {report.data.baseCurrency}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {report.data.rows.length ? (
                <div className="overflow-hidden rounded-2xl border">
                  <div className="max-h-[620px] overflow-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-white">
                        <TableRow>
                          <TableHead>Account</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Credit</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.data.rows.map((row) => (
                          <TableRow key={row.account.id}>
                            <TableCell>
                              <span className="font-mono font-semibold">
                                {row.account.code}
                              </span>
                              <span className="ml-2">{row.account.name}</span>
                            </TableCell>
                            <TableCell className="capitalize">
                              {row.account.type}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatMoney(row.debit, report.data.baseCurrency)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatMoney(
                                row.credit,
                                report.data.baseCurrency,
                              )}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatMoney(
                                row.balance,
                                report.data.baseCurrency,
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <FinanceEmptyState
                  title="No posted ledger activity"
                  description="The trial balance will populate after journals are posted in the selected date range."
                />
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="h-60 animate-pulse bg-slate-100" />
        </Card>
      )}
    </div>
  );
}
