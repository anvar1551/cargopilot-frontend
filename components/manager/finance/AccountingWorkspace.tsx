"use client";

import { AlertTriangle, BookOpenCheck, FileCog, Settings2 } from "lucide-react";

import AccountingSetupWorkspace from "@/components/manager/finance/AccountingSetupWorkspace";
import FinanceExceptionsWorkspace from "@/components/manager/finance/FinanceExceptionsWorkspace";
import JournalsWorkspace from "@/components/manager/finance/JournalsWorkspace";
import PostingRulesWorkspace from "@/components/manager/finance/PostingRulesWorkspace";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hasPermission, type AuthUser } from "@/lib/auth";

export default function AccountingWorkspace({
  user,
}: {
  user: AuthUser | null;
}) {
  const canSetup =
    hasPermission(user, "finance.settings.read") ||
    hasPermission(user, "finance.accounts.read") ||
    hasPermission(user, "finance.periods.read");
  const canJournals = hasPermission(user, "finance.journals.read");
  const canRules = hasPermission(user, "finance.postingRules.read");
  const canExceptions = hasPermission(user, "finance.exceptions.read");
  const initial = canSetup
    ? "setup"
    : canJournals
      ? "journals"
      : canRules
        ? "rules"
        : "exceptions";

  return (
    <Tabs defaultValue={initial} className="space-y-4">
      <TabsList className="flex h-auto w-full flex-wrap justify-start rounded-2xl border bg-slate-50 p-1.5">
        {canSetup ? (
          <TabsTrigger
            value="setup"
            className="h-10 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Settings2 /> Setup
          </TabsTrigger>
        ) : null}
        {canJournals ? (
          <TabsTrigger
            value="journals"
            className="h-10 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <BookOpenCheck /> Journals
          </TabsTrigger>
        ) : null}
        {canRules ? (
          <TabsTrigger
            value="rules"
            className="h-10 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <FileCog /> Posting rules
          </TabsTrigger>
        ) : null}
        {canExceptions ? (
          <TabsTrigger
            value="exceptions"
            className="h-10 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <AlertTriangle /> Event monitor
          </TabsTrigger>
        ) : null}
      </TabsList>
      {canSetup ? (
        <TabsContent value="setup">
          <AccountingSetupWorkspace user={user} />
        </TabsContent>
      ) : null}
      {canJournals ? (
        <TabsContent value="journals">
          <JournalsWorkspace user={user} />
        </TabsContent>
      ) : null}
      {canRules ? (
        <TabsContent value="rules">
          <PostingRulesWorkspace user={user} />
        </TabsContent>
      ) : null}
      {canExceptions ? (
        <TabsContent value="exceptions">
          <FinanceExceptionsWorkspace user={user} />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
