"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Eye,
  KeyRound,
  Loader2,
  PlugZap,
  Plus,
  RefreshCw,
  RotateCcw,
  Route,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import PageShell from "@/components/layout/PageShell";
import { CarrierRoutingStudio } from "@/components/manager/integrations/CarrierRoutingStudio";
import { DataListFrame } from "@/components/manager/shared/DataListFrame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getUser, type AuthUser } from "@/lib/auth";
import {
  fetchOrganizations,
  type Organization,
} from "@/lib/organizations";
import {
  deleteIntegrationProvider,
  listIntegrationOutbox,
  listIntegrationOutboxAttempts,
  listIntegrationCanonicalEvents,
  listIntegrationProvidersPage,
  listIntegrationWebhookEvents,
  replayIntegrationOutbox,
  retryIntegrationOutboxNow,
  rotateIntegrationProviderSecret,
  updateIntegrationProviderStatus,
  upsertIntegrationProvider,
  type IntegrationCanonicalEventStatus,
  type IntegrationDomain,
  type IntegrationEnvironment,
  type IntegrationOutboxItem,
  type IntegrationOutboxStatus,
  type IntegrationProviderConfig,
  type IntegrationProviderStatus,
} from "@/lib/integrations";
import { cn } from "@/lib/utils";

const DOMAINS: IntegrationDomain[] = ["carrier", "sms", "payment", "webhook_sink"];
const ENVIRONMENTS: IntegrationEnvironment[] = ["sandbox", "production"];
const PROVIDER_STATUSES: IntegrationProviderStatus[] = ["active", "paused", "disabled"];
const PROVIDER_PAGE_SIZE = 10;
const OUTBOX_STATUSES: IntegrationOutboxStatus[] = [
  "pending",
  "processing",
  "sent",
  "failed",
  "dead_letter",
];
const CANONICAL_EVENT_STATUSES: IntegrationCanonicalEventStatus[] = [
  "pending",
  "processing",
  "processed",
  "failed",
  "ignored",
];

type ProviderFormState = {
  companyId: string;
  domain: IntegrationDomain;
  providerCode: string;
  environment: IntegrationEnvironment;
  status: IntegrationProviderStatus;
  capabilities: string;
  rateLimitRps: string;
  timeoutMs: string;
  retryPolicyId: string;
  rotateSecret: boolean;
  endpointUrl: string;
  token: string;
  apiKey: string;
  apiKeyHeader: string;
  webhookSecret: string;
  webhookSignatureHeader: string;
  webhookTimestampHeader: string;
  webhookMaxSkewSeconds: string;
};

function defaultCapabilities(domain: IntegrationDomain) {
  if (domain === "carrier") return "create_shipment, track, cancel, webhook";
  if (domain === "sms") return "send, status, webhook";
  if (domain === "payment") return "payment_intent, refund, webhook";
  return "deliver";
}

function defaultSecretFields(domain: IntegrationDomain, rotateSecret = true) {
  return {
    rotateSecret,
    endpointUrl: "",
    token: "",
    apiKey: "",
    apiKeyHeader: "x-api-key",
    webhookSecret: "",
    webhookSignatureHeader: "x-signature",
    webhookTimestampHeader: "x-signature-timestamp",
    webhookMaxSkewSeconds: domain === "webhook_sink" ? "" : "300",
  };
}

function emptyProviderForm(companyId: string): ProviderFormState {
  return {
    companyId,
    domain: "carrier",
    providerCode: "",
    environment: "sandbox",
    status: "active",
    capabilities: defaultCapabilities("carrier"),
    rateLimitRps: "",
    timeoutMs: "10000",
    retryPolicyId: "",
    ...defaultSecretFields("carrier", true),
  };
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function formatLabel(value?: string | null) {
  if (!value) return "-";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractApiErrorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) return error instanceof Error ? error.message : fallback;
  const payload = error.response?.data as
    | { error?: string; message?: string; issues?: { fieldErrors?: Record<string, string[]> } } | undefined;
  const base = payload?.error || payload?.message || error.message || fallback;
  const fieldErrors = payload?.issues?.fieldErrors
    ? Object.entries(payload.issues.fieldErrors).flatMap(([field, messages]) =>
        (messages ?? []).map((message) => `${field}: ${message}`),
      )
    : [];
  return fieldErrors.length ? `${base}. ${fieldErrors.join(" | ")}` : base;
}

function endpointFieldLabel(domain: IntegrationDomain) {
  return domain === "webhook_sink" ? "Endpoint URL" : "Provider base URL";
}

function endpointFieldPlaceholder(domain: IntegrationDomain) {
  if (domain === "webhook_sink") return "https://partner.example.com/webhooks/orders";
  return "https://partner.example.com";
}

function shouldShowInboundWebhookFields(domain: IntegrationDomain) {
  return domain !== "webhook_sink";
}

function addTrimmed(payload: Record<string, unknown>, key: string, value: string) {
  const trimmed = value.trim();
  if (trimmed) payload[key] = trimmed;
}

