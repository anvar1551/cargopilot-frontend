"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KeyRound, Link2, ShieldCheck, Users2 } from "lucide-react";

const roleCards = [
  { code: "super_admin", label: "Super Admin", users: 2, scope: "Global / all orgs" },
  { code: "company_admin", label: "Company Admin", users: 4, scope: "Single company" },
  { code: "branch_manager", label: "Branch Manager", users: 11, scope: "Assigned branches" },
  { code: "agent_operator", label: "Agent / PVZ", users: 26, scope: "Assigned pickup points" },
  { code: "courier", label: "Courier", users: 38, scope: "Own tasks only" },
  { code: "client_portal", label: "Client User", users: 54, scope: "Own shipments / invoices" },
];

const permissionRows = [
  { module: "Orders", read: true, create: true, update: true, assign: true, finance: false },
  { module: "Dispatch", read: true, create: false, update: true, assign: true, finance: false },
  { module: "Support", read: true, create: true, update: true, assign: true, finance: false },
  { module: "Warehouses", read: true, create: false, update: true, assign: false, finance: false },
  { module: "Finance", read: true, create: false, update: true, assign: false, finance: true },
  { module: "Users & Access", read: true, create: true, update: true, assign: true, finance: false },
];

const sampleUsers = [
  { user: "aziza.admin@cargopilot.com", role: "company_admin", scope: "Uzbekistan HQ" },
  { user: "akmal.ops@cargopilot.com", role: "branch_manager", scope: "Tashkent + Samarkand" },
  { user: "pvz.feruza@cargopilot.com", role: "agent_operator", scope: "PVZ-FERUZA-02" },
  { user: "driver.ali@cargopilot.com", role: "courier", scope: "Own assigned shipments" },
];

function Perm({ enabled }: { enabled: boolean }) {
  return (
    <Badge variant={enabled ? "default" : "secondary"} className={enabled ? "bg-emerald-600 hover:bg-emerald-600" : ""}>
      {enabled ? "Allow" : "Deny"}
    </Badge>
  );
}

export default function RbacAdminStudioSample() {
  return (
    <Card className="rounded-2xl border-border/70">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" />
          Access Control Studio (Sample)
          <Badge variant="secondary">Demo UI</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border p-3">
            <p className="text-xs text-muted-foreground">Role templates</p>
            <p className="mt-1 text-xl font-semibold">6</p>
          </div>
          <div className="rounded-xl border p-3">
            <p className="text-xs text-muted-foreground">Permission keys</p>
            <p className="mt-1 text-xl font-semibold">42</p>
          </div>
          <div className="rounded-xl border p-3">
            <p className="text-xs text-muted-foreground">Scope policies</p>
            <p className="mt-1 text-xl font-semibold">9</p>
          </div>
          <div className="rounded-xl border p-3">
            <p className="text-xs text-muted-foreground">Assigned users</p>
            <p className="mt-1 text-xl font-semibold">135</p>
          </div>
        </div>

        <Tabs defaultValue="roles" className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 bg-transparent p-0 sm:grid-cols-5">
            <TabsTrigger value="roles">Roles</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
            <TabsTrigger value="scopes">Scopes</TabsTrigger>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
          </TabsList>

          <TabsContent value="roles" className="mt-4">
            <div className="grid gap-3 xl:grid-cols-2">
              {roleCards.map((role) => (
                <div key={role.code} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{role.label}</p>
                    <Badge variant="outline">{role.users} users</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{role.code}</p>
                  <p className="mt-3 text-xs">
                    Scope: <span className="font-medium">{role.scope}</span>
                  </p>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="permissions" className="mt-4">
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Module</TableHead>
                    <TableHead>Read</TableHead>
                    <TableHead>Create</TableHead>
                    <TableHead>Update</TableHead>
                    <TableHead>Assign</TableHead>
                    <TableHead>Finance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissionRows.map((row) => (
                    <TableRow key={row.module}>
                      <TableCell className="font-medium">{row.module}</TableCell>
                      <TableCell><Perm enabled={row.read} /></TableCell>
                      <TableCell><Perm enabled={row.create} /></TableCell>
                      <TableCell><Perm enabled={row.update} /></TableCell>
                      <TableCell><Perm enabled={row.assign} /></TableCell>
                      <TableCell><Perm enabled={row.finance} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="scopes" className="mt-4">
            <div className="grid gap-3 xl:grid-cols-3">
              <div className="rounded-xl border p-3">
                <p className="text-sm font-semibold">Data ownership model</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  org_id → branch_id → agent_id → user_id
                </p>
                <Separator className="my-3" />
                <p className="text-xs">Rule: user can read only rows matching allowed scope chain.</p>
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-sm font-semibold">Cross-company isolation</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Enabled for orders, customers, invoices, support, and analytics.
                </p>
                <div className="mt-3 flex items-center justify-between rounded-lg border p-2 text-xs">
                  Strict tenant filter
                  <Switch checked disabled />
                </div>
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-sm font-semibold">Finance visibility</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Restricted by permission + scope. Branch managers cannot see other branches.
                </p>
                <Badge className="mt-3 bg-amber-600 hover:bg-amber-600">Scoped finance only</Badge>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="assignments" className="mt-4">
            <div className="space-y-3 rounded-xl border p-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>User</Label>
                  <Input placeholder="Find user by email..." />
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Input value="branch_manager" readOnly />
                </div>
                <div className="space-y-1.5">
                  <Label>Scope</Label>
                  <Input value="Tashkent + Samarkand" readOnly />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button className="gap-2">
                  <Users2 className="h-4 w-4" />
                  Assign role
                </Button>
                <Button variant="outline" className="gap-2">
                  <KeyRound className="h-4 w-4" />
                  Preview effective access
                </Button>
              </div>
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Scope</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sampleUsers.map((item) => (
                      <TableRow key={item.user}>
                        <TableCell>{item.user}</TableCell>
                        <TableCell><Badge variant="secondary">{item.role}</Badge></TableCell>
                        <TableCell>{item.scope}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="integrations" className="mt-4">
            <div className="grid gap-3 xl:grid-cols-2">
              {[
                { name: "SMS providers", value: "Twilio / Eskiz / PlayMobile", enabled: true },
                { name: "Payment gateways", value: "Click / Payme / Uzum / Stripe", enabled: true },
                { name: "Carrier partners", value: "Webhook/API adapters", enabled: false },
                { name: "Agent partner portals", value: "Scoped external access", enabled: false },
              ].map((row) => (
                <div key={row.name} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{row.name}</p>
                    <Badge variant={row.enabled ? "default" : "secondary"}>
                      {row.enabled ? "Enabled" : "Planned"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{row.value}</p>
                </div>
              ))}
            </div>
            <Button variant="outline" className="mt-3 gap-2">
              <Link2 className="h-4 w-4" />
              Open integration mapping
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
