"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BookOpenCheck,
  Landmark,
  ReceiptText,
  Scale,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

import AccountingWorkspace from "@/components/manager/finance/AccountingWorkspace";
import FinanceOverviewWorkspace from "@/components/manager/finance/FinanceOverviewWorkspace";
import FinanceReportsWorkspace from "@/components/manager/finance/FinanceReportsWorkspace";
import PayablesHubWorkspace from "@/components/manager/finance/PayablesHubWorkspace";
import ReceivablesWorkspace from "@/components/manager/finance/ReceivablesWorkspace";
import SettlementsWorkspace from "@/components/manager/finance/SettlementsWorkspace";
import TreasuryWorkspace from "@/components/manager/finance/TreasuryWorkspace";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getUser, hasPermission, type AuthUser } from "@/lib/auth";

type FinanceTab =
  | "overview"
  | "accounting"
  | "receivables"
  | "payables"
  | "settlements"
  | "treasury"
  | "reports";

const ACCOUNTING_PERMISSIONS = [
  "finance.settings.read",
  "finance.accounts.read",
  "finance.periods.read",
  "finance.journals.read",
  "finance.postingRules.read",
  "finance.exceptions.read",
];

export default function FinanceControlCenter() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState<FinanceTab>("overview");

  useEffect(() => {
    setUser(getUser());
    setReady(true);
  }, []);

  const access = useMemo(() => {
    const accounting = ACCOUNTING_PERMISSIONS.some((permission) =>
      hasPermission(user, permission),
    );
    const receivables = hasPermission(user, "finance.receivables.read");
    const payables = hasPermission(user, "finance.payables.read");
    const settlements = hasPermission(user, "finance.settlements.read");
    const treasury =
      hasPermission(user, "finance.treasury.read") ||
      hasPermission(user, "finance.bankReconciliation.read");
    const reports = hasPermission(user, "finance.reports.read");
    return {
      accounting,
      receivables,
      payables,
      settlements,
      treasury,
      reports,
      any:
        accounting ||
        receivables ||
        payables ||
        settlements ||
        treasury ||
        reports,
    };
  }, [user]);

  const allowedTabs = useMemo<FinanceTab[]>(() => {
    if (!access.any) return [];
    const tabs: FinanceTab[] = ["overview"];
    if (access.accounting) tabs.push("accounting");
    if (access.receivables) tabs.push("receivables");
    if (access.payables) tabs.push("payables");
    if (access.settlements) tabs.push("settlements");
    if (access.treasury) tabs.push("treasury");
    if (access.reports) tabs.push("reports");
    return tabs;
  }, [access]);

  useEffect(() => {
    if (allowedTabs.length > 0 && !allowedTabs.includes(activeTab))
      setActiveTab(allowedTabs[0]);
  }, [activeTab, allowedTabs]);

  if (!ready)
    return (
      <div className="min-h-72 animate-pulse rounded-[28px] bg-slate-200/70" />
    );

  if (allowedTabs.length === 0) {
    return (
      <Card className="border-amber-200 bg-amber-50/60">
        <CardContent className="flex min-h-56 flex-col items-center justify-center text-center">
          <ShieldCheck className="mb-3 h-8 w-8 text-amber-700" />
          <h1 className="text-xl font-semibold">Finance access required</h1>
          <p className="mt-2 max-w-lg text-sm text-slate-600">
            Your company membership has no finance read permissions. Ask an
            administrator to bind the required finance permissions to one of
            your roles.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[28px] border border-slate-700/40 bg-gradient-to-r from-[#17294a] via-[#0f2e56] to-[#0a6a7f] px-6 py-7 text-white shadow-xl sm:px-8">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full border border-white/10 bg-white/5" />
        <div className="absolute bottom-0 right-36 h-24 w-48 bg-[radial-gradient(circle,rgba(255,255,255,0.14)_1px,transparent_1px)] [background-size:10px_10px]" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium">
              <Landmark className="h-3.5 w-3.5" /> Finance operating layer
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Finance Control Center
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">
              Control the general ledger, customer and carrier subledgers,
              payment-provider settlements, treasury execution, and financial
              reporting without mixing currencies or bypassing approvals.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2">
              <BookOpenCheck className="mx-auto mb-1 h-4 w-4 text-cyan-200" />{" "}
              Double entry
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2">
              <Scale className="mx-auto mb-1 h-4 w-4 text-cyan-200" />{" "}
              Maker-checker
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2">
              <ShieldCheck className="mx-auto mb-1 h-4 w-4 text-cyan-200" />{" "}
              Audit trail
            </div>
          </div>
        </div>
      </section>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as FinanceTab)}
        className="gap-4"
      >
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl border bg-white p-1.5 shadow-sm md:grid-cols-4 xl:grid-cols-7">
          <TabsTrigger
            value="overview"
            className="h-11 rounded-xl data-[state=active]:bg-slate-950 data-[state=active]:text-white"
          >
            <BarChart3 /> Overview
          </TabsTrigger>
          {access.accounting ? (
            <TabsTrigger
              value="accounting"
              className="h-11 rounded-xl data-[state=active]:bg-slate-950 data-[state=active]:text-white"
            >
              <BookOpenCheck /> Accounting
            </TabsTrigger>
          ) : null}
          {access.receivables ? (
            <TabsTrigger
              value="receivables"
              className="h-11 rounded-xl data-[state=active]:bg-slate-950 data-[state=active]:text-white"
            >
              <WalletCards /> Receivables
            </TabsTrigger>
          ) : null}
          {access.payables ? (
            <TabsTrigger
              value="payables"
              className="h-11 rounded-xl data-[state=active]:bg-slate-950 data-[state=active]:text-white"
            >
              <ReceiptText /> Payables
            </TabsTrigger>
          ) : null}
          {access.settlements ? (
            <TabsTrigger
              value="settlements"
              className="h-11 rounded-xl data-[state=active]:bg-slate-950 data-[state=active]:text-white"
            >
              <Scale /> Settlements
            </TabsTrigger>
          ) : null}
          {access.treasury ? (
            <TabsTrigger
              value="treasury"
              className="h-11 rounded-xl data-[state=active]:bg-slate-950 data-[state=active]:text-white"
            >
              <Landmark /> Treasury
            </TabsTrigger>
          ) : null}
          {access.reports ? (
            <TabsTrigger
              value="reports"
              className="h-11 rounded-xl data-[state=active]:bg-slate-950 data-[state=active]:text-white"
            >
              <BarChart3 /> Reports
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="overview">
          <FinanceOverviewWorkspace user={user} />
        </TabsContent>
        {access.accounting ? (
          <TabsContent value="accounting">
            <AccountingWorkspace user={user} />
          </TabsContent>
        ) : null}
        {access.receivables ? (
          <TabsContent value="receivables">
            <ReceivablesWorkspace />
          </TabsContent>
        ) : null}
        {access.payables ? (
          <TabsContent value="payables">
            <PayablesHubWorkspace user={user} />
          </TabsContent>
        ) : null}
        {access.settlements ? (
          <TabsContent value="settlements">
            <SettlementsWorkspace user={user} />
          </TabsContent>
        ) : null}
        {access.treasury ? (
          <TabsContent value="treasury">
            <TreasuryWorkspace user={user} />
          </TabsContent>
        ) : null}
        {access.reports ? (
          <TabsContent value="reports">
            <FinanceReportsWorkspace />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