function buildSecretPayload(form: ProviderFormState) {
  if (!form.rotateSecret) return null;

  const payload: Record<string, unknown> = {};
  const endpointKey = form.domain === "webhook_sink" ? "endpointUrl" : "baseUrl";
  addTrimmed(payload, endpointKey, form.endpointUrl);
  addTrimmed(payload, "token", form.token);
  addTrimmed(payload, "apiKey", form.apiKey);
  addTrimmed(payload, "apiKeyHeader", form.apiKeyHeader);

  if (shouldShowInboundWebhookFields(form.domain)) {
    addTrimmed(payload, "webhookSecret", form.webhookSecret);
    addTrimmed(payload, "webhookSignatureHeader", form.webhookSignatureHeader);
    addTrimmed(payload, "webhookTimestampHeader", form.webhookTimestampHeader);
    if (form.webhookMaxSkewSeconds.trim()) {
      const maxSkewSeconds = Number(form.webhookMaxSkewSeconds);
      if (!Number.isFinite(maxSkewSeconds) || maxSkewSeconds <= 0) {
        throw new Error("Webhook max skew must be a positive number");
      }
      payload.webhookMaxSkewSeconds = Math.trunc(maxSkewSeconds);
    }
  }

  return Object.keys(payload).length ? payload : null;
}

function statusClass(status: string) {
  if (status === "active" || status === "sent") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "pending" || status === "processing" || status === "paused") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (status === "failed" || status === "dead_letter") return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function providerSubtitle(provider: IntegrationProviderConfig) {
  const caps = provider.capabilities.length ? provider.capabilities.join(", ") : "No capabilities";
  return `${formatLabel(provider.domain)} / ${provider.environment} / ${caps}`;
}

function companyLabel(companies: Organization[], companyId: string) {
  const company = companies.find((item) => item.id === companyId);
  return company ? company.name : companyId || "All companies";
}

