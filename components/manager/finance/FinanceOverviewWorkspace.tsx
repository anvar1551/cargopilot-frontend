"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BookOpenCheck,
  CalendarCheck2,
  CircleDollarSign,
  Landmark,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import {
  FinanceStatusBadge,
  MetricCard,
  financeErrorMessage,
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
  getFinanceLegalEntity,
  getPayablesAging,
  getReceivablesAging,
  listFinanceAccounts,
  listFinanceExceptions,
  listFinancePeriods,
} from "@/lib/finance";
import { hasPermission, type AuthUser } from "@/lib/auth";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function FinanceOverviewWorkspace({
  user,
}: {
  user: AuthUser | null;
}) {
  const canSettings = hasPermission(user, "finance.settings.read");
  const canAccounts = hasPermission(user, "finance.accounts.read");
  const canPeriods = hasPermission(user, "finance.periods.read");
  const canExceptions = hasPermission(user, "finance.exceptions.read");
  const canReceivables = hasPermission(user, "finance.receivables.read");
  const canPayables = hasPermission(user, "finance.payables.read");

  const entity = useQuery({
    queryKey: ["finance", "entity"],
    queryFn: getFinanceLegalEntity,
    enabled: canSettings,
    retry: false,
  });
  const accounts = useQuery({
    queryKey: ["finance", "accounts", "overview"],
    queryFn: () => listFinanceAccounts({ limit: 100 }),
    enabled: canAccounts,
  });
  const periods = useQuery({
    queryKey: ["finance", "periods", "overview"],
    queryFn: () => listFinancePeriods({ limit: 100 }),
    enabled: canPeriods,
  });
  const exceptions = useQuery({
    queryKey: ["finance", "exceptions", "overview"],
    queryFn: () => listFinanceExceptions({ limit: 100 }),
    enabled: canExceptions,
  });
  const receivables = useQuery({
    queryKey: ["finance", "receivables", "overview", today()],
    queryFn: () => getReceivablesAging({ asOf: today(), limit: 1 }),
    enabled: canReceivables,
  });
  const payables = useQuery({
    queryKey: ["finance", "payables", "overview", today()],
    queryFn: () => getPayablesAging({ asOf: today(), limit: 1 }),
    enabled: canPayables,
  });

  const refresh = () => {
    void entity.refetch();
    void accounts.refetch();
    void periods.refetch();
    void exceptions.refetch();
    void receivables.refetch();
    void payables.refetch();
  };

  const openPeriods =
    periods.data?.items.filter((period) => period.status === "open").length ??
    0;
  const accountCount = accounts.data?.items.length ?? 0;
  const exceptionCount = exceptions.data?.items.length ?? 0;
  const arSummary = receivables.data?.summary ?? [];
  const apSummary = payables.data?.summary ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Finance overview</h2>
          <p className="mt-1 text-sm text-slate-500">
            Operational readiness, open balances, and posting health for the
            current company.
          </p>
        </div>
        <Button variant="outline" onClick={refresh}>
          <RefreshCw /> Refresh
        </Button>
      </div>

      {canSettings && entity.isError ? (
        <Card className="border-amber-200 bg-amber-50/70">
          <CardContent className="flex gap-3 p-5">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" />
            <div>
              <p className="font-semibold text-amber-950">
                Finance is not configured
              </p>
              <p className="mt-1 text-sm text-amber-800">
                Open Accounting and configure the legal entity before posting
                documents.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Chart of accounts"
          value={canAccounts ? `${accountCount} loaded` : "Restricted"}
          detail="Postable and control accounts"
          tone="blue"
        />
        <MetricCard
          label="Open fiscal periods"
          value={canPeriods ? String(openPeriods) : "Restricted"}
          detail="Posting requires an open period"
          tone={openPeriods ? "teal" : "amber"}
        />
        <MetricCard
          label="Posting exceptions"
          value={canExceptions ? String(exceptionCount) : "Restricted"}
          detail="Configuration failures requiring action"
          tone={exceptionCount ? "amber" : "teal"}
        />
        <MetricCard
          label="Base currency"
          value={entity.data?.baseCurrency ?? "Not configured"}
          detail={
            entity.data
              ? `Reporting: ${entity.data.reportingCurrency ?? entity.data.baseCurrency}`
              : "Set the legal accounting currency"
          }
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Currency-safe exposure</CardTitle>
            <CardDescription>
              Balances remain separated by currency; no false mixed total is
              produced.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border bg-slate-50/60 p-4">
              <div className="mb-3 flex items-center gap-2">
                <CircleDollarSign className="h-5 w-5 text-teal-700" />
                <p className="font-semibold">Customer receivables</p>
              </div>
              {arSummary.length ? (
                arSummary.map((item) => (
                  <div
                    key={item.currency}
                    className="flex items-center justify-between border-t py-2 text-sm"
                  >
                    <span>{item.currency}</span>
                    <strong>{formatMoney(item.total, item.currency)}</strong>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  {canReceivables
                    ? "No open receivables."
                    : "Permission required."}
                </p>
              )}
            </div>
            <div className="rounded-2xl border bg-slate-50/60 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Landmark className="h-5 w-5 text-blue-700" />
                <p className="font-semibold">Carrier payables</p>
              </div>
              {apSummary.length ? (
                apSummary.map((item) => (
                  <div
                    key={item.currency}
                    className="flex items-center justify-between border-t py-2 text-sm"
                  >
                    <span>{item.currency}</span>
                    <strong>{formatMoney(item.total, item.currency)}</strong>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  {canPayables ? "No open payables." : "Permission required."}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Close-readiness controls</CardTitle>
            <CardDescription>
              Minimum setup required before finance operations are dependable.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                label: "Legal entity configured",
                ready: Boolean(entity.data),
                icon: ShieldCheck,
              },
              {
                label: "Chart of accounts installed",
                ready: accountCount > 0,
                icon: BookOpenCheck,
              },
              {
                label: "Open fiscal period available",
                ready: openPeriods > 0,
                icon: CalendarCheck2,
              },
              {
                label: "Posting exception queue clear",
                ready: exceptionCount === 0,
                icon: AlertTriangle,
              },
            ].map(({ label, ready, icon: Icon }) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-xl border px-3 py-3"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="h-4 w-4 text-slate-500" />
                  {label}
                </span>
                <FinanceStatusBadge status={ready ? "active" : "pending"} />
              </div>
            ))}
            {entity.error ? (
              <p className="text-xs text-rose-600">
                {financeErrorMessage(
                  entity.error,
                  "Could not load finance setup",
                )}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
