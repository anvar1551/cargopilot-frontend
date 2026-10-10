"use client";

import { Banknote, Building2, Scale } from "lucide-react";

import BankAccountsWorkspace from "@/components/manager/finance/BankAccountsWorkspace";
import BankReconciliationWorkspace from "@/components/manager/finance/BankReconciliationWorkspace";
import PaymentRunsWorkspace from "@/components/manager/finance/PaymentRunsWorkspace";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hasPermission, type AuthUser } from "@/lib/auth";

export default function TreasuryWorkspace({ user }: { user: AuthUser | null }) {
  const canTreasury = hasPermission(user, "finance.treasury.read");
  const canReconciliation = hasPermission(
    user,
    "finance.bankReconciliation.read",
  );
  return (
    <Tabs
      defaultValue={canTreasury ? "payment-runs" : "reconciliation"}
      className="space-y-4"
    >
      <TabsList className="h-auto w-full flex-wrap justify-start rounded-2xl border bg-slate-50 p-1.5">
        {canTreasury ? (
          <TabsTrigger
            value="payment-runs"
            className="h-10 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Banknote /> Payment runs
          </TabsTrigger>
        ) : null}
        {canTreasury ? (
          <TabsTrigger
            value="bank-accounts"
            className="h-10 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Building2 /> Bank accounts
          </TabsTrigger>
        ) : null}
        {canReconciliation ? (
          <TabsTrigger
            value="reconciliation"
            className="h-10 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Scale /> Reconciliation
          </TabsTrigger>
        ) : null}
      </TabsList>
      {canTreasury ? (
        <TabsContent value="payment-runs">
          <PaymentRunsWorkspace user={user} />
        </TabsContent>
      ) : null}
      {canTreasury ? (
        <TabsContent value="bank-accounts">
          <BankAccountsWorkspace user={user} />
        </TabsContent>
      ) : null}
      {canReconciliation ? (
        <TabsContent value="reconciliation">
          <BankReconciliationWorkspace user={user} />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