export default function ManagerIntegrationsPage() {
  const qc = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [companyFilter, setCompanyFilter] = useState("all");
  const [providerDomainFilter, setProviderDomainFilter] = useState<IntegrationDomain | "all">("all");
  const [providerStatusFilter, setProviderStatusFilter] = useState<IntegrationProviderStatus | "all">("all");
  const [providerSearch, setProviderSearch] = useState("");
  const [providerCursorStack, setProviderCursorStack] = useState<(string | null)[]>([null]);
  const [providerCursorIndex, setProviderCursorIndex] = useState(0);
  const [outboxStatusFilter, setOutboxStatusFilter] = useState<IntegrationOutboxStatus | "all">("all");
  const [outboxDomainFilter, setOutboxDomainFilter] = useState<IntegrationDomain | "all">("all");
  const [eventDomainFilter, setEventDomainFilter] = useState<IntegrationDomain | "all">("all");
  const [eventStatusFilter, setEventStatusFilter] = useState<IntegrationCanonicalEventStatus | "all">("all");
  const [eventSearch, setEventSearch] = useState("");
  const [webhookEventPage, setWebhookEventPage] = useState(1);
  const [canonicalEventPage, setCanonicalEventPage] = useState(1);
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<IntegrationProviderConfig | null>(null);
  const [deleteProviderTarget, setDeleteProviderTarget] =
    useState<IntegrationProviderConfig | null>(null);
  const [providerForm, setProviderForm] = useState<ProviderFormState>(emptyProviderForm(""));
  const [attemptsFor, setAttemptsFor] = useState<IntegrationOutboxItem | null>(null);

  useEffect(() => {
    const actor = getUser();
    setUser(actor);
    const defaultCompanyId =
      actor?.companyId ||
      actor?.scopes?.find((scope) => scope.scopeType === "company")?.scopeRefId ||
      "";
    if (defaultCompanyId) {
      setCompanyFilter(defaultCompanyId);
      setProviderForm(emptyProviderForm(defaultCompanyId));
    }
  }, []);

  const companiesQuery = useQuery({
    queryKey: ["integration-companies"],
    queryFn: () => fetchOrganizations({ type: "company", isActive: true, page: 1, limit: 100 }),
  });
  const companies = companiesQuery.data?.data ?? [];
  const selectedCompanyId = companyFilter === "all" ? undefined : companyFilter;
  const providerCursor = providerCursorStack[providerCursorIndex] ?? null;

  useEffect(() => {
    setProviderCursorStack([null]);
    setProviderCursorIndex(0);
  }, [selectedCompanyId, providerDomainFilter, providerStatusFilter, providerSearch]);

  const providersQuery = useQuery({
    queryKey: [
      "integration-providers",
      selectedCompanyId,
      providerDomainFilter,
      providerStatusFilter,
      providerSearch,
      providerCursor,
    ],
    queryFn: () =>
      listIntegrationProvidersPage({
        companyId: selectedCompanyId,
        domain: providerDomainFilter,
        status: providerStatusFilter,
        q: providerSearch.trim() || undefined,
        cursor: providerCursor,
        limit: PROVIDER_PAGE_SIZE,
      }),
  });

  const outboxQuery = useQuery({
    queryKey: ["integration-outbox", selectedCompanyId, outboxStatusFilter, outboxDomainFilter],
    queryFn: () =>
      listIntegrationOutbox({
        companyId: selectedCompanyId,
        status: outboxStatusFilter,
        domain: outboxDomainFilter,
        page: 1,
        limit: 25,
      }),
  });

  useEffect(() => {
    setWebhookEventPage(1);
    setCanonicalEventPage(1);
  }, [selectedCompanyId, eventDomainFilter, eventStatusFilter, eventSearch]);

  const webhookEventsQuery = useQuery({
    queryKey: [
      "integration-webhook-events",
      selectedCompanyId,
      eventDomainFilter,
      eventSearch,
      webhookEventPage,
    ],
    queryFn: () =>
      listIntegrationWebhookEvents({
        companyId: selectedCompanyId,
        domain: eventDomainFilter,
        q: eventSearch.trim() || undefined,
        page: webhookEventPage,
        limit: 15,
      }),
  });

  const canonicalEventsQuery = useQuery({
    queryKey: [
      "integration-canonical-events",
      selectedCompanyId,
      eventDomainFilter,
      eventStatusFilter,
      eventSearch,
      canonicalEventPage,
    ],
    queryFn: () =>
      listIntegrationCanonicalEvents({
        companyId: selectedCompanyId,
        domain: eventDomainFilter,
        status: eventStatusFilter,
        q: eventSearch.trim() || undefined,
        page: canonicalEventPage,
        limit: 15,
      }),
  });

  const attemptsQuery = useQuery({
    queryKey: ["integration-outbox-attempts", attemptsFor?.id],
    queryFn: () => listIntegrationOutboxAttempts(attemptsFor!.id),
    enabled: Boolean(attemptsFor?.id),
  });

  const providerPage = providersQuery.data;
  const providers = providerPage?.data ?? [];
  const outboxItems = outboxQuery.data?.items ?? [];
  const webhookEvents = webhookEventsQuery.data?.items ?? [];
  const canonicalEvents = canonicalEventsQuery.data?.items ?? [];

  const metrics = useMemo(() => {
    const activeProviders = providers.filter((item) => item.status === "active").length;
    const failedOutbox = outboxItems.filter(
      (item) => item.status === "failed" || item.status === "dead_letter",
    ).length;
    const pendingOutbox = outboxItems.filter(
      (item) => item.status === "pending" || item.status === "processing",
    ).length;
    return {
      providers: providers.length,
      activeProviders,
      failedOutbox,
      pendingOutbox,
    };
  }, [providers, outboxItems]);

  const saveProviderMutation = useMutation({
    mutationFn: async (form: ProviderFormState) => {
      const companyId = form.companyId.trim();
      const providerCode = form.providerCode.trim();
      if (!companyId) throw new Error("Company is required");
      if (!providerCode) throw new Error("Provider code is required");

      const saved = await upsertIntegrationProvider({
        companyId,
        providerCode,
        domain: form.domain,
        environment: form.environment,
        status: form.status,
        capabilities: form.capabilities
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        rateLimitRps: form.rateLimitRps.trim() ? Number(form.rateLimitRps) : null,
        timeoutMs: form.timeoutMs.trim() ? Number(form.timeoutMs) : 10000,
        retryPolicyId: form.retryPolicyId.trim() || null,
      });

      const secretPayload = buildSecretPayload(form);
      if (secretPayload) {
        await rotateIntegrationProviderSecret({
          id: saved.id,
          secretPayload,
        });
      }
      return saved;
    },
    onSuccess: async () => {
      toast.success("Integration provider saved");
      setProviderDialogOpen(false);
      setEditingProvider(null);
      await qc.invalidateQueries({ queryKey: ["integration-providers"] });
    },
    onError: (error) => toast.error(extractApiErrorMessage(error, "Failed to save provider")),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: IntegrationProviderStatus }) =>
      updateIntegrationProviderStatus(id, status),
    onSuccess: async () => {
      toast.success("Provider status updated");
      await qc.invalidateQueries({ queryKey: ["integration-providers"] });
    },
    onError: (error) => toast.error(extractApiErrorMessage(error, "Failed to update provider")),
  });

  const deleteProviderMutation = useMutation({
    mutationFn: deleteIntegrationProvider,
    onSuccess: async (result) => {
      toast.success(`${result.providerCode} deleted`);
      setDeleteProviderTarget(null);
      await qc.invalidateQueries({ queryKey: ["integration-providers"] });
      await qc.invalidateQueries({ queryKey: ["integration-carrier-providers"] });
    },
    onError: (error) => toast.error(extractApiErrorMessage(error, "Failed to delete provider")),
  });

  const goToNextProviderPage = () => {
    const nextCursor = providerPage?.pageInfo.nextCursor;
    if (!nextCursor) return;
    setProviderCursorStack((current) => {
      const next = current.slice(0, providerCursorIndex + 1);
      next.push(nextCursor);
      return next;
    });
    setProviderCursorIndex((current) => current + 1);
  };

  const goToPreviousProviderPage = () => {
    setProviderCursorIndex((current) => Math.max(0, current - 1));
  };

  const retryMutation = useMutation({
    mutationFn: retryIntegrationOutboxNow,
    onSuccess: async () => {
      toast.success("Outbox record scheduled for retry");
      await qc.invalidateQueries({ queryKey: ["integration-outbox"] });
    },
    onError: (error) => toast.error(extractApiErrorMessage(error, "Failed to retry outbox record")),
  });

  const replayMutation = useMutation({
    mutationFn: replayIntegrationOutbox,
    onSuccess: async () => {
      toast.success("Outbox record replayed");
      await qc.invalidateQueries({ queryKey: ["integration-outbox"] });
    },
    onError: (error) => toast.error(extractApiErrorMessage(error, "Failed to replay outbox record")),
  });

  const openCreateProvider = () => {
    const companyId = selectedCompanyId || user?.companyId || "";
    setEditingProvider(null);
    setProviderForm(emptyProviderForm(companyId));
    setProviderDialogOpen(true);
  };

  const openEditProvider = (provider: IntegrationProviderConfig) => {
    setEditingProvider(provider);
    setProviderForm({
      companyId: provider.companyId,
      domain: provider.domain,
      providerCode: provider.providerCode,
      environment: provider.environment,
      status: provider.status,
      capabilities: provider.capabilities.join(", "),
      rateLimitRps: provider.rateLimitRps == null ? "" : String(provider.rateLimitRps),
      timeoutMs: String(provider.timeoutMs || 10000),
      retryPolicyId: provider.retryPolicyId ?? "",
      ...defaultSecretFields(provider.domain, false),
    });
    setProviderDialogOpen(true);
  };

  const refreshAll = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["integration-providers"] }),
      qc.invalidateQueries({ queryKey: ["integration-outbox"] }),
      qc.invalidateQueries({ queryKey: ["integration-route-templates"] }),
      qc.invalidateQueries({ queryKey: ["integration-carrier-routing-rules"] }),
      qc.invalidateQueries({ queryKey: ["integration-carrier-providers"] }),
      qc.invalidateQueries({ queryKey: ["integration-webhook-events"] }),
      qc.invalidateQueries({ queryKey: ["integration-canonical-events"] }),
    ]);
  };

  const providerCompanyInOptions = companies.some(
    (company) => company.id === providerForm.companyId,
  );

  return (
    <PageShell>
      <div className="space-y-6">
        <Card className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-[#17294a] via-[#0f2e56] to-[#0a6a7f] text-white">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs">
                  <PlugZap className="h-3.5 w-3.5" />
                  Billing & Pricing
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-100/85">
                  Manage carrier, SMS, payment, and webhook providers with delivery visibility and retry control.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-2 bg-white text-slate-900 hover:bg-slate-100"
                  onClick={() => void refreshAll()}
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
                <Button type="button" className="gap-2 bg-white text-slate-900 hover:bg-slate-100" onClick={openCreateProvider}>
                  <Plus className="h-4 w-4" />
                  Add Provider
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-4">
          {[
            { label: "Providers", value: metrics.providers, icon: PlugZap },
            { label: "Active", value: metrics.activeProviders, icon: CheckCircle2 },
            { label: "Pending queue", value: metrics.pendingOutbox, icon: Clock3 },
            { label: "Needs action", value: metrics.failedOutbox, icon: AlertTriangle },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label} className="rounded-xl border-border/70 py-4">
                <CardContent className="flex items-center justify-between px-4">
                  <div>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="mt-1 text-2xl font-semibold">{item.value}</p>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
                    <Icon className="h-5 w-5" />
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-3 shadow-sm">
          <div className="min-w-[260px] space-y-1">
            <Label className="text-xs">Company scope</Label>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accessible companies</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
                {user?.companyId && !companies.some((company) => company.id === user.companyId) ? (
                  <SelectItem value={user.companyId}>{user.companyId}</SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[220px] space-y-1 text-sm text-muted-foreground">
            <span className="block text-xs font-medium text-foreground">Current company</span>
            {companyLabel(companies, selectedCompanyId || user?.companyId || "")}
          </div>
        </div>

        <Tabs defaultValue="providers" className="space-y-4">
          <TabsList className="h-auto w-full justify-start gap-2 rounded-2xl border bg-background p-1">
            <TabsTrigger value="providers" className="rounded-xl px-4 py-2 data-[state=active]:bg-zinc-900 data-[state=active]:text-white">
              <PlugZap className="h-4 w-4" />
              Providers
            </TabsTrigger>
            <TabsTrigger value="carrier-routing" className="rounded-xl px-4 py-2 data-[state=active]:bg-zinc-900 data-[state=active]:text-white">
              <Route className="h-4 w-4" />
              Carrier Routing
            </TabsTrigger>
            <TabsTrigger value="outbox" className="rounded-xl px-4 py-2 data-[state=active]:bg-zinc-900 data-[state=active]:text-white">
              <Send className="h-4 w-4" />
              Delivery Queue
            </TabsTrigger>
            <TabsTrigger value="events" className="rounded-xl px-4 py-2 data-[state=active]:bg-zinc-900 data-[state=active]:text-white">
              <Activity className="h-4 w-4" />
              Event Inbox
            </TabsTrigger>
          </TabsList>

          <TabsContent value="providers" className="space-y-4">
            <DataListFrame
              title="Provider Registry"
              description="Carrier, SMS, payment, and webhook providers configured for the selected company scope."
              searchValue={providerSearch}
              onSearchChange={setProviderSearch}
              searchPlaceholder="Search provider code or policy..."
              filters={
                <>
                  <Select
                    value={providerDomainFilter}
                    onValueChange={(value) => setProviderDomainFilter(value as IntegrationDomain | "all")}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All domains</SelectItem>
                      {DOMAINS.map((domain) => (
                        <SelectItem key={domain} value={domain}>
                          {formatLabel(domain)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={providerStatusFilter}
                    onValueChange={(value) => setProviderStatusFilter(value as IntegrationProviderStatus | "all")}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {PROVIDER_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {formatLabel(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              }
              actions={
                <Button type="button" size="sm" onClick={openCreateProvider}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Provider
                </Button>
              }
              isLoading={providersQuery.isLoading}
              isEmpty={!providers.length}
              emptyText="No integration providers matched this filter."
              loadedCount={providers.length}
              totalCount={providerPage?.total ?? 0}
              hasPreviousPage={providerCursorIndex > 0}
              hasNextPage={Boolean(providerPage?.pageInfo.hasNextPage)}
              onPreviousPage={goToPreviousProviderPage}
              onNextPage={goToNextProviderPage}
              minWidthClassName="min-w-[980px]"
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Runtime</TableHead>
                    <TableHead>Secret</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {providers.map((provider) => (
                    <TableRow key={provider.id}>
                      <TableCell>
                        <div className="font-medium">{provider.providerCode}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{providerSubtitle(provider)}</div>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate">
                        {companyLabel(companies, provider.companyId)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("capitalize", statusClass(provider.status))}>
                          {formatLabel(provider.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{provider.timeoutMs} ms timeout</div>
                        <div className="text-xs text-muted-foreground">
                          {provider.rateLimitRps ? `${provider.rateLimitRps} rps` : "No rate cap"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={provider.secretRef ? "secondary" : "outline"}>
                          {provider.secretRef ? "Configured" : "Missing"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEditProvider(provider)}>
                            <KeyRound className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                            onClick={() => setDeleteProviderTarget(provider)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                          <Select
                            value={provider.status}
                            onValueChange={(status) =>
                              updateStatusMutation.mutate({
                                id: provider.id,
                                status: status as IntegrationProviderStatus,
                              })
                            }
                          >
                            <SelectTrigger className="h-8 w-[118px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PROVIDER_STATUSES.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {formatLabel(status)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataListFrame>
          </TabsContent>

          <TabsContent value="carrier-routing" className="space-y-4">
            <CarrierRoutingStudio
              selectedCompanyId={selectedCompanyId}
              fallbackCompanyId={user?.companyId || ""}
              companies={companies}
            />
          </TabsContent>

          <TabsContent value="outbox" className="space-y-4">
            <Card className="rounded-2xl border-border/70">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle>Delivery Queue</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Select value={outboxDomainFilter} onValueChange={(value) => setOutboxDomainFilter(value as IntegrationDomain | "all")}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All domains</SelectItem>
                        {DOMAINS.map((domain) => (
                          <SelectItem key={domain} value={domain}>
                            {formatLabel(domain)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={outboxStatusFilter} onValueChange={(value) => setOutboxStatusFilter(value as IntegrationOutboxStatus | "all")}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        {OUTBOX_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {formatLabel(status)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Attempts</TableHead>
                        <TableHead>Schedule</TableHead>
                        <TableHead>Error</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outboxQuery.isLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="h-28 text-center text-muted-foreground">
                            Loading delivery queue...
                          </TableCell>
                        </TableRow>
                      ) : outboxItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="h-28 text-center text-muted-foreground">
                            No delivery records matched this filter.
                          </TableCell>
                        </TableRow>
                      ) : (
                        outboxItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="font-medium">{item.eventType}</div>
                              <div className="mt-1 max-w-[220px] truncate text-xs text-muted-foreground">
                                {item.idempotencyKey}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>{item.providerCode}</div>
                              <div className="text-xs text-muted-foreground">{formatLabel(item.domain)}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("capitalize", statusClass(item.status))}>
                                {formatLabel(item.status)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {item.attemptCount} / {item.maxAttempts}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Latest {item.latestAttempt?.outcome ?? "-"}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              <div>Next: {formatDate(item.nextAttemptAt)}</div>
                              <div className="text-xs text-muted-foreground">Last: {formatDate(item.lastAttemptAt)}</div>
                            </TableCell>
                            <TableCell className="max-w-[260px] truncate text-sm text-muted-foreground">
                              {item.lastError || item.latestAttempt?.errorMessage || "-"}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-2">
                                <Button size="icon-sm" variant="outline" onClick={() => setAttemptsFor(item)} title="View attempts">
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {item.status !== "sent" && item.status !== "dead_letter" ? (
                                  <Button
                                    size="icon-sm"
                                    variant="outline"
                                    onClick={() => retryMutation.mutate(item.id)}
                                    title="Retry now"
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                  </Button>
                                ) : null}
                                {item.status === "failed" || item.status === "dead_letter" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => replayMutation.mutate(item.id)}
                                  >
                                    <Activity className="h-4 w-4" />
                                    Replay
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            <DataListFrame
              title="Webhook Receipts"
              description="Raw inbound provider webhooks after signature verification and deduplication."
              searchValue={eventSearch}
              onSearchChange={setEventSearch}
              searchPlaceholder="Search provider, event id, aggregate..."
              filters={
                <>
                  <Select
                    value={eventDomainFilter}
                    onValueChange={(value) => setEventDomainFilter(value as IntegrationDomain | "all")}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All domains</SelectItem>
                      {DOMAINS.map((domain) => (
                        <SelectItem key={domain} value={domain}>
                          {formatLabel(domain)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              }
              isLoading={webhookEventsQuery.isLoading}
              isEmpty={!webhookEvents.length}
              emptyText="No webhook receipts matched this filter."
              loadedCount={webhookEvents.length}
              totalCount={webhookEventsQuery.data?.total ?? 0}
              hasPreviousPage={webhookEventPage > 1}
              hasNextPage={(webhookEventsQuery.data?.page ?? 1) * (webhookEventsQuery.data?.limit ?? 15) < (webhookEventsQuery.data?.total ?? 0)}
              onPreviousPage={() => setWebhookEventPage((page) => Math.max(1, page - 1))}
              onNextPage={() => setWebhookEventPage((page) => page + 1)}
              minWidthClassName="min-w-[1120px]"
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider Event</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Signature</TableHead>
                    <TableHead>Canonical</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhookEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <div className="font-medium">{event.providerEventId}</div>
                        <div className="mt-1 max-w-[280px] truncate text-xs text-muted-foreground">
                          sha256 {event.rawBodySha256}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{event.providerCode}</div>
                        <div className="text-xs text-muted-foreground">{formatLabel(event.domain)} / {event.environment}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={event.signatureVerified ? statusClass("sent") : statusClass("failed")}>
                          {event.signatureVerified ? "Verified" : "Rejected"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{event.canonical?.eventType ?? event.latestCanonicalEvent?.eventType ?? "-"}</div>
                        <div className="max-w-[220px] truncate text-xs text-muted-foreground">
                          {event.canonical?.aggregateType ?? event.latestCanonicalEvent?.aggregateType ?? "-"} / {event.canonical?.aggregateId ?? event.latestCanonicalEvent?.aggregateId ?? "-"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(event.receivedAt)}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                        {event.ipAddress || "-"} {event.userAgent ? ` / ${event.userAgent}` : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataListFrame>

            <DataListFrame
              title="Canonical Processing"
              description="Normalized integration events that workers apply to CargoPilot business modules."
              searchValue={eventSearch}
              onSearchChange={setEventSearch}
              searchPlaceholder="Search provider, event type, aggregate..."
              filters={
                <>
                  <Select
                    value={eventStatusFilter}
                    onValueChange={(value) => setEventStatusFilter(value as IntegrationCanonicalEventStatus | "all")}
                  >
                    <SelectTrigger className="w-[170px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {CANONICAL_EVENT_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {formatLabel(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              }
              isLoading={canonicalEventsQuery.isLoading}
              isEmpty={!canonicalEvents.length}
              emptyText="No canonical events matched this filter."
              loadedCount={canonicalEvents.length}
              totalCount={canonicalEventsQuery.data?.total ?? 0}
              hasPreviousPage={canonicalEventPage > 1}
              hasNextPage={(canonicalEventsQuery.data?.page ?? 1) * (canonicalEventsQuery.data?.limit ?? 15) < (canonicalEventsQuery.data?.total ?? 0)}
              onPreviousPage={() => setCanonicalEventPage((page) => Math.max(1, page - 1))}
              onNextPage={() => setCanonicalEventPage((page) => page + 1)}
              minWidthClassName="min-w-[1180px]"
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aggregate</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Timing</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {canonicalEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <div className="font-medium">{event.eventType}</div>
                        <div className="text-xs text-muted-foreground">{formatLabel(event.source)}</div>
                      </TableCell>
                      <TableCell>
                        <div>{event.providerCode}</div>
                        <div className="text-xs text-muted-foreground">{formatLabel(event.domain)}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("capitalize", statusClass(event.status === "processed" ? "sent" : event.status))}>
                          {formatLabel(event.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[260px] truncate text-sm">
                        {event.aggregateType || "-"} / {event.aggregateId || "-"}
                      </TableCell>
                      <TableCell>{event.processAttempts}</TableCell>
                      <TableCell className="text-sm">
                        <div>Occurred: {formatDate(event.occurredAt)}</div>
                        <div className="text-xs text-muted-foreground">Processed: {formatDate(event.processedAt)}</div>
                      </TableCell>
                      <TableCell className="max-w-[260px] truncate text-sm text-muted-foreground">
                        {event.lastError || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataListFrame>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog
        open={Boolean(deleteProviderTarget)}
        onOpenChange={(open) => !open && setDeleteProviderTarget(null)}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Delete provider?</DialogTitle>
            <DialogDescription>
              This removes &quot;{deleteProviderTarget?.providerCode}&quot;. Providers that still have carrier
              routing rules, outbox records, webhook events, or canonical events cannot be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deleteProviderMutation.isPending}
              onClick={() => setDeleteProviderTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteProviderMutation.isPending || !deleteProviderTarget}
              onClick={() => {
                if (deleteProviderTarget)
                  deleteProviderMutation.mutate(deleteProviderTarget.id);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={providerDialogOpen} onOpenChange={setProviderDialogOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="shrink-0 border-b px-6 py-5 pr-12">
            <DialogTitle>{editingProvider ? "Edit Integration Provider" : "Create Integration Provider"}</DialogTitle>
            <DialogDescription>
              Configure the provider registry row. Secret payload can contain baseUrl, endpointUrl, token, apiKey, and apiKeyHeader.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Company</Label>
                <Select
                  value={providerCompanyInOptions ? providerForm.companyId : "manual"}
                  onValueChange={(value) =>
                    setProviderForm((prev) => ({
                      ...prev,
                      companyId: value === "manual" ? "" : value,
                    }))
                  }
                  disabled={Boolean(editingProvider)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual company ID</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!providerForm.companyId || !companies.some((company) => company.id === providerForm.companyId) ? (
                  <Input
                    value={providerForm.companyId}
                    onChange={(event) => setProviderForm((prev) => ({ ...prev, companyId: event.target.value }))}
                    placeholder="Company UUID"
                    disabled={Boolean(editingProvider)}
                  />
                ) : null}
              </div>

            <div className="space-y-2">
              <Label>Provider code</Label>
              <Input
                value={providerForm.providerCode}
                onChange={(event) => setProviderForm((prev) => ({ ...prev, providerCode: event.target.value }))}
                placeholder="e.g. dhl_express, eskiz_sms"
                disabled={Boolean(editingProvider)}
              />
            </div>

            <div className="space-y-2">
              <Label>Domain</Label>
              <Select
                value={providerForm.domain}
                onValueChange={(value) => {
                  const domain = value as IntegrationDomain;
                  setProviderForm((prev) => ({
                    ...prev,
                    domain,
                    capabilities: defaultCapabilities(domain),
                    ...defaultSecretFields(domain, true),
                  }));
                }}
                disabled={Boolean(editingProvider)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOMAINS.map((domain) => (
                    <SelectItem key={domain} value={domain}>
                      {formatLabel(domain)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Environment</Label>
              <Select
                value={providerForm.environment}
                onValueChange={(value) =>
                  setProviderForm((prev) => ({ ...prev, environment: value as IntegrationEnvironment }))
                }
                disabled={Boolean(editingProvider)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENVIRONMENTS.map((environment) => (
                    <SelectItem key={environment} value={environment}>
                      {formatLabel(environment)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={providerForm.status}
                onValueChange={(value) =>
                  setProviderForm((prev) => ({ ...prev, status: value as IntegrationProviderStatus }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {formatLabel(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Capabilities</Label>
              <Input
                value={providerForm.capabilities}
                onChange={(event) => setProviderForm((prev) => ({ ...prev, capabilities: event.target.value }))}
                placeholder="create_shipment, track"
              />
            </div>

            <div className="space-y-2">
              <Label>Timeout ms</Label>
              <Input
                type="number"
                min={100}
                max={120000}
                value={providerForm.timeoutMs}
                onChange={(event) => setProviderForm((prev) => ({ ...prev, timeoutMs: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Rate limit rps</Label>
              <Input
                type="number"
                min={1}
                value={providerForm.rateLimitRps}
                onChange={(event) => setProviderForm((prev) => ({ ...prev, rateLimitRps: event.target.value }))}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Retry policy ID</Label>
              <Input
                value={providerForm.retryPolicyId}
                onChange={(event) => setProviderForm((prev) => ({ ...prev, retryPolicyId: event.target.value }))}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-4 rounded-2xl border border-border/70 bg-slate-50/70 p-4 md:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Label className="text-base">Encrypted provider credentials</Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Values are encrypted in the backend and never returned to the browser after save.
                  </p>
                </div>
                {editingProvider ? (
                  <label className="flex cursor-pointer items-center gap-2 rounded-full border bg-white px-3 py-2 text-sm">
                    <Checkbox
                      checked={providerForm.rotateSecret}
                      onCheckedChange={(checked) =>
                        setProviderForm((prev) => ({
                          ...prev,
                          ...(!prev.rotateSecret && checked
                            ? defaultSecretFields(prev.domain, true)
                            : {}),
                          rotateSecret: checked === true,
                        }))
                      }
                    />
                    Rotate on save
                  </label>
                ) : null}
              </div>

              {editingProvider && !providerForm.rotateSecret ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Existing credentials will be kept. Enable rotation only when changing endpoint,
                  token, API key, or webhook signing secret.
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>{endpointFieldLabel(providerForm.domain)}</Label>
                  <Input
                    value={providerForm.endpointUrl}
                    onChange={(event) =>
                      setProviderForm((prev) => ({ ...prev, endpointUrl: event.target.value }))
                    }
                    placeholder={endpointFieldPlaceholder(providerForm.domain)}
                    disabled={editingProvider ? !providerForm.rotateSecret : false}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Bearer token</Label>
                  <Input
                    value={providerForm.token}
                    onChange={(event) =>
                      setProviderForm((prev) => ({ ...prev, token: event.target.value }))
                    }
                    placeholder="Optional access token"
                    type="password"
                    autoComplete="off"
                    disabled={editingProvider ? !providerForm.rotateSecret : false}
                  />
                </div>

                <div className="space-y-2">
                  <Label>API key</Label>
                  <Input
                    value={providerForm.apiKey}
                    onChange={(event) =>
                      setProviderForm((prev) => ({ ...prev, apiKey: event.target.value }))
                    }
                    placeholder="Optional API key"
                    type="password"
                    autoComplete="off"
                    disabled={editingProvider ? !providerForm.rotateSecret : false}
                  />
                </div>

                <div className="space-y-2">
                  <Label>API key header</Label>
                  <Input
                    value={providerForm.apiKeyHeader}
                    onChange={(event) =>
                      setProviderForm((prev) => ({ ...prev, apiKeyHeader: event.target.value }))
                    }
                    placeholder="x-api-key"
                    disabled={editingProvider ? !providerForm.rotateSecret : false}
                  />
                </div>

                {shouldShowInboundWebhookFields(providerForm.domain) ? (
                  <>
                    <div className="space-y-2">
                      <Label>Webhook signing secret</Label>
                      <Input
                        value={providerForm.webhookSecret}
                        onChange={(event) =>
                          setProviderForm((prev) => ({
                            ...prev,
                            webhookSecret: event.target.value,
                          }))
                        }
                        placeholder="Optional inbound HMAC secret"
                        type="password"
                        autoComplete="off"
                        disabled={editingProvider ? !providerForm.rotateSecret : false}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Signature header</Label>
                      <Input
                        value={providerForm.webhookSignatureHeader}
                        onChange={(event) =>
                          setProviderForm((prev) => ({
                            ...prev,
                            webhookSignatureHeader: event.target.value,
                          }))
                        }
                        placeholder="x-signature"
                        disabled={editingProvider ? !providerForm.rotateSecret : false}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Timestamp header</Label>
                      <Input
                        value={providerForm.webhookTimestampHeader}
                        onChange={(event) =>
                          setProviderForm((prev) => ({
                            ...prev,
                            webhookTimestampHeader: event.target.value,
                          }))
                        }
                        placeholder="x-signature-timestamp"
                        disabled={editingProvider ? !providerForm.rotateSecret : false}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Max skew seconds</Label>
                      <Input
                        value={providerForm.webhookMaxSkewSeconds}
                        onChange={(event) =>
                          setProviderForm((prev) => ({
                            ...prev,
                            webhookMaxSkewSeconds: event.target.value,
                          }))
                        }
                        placeholder="300"
                        type="number"
                        min={1}
                        disabled={editingProvider ? !providerForm.rotateSecret : false}
                      />
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800 md:col-span-2">
                    Webhook sink providers send outbound HTTP events. Use endpoint, token, or API
                    key fields above to authenticate requests to the partner endpoint.
                  </div>
                )}
              </div>
            </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setProviderDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => saveProviderMutation.mutate(providerForm)}
              disabled={saveProviderMutation.isPending}
            >
              {saveProviderMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save provider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(attemptsFor)} onOpenChange={(open) => !open && setAttemptsFor(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Delivery Attempts</DialogTitle>
            <DialogDescription>
              {attemptsFor?.eventType} via {attemptsFor?.providerCode}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Retryable</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Finished</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attemptsQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Loading attempts...
                    </TableCell>
                  </TableRow>
                ) : (attemptsQuery.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No attempts recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  (attemptsQuery.data ?? []).map((attempt) => (
                    <TableRow key={attempt.id}>
                      <TableCell>{attempt.attemptNo}</TableCell>
                      <TableCell>{formatLabel(attempt.outcome)}</TableCell>
                      <TableCell>{attempt.statusCode ?? "-"}</TableCell>
                      <TableCell>{attempt.retryable ? "Yes" : "No"}</TableCell>
                      <TableCell className="max-w-[320px] truncate text-muted-foreground">
                        {attempt.errorMessage ?? "-"}
                      </TableCell>
                      <TableCell>{formatDate(attempt.finishedAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
