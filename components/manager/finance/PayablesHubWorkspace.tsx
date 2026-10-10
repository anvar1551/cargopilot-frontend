"use client";

import { FileText, TimerReset } from "lucide-react";

import CarrierBillsWorkspace from "@/components/manager/finance/CarrierBillsWorkspace";
import PayablesWorkspace from "@/components/manager/finance/PayablesWorkspace";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AuthUser } from "@/lib/auth";

export default function PayablesHubWorkspace({
  user,
}: {
  user: AuthUser | null;
}) {
  return (
    <Tabs defaultValue="aging" className="space-y-4">
      <TabsList className="h-auto rounded-2xl border bg-slate-50 p-1.5">
        <TabsTrigger
          value="aging"
          className="h-10 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm"
        >
          <TimerReset /> Payables aging
        </TabsTrigger>
        <TabsTrigger
          value="bills"
          className="h-10 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm"
        >
          <FileText /> Carrier bills
        </TabsTrigger>
      </TabsList>
      <TabsContent value="aging">
        <PayablesWorkspace user={user} />
      </TabsContent>
      <TabsContent value="bills">
        <CarrierBillsWorkspace user={user} />
      </TabsContent>
    </Tabs>
  );
}
