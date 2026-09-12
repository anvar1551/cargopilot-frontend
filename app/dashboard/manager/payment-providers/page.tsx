"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { getUser } from "@/lib/auth";
import {
  createPaymentProviderConfig,
  getCompanyPaymentPolicy,
  listAvailablePaymentProviders,
  listPaymentProviderConfigs,
  testPaymentProviderConfig,
  updateCompanyPaymentPolicy,
  updatePaymentProviderConfig,
  type AvailablePaymentProvider,
  type PaymentEnvironment,
  type PaymentProvider,
} from "@/lib/paymentProviders";

import PageShell from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PROVIDERS: PaymentProvider[] = ["CLICK", "PAYME", "UZUM", "STRIPE"];
const ENVIRONMENTS: PaymentEnvironment[] = ["TEST", "PRODUCTION"];

type ProviderField = "merchantId" | "serviceId" | "accountId";
type FormState = {
  id?: string;
  companyId: string;
  provider: PaymentProvider;
  environment: PaymentEnvironment;
  isEnabled: boolean;
  merchantId: string;
  serviceId: string;
  accountId: string;
  secret: string;
};

type PolicyFormState = {
  companyId: string;
  onlinePaymentsEnabled: boolean;
  defaultProvider: PaymentProvider | "NONE";
  allowProviderOverride: boolean;
};

const BASE_FIELD_LABELS: Record<ProviderField, string> = {
  merchantId: "Merchant ID",
  serviceId: "Service ID",
  accountId: "Account ID",
};

const PROVIDER_META: Record<
  PaymentProvider,
  {
    subtitle: string;
    requiredFields: ProviderField[];
    visibleFields: ProviderField[];
    labels?: Partial<Record<ProviderField, string>>;
    note: string;
    unsupported?: boolean;
  }
> = {
  CLICK: {
    subtitle: "Click Merchant API",
    requiredFields: ["merchantId", "serviceId", "accountId"],
    visibleFields: ["merchantId", "serviceId", "accountId"],
    labels: {
      merchantId: "Merchant ID",
      serviceId: "Service ID",
      accountId: "Merchant User ID",
    },
    note: "Auth uses merchant_user_id + secret_key digest. All three IDs are required.",
  },
  PAYME: {
    subtitle: "Payme Merchant API",
    requiredFields: ["merchantId"],
    visibleFields: ["merchantId", "accountId"],
    labels: {
      merchantId: "Cashbox ID",
      accountId: "Account field key",
    },
    note: "Account field key is optional. Leave empty to use default order_id.",
  },
  UZUM: {
    subtitle: "Uzum Merchant API",
    requiredFields: ["serviceId", "accountId"],
    visibleFields: ["serviceId", "accountId"],
    labels: {
      accountId: "BasicAuth Username",
    },
    note: "Uzum callbacks use BasicAuth. Username and service ID are required.",
  },
  STRIPE: {
    subtitle: "Stripe Checkout + Webhooks",
    requiredFields: ["serviceId"],
    visibleFields: ["serviceId"],
    labels: {
      serviceId: "Webhook Secret (whsec_...)",
    },
    note: "Configure Stripe API key and webhook secret for signed event processing.",
  },
};

const PROVIDER_SECRET_HINT: Partial<Record<PaymentProvider, string>> = {
  STRIPE: "Stripe secret key (sk_...)",
};

const PROVIDER_SECRET_ROTATE_HINT: Partial<Record<PaymentProvider, string>> = {
  STRIPE: "Leave empty to keep existing key",
};

const PROVIDER_CREATE_SECRET_HINT: Partial<Record<PaymentProvider, string>> = {
  STRIPE: "Enter Stripe secret key (sk_...)",
};

const PROVIDER_INFO_NOTE: Partial<Record<PaymentProvider, string>> = {
  STRIPE:
    "Set secret to Stripe API key (sk_...) and Service ID to webhook secret (whsec_...).",
};

const providerSecretLabel = (provider: PaymentProvider, editing: boolean) =>
  editing
    ? PROVIDER_SECRET_ROTATE_HINT[provider] ?? "Leave empty to keep existing"
    : PROVIDER_CREATE_SECRET_HINT[provider] ?? "Enter secret";

const providerSecretFieldLabel = (provider: PaymentProvider, editing: boolean) =>
  editing
    ? PROVIDER_SECRET_HINT[provider]
      ? `${PROVIDER_SECRET_HINT[provider]} (optional rotate)`
      : "Secret (optional rotate)"
    : PROVIDER_SECRET_HINT[provider] ?? "Secret";

const providerInfoNote = (provider: PaymentProvider) =>
  PROVIDER_INFO_NOTE[provider] ?? PROVIDER_META[provider].note;

const normalizeSecret = (provider: PaymentProvider, raw: string) => {
  if (provider !== "STRIPE") return raw.trim();
  return raw.trim();
};

const sanitizeProviderForm = (form: FormState): FormState => {
  if (form.provider !== "STRIPE") return form;
  return {
    ...form,
    serviceId: form.serviceId.trim(),
  };
};

function emptyForm(defaultCompanyId: string): FormState {
  return {
    companyId: defaultCompanyId,
    provider: "CLICK",
    environment: "TEST",
    isEnabled: true,
    merchantId: "",
    serviceId: "",
    accountId: "",
    secret: "",
  };
}

function fieldLabel(provider: PaymentProvider, field: ProviderField): string {
  return PROVIDER_META[provider].labels?.[field] ?? BASE_FIELD_LABELS[field];
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

export default function PaymentProvidersPage() {
  const qc = useQueryClient();
  const user = useMemo(() => getUser(), []);
  const userCompanyId = user?.companyId ?? "";
  const [companyIdFilter, setCompanyIdFilter] = useState<string>(userCompanyId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm(userCompanyId));
  const [policyForm, setPolicyForm] = useState<PolicyFormState>({
    companyId: userCompanyId,
    onlinePaymentsEnabled: true,
    defaultProvider: "NONE",
    allowProviderOverride: true,
  });

  const selectedMeta = PROVIDER_META[form.provider];
  const companyFilterIsValid = !companyIdFilter || looksLikeUuid(companyIdFilter);

  const query = useQuery({
    queryKey: ["payment-provider-configs", companyIdFilter],
    queryFn: () => listPaymentProviderConfigs({ companyId: companyIdFilter || undefined }),
    enabled: companyFilterIsValid,
  });

  const policyQuery = useQuery({
    queryKey: ["company-payment-policy", companyIdFilter],
    queryFn: () => getCompanyPaymentPolicy({ companyId: companyIdFilter || undefined }),
    enabled: Boolean(companyIdFilter && companyFilterIsValid),
  });

  const availableProvidersQuery = useQuery({
    queryKey: ["available-payment-providers", companyIdFilter],
    queryFn: () =>
      listAvailablePaymentProviders({
        companyId: companyIdFilter || undefined,
        environment: "PRODUCTION",
      }),
    enabled: Boolean(companyIdFilter && companyFilterIsValid),
  });

  const createMutation = useMutation({
    mutationFn: createPaymentProviderConfig,
    onSuccess: async () => {
      toast.success("Provider config created");
      setDialogOpen(false);
      setForm(emptyForm(companyIdFilter || userCompanyId));
      await qc.invalidateQueries({ queryKey: ["payment-provider-configs"] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.error ?? "Failed to create provider config"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updatePaymentProviderConfig>[1] }) =>
      updatePaymentProviderConfig(id, payload),
    onSuccess: async () => {
      toast.success("Provider config updated");
      setDialogOpen(false);
      setForm(emptyForm(companyIdFilter || userCompanyId));
      await qc.invalidateQueries({ queryKey: ["payment-provider-configs"] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.error ?? "Failed to update provider config"),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => testPaymentProviderConfig(id),
    onSuccess: (result) => {
      if (result.healthy) {
        toast.success("Configuration is valid");
        return;
      }
      const detail = result.issues?.length ? `: ${result.issues.join(" | ")}` : "";
      toast.error(`Configuration has issues${detail}`);
    },
    onError: (error: any) => toast.error(error?.response?.data?.error ?? "Failed to test provider"),
  });

  const policyMutation = useMutation({
    mutationFn: updateCompanyPaymentPolicy,
    onSuccess: async () => {
      toast.success("Payment policy updated");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["company-payment-policy"] }),
        qc.invalidateQueries({ queryKey: ["available-payment-providers"] }),
      ]);
    },
    onError: (error: any) => toast.error(error?.response?.data?.error ?? "Failed to update payment policy"),
  });

  const policy = policyQuery.data;

  const availableProviders = (availableProvidersQuery.data ?? []) as AvailablePaymentProvider[];

  const policyDirty =
    policyForm.onlinePaymentsEnabled !== (policy?.onlinePaymentsEnabled ?? true) ||
    policyForm.allowProviderOverride !== (policy?.allowProviderOverride ?? true) ||
    (policyForm.defaultProvider === "NONE" ? null : policyForm.defaultProvider) !==
      (policy?.defaultProvider ?? null);

  useEffect(() => {
    if (!policy) return;
    setPolicyForm({
      companyId: policy.companyId,
      onlinePaymentsEnabled: policy.onlinePaymentsEnabled,
      defaultProvider: policy.defaultProvider ?? "NONE",
      allowProviderOverride: policy.allowProviderOverride,
    });
  }, [policy?.companyId, policy?.onlinePaymentsEnabled, policy?.defaultProvider, policy?.allowProviderOverride]);

  const rows = query.data ?? [];

  const providerCards = useMemo(() => {
    return PROVIDERS.map((provider) => {
      const configs = rows.filter((r) => r.provider === provider);
      const enabled = configs.filter((r) => r.isEnabled).length;
      return { provider, total: configs.length, enabled };
    });
  }, [rows]);

  const onSave = () => {
    if (!form.companyId.trim()) {
      toast.error("Company ID is required");
      return;
    }

    for (const field of selectedMeta.requiredFields) {
      if (!form[field].trim()) {
        toast.error(`${fieldLabel(form.provider, field)} is required`);
        return;
      }
    }

    const nextForm = sanitizeProviderForm(form);
    const secret = normalizeSecret(nextForm.provider, nextForm.secret);

    if (!nextForm.id && secret.length < 4) {
      toast.error("Secret is required for new provider config");
      return;
    }

    if (!nextForm.id) {
      createMutation.mutate({
        companyId: nextForm.companyId.trim(),
        provider: nextForm.provider,
        environment: nextForm.environment,
        isEnabled: nextForm.isEnabled,
        merchantId: nextForm.merchantId.trim() || undefined,
        serviceId: nextForm.serviceId.trim() || undefined,
        accountId: nextForm.accountId.trim() || undefined,
        secret,
      });
      return;
    }

    updateMutation.mutate({
      id: nextForm.id,
      payload: {
        environment: nextForm.environment,
        isEnabled: nextForm.isEnabled,
        merchantId: nextForm.merchantId.trim() || undefined,
        serviceId: nextForm.serviceId.trim() || undefined,
        accountId: nextForm.accountId.trim() || undefined,
        secret: secret || undefined,
      },
    });
  };

  const loading = createMutation.isPending || updateMutation.isPending;

  return (
    <PageShell>
      <div className="space-y-6">
        <Card className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-[#17294a] via-[#0f2e56] to-[#0a6a7f] text-white">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan-400/15 blur-2xl" />
          <CardContent className="relative p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Billing & Pricing
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">Payment Providers</h1>
                <p className="mt-2 text-sm text-slate-100/85">
                  Activate provider per company, bind credentials, and validate readiness before production.
                </p>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-white text-slate-900 hover:bg-slate-100">
                    <Plus className="h-4 w-4" />
                    Add Provider Config
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>{form.id ? "Edit Provider Config" : "Create Provider Config"}</DialogTitle>
                    <DialogDescription>
                      {selectedMeta.subtitle}. {providerInfoNote(form.provider)}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Company ID</Label>
                      <Input
                        value={form.companyId}
                        onChange={(e) => setForm((p) => ({ ...p, companyId: e.target.value }))}
                        placeholder="UUID"
                        disabled={Boolean(form.id)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Provider</Label>
                      <Select
                        value={form.provider}
                        onValueChange={(v: PaymentProvider) => setForm((p) => ({ ...p, provider: v }))}
                        disabled={Boolean(form.id)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROVIDERS.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Environment</Label>
                      <Select
                        value={form.environment}
                        onValueChange={(v: PaymentEnvironment) => setForm((p) => ({ ...p, environment: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ENVIRONMENTS.map((env) => (
                            <SelectItem key={env} value={env}>
                              {env}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Enabled</Label>
                      <Select
                        value={form.isEnabled ? "true" : "false"}
                        onValueChange={(v) => setForm((p) => ({ ...p, isEnabled: v === "true" }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Active</SelectItem>
                          <SelectItem value="false">Disabled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedMeta.visibleFields.includes("merchantId") ? (
                      <div className="space-y-2">
                        <Label>{fieldLabel(form.provider, "merchantId")}</Label>
                        <Input
                          value={form.merchantId}
                          onChange={(e) => setForm((p) => ({ ...p, merchantId: e.target.value }))}
                        />
                      </div>
                    ) : null}

                    {selectedMeta.visibleFields.includes("serviceId") ? (
                      <div className="space-y-2">
                        <Label>{fieldLabel(form.provider, "serviceId")}</Label>
                        <Input
                          value={form.serviceId}
                          onChange={(e) => setForm((p) => ({ ...p, serviceId: e.target.value }))}
                        />
                      </div>
                    ) : null}

                    {selectedMeta.visibleFields.includes("accountId") ? (
                      <div className="space-y-2">
                        <Label>{fieldLabel(form.provider, "accountId")}</Label>
                        <Input
                          value={form.accountId}
                          onChange={(e) => setForm((p) => ({ ...p, accountId: e.target.value }))}
                          placeholder={form.provider === "PAYME" ? "order_id (optional)" : undefined}
                        />
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <Label>{providerSecretFieldLabel(form.provider, Boolean(form.id))}</Label>
                      <Input
                        type="password"
                        value={form.secret}
                        onChange={(e) => setForm((p) => ({ ...p, secret: e.target.value }))}
                        placeholder={providerSecretLabel(form.provider, Boolean(form.id))}
                      />
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>{providerInfoNote(form.provider)}</div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={loading}>
                      Cancel
                    </Button>
                    <Button onClick={onSave} disabled={loading}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70">
          <CardHeader>
            <CardTitle>Company Payment Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Company ID</Label>
                <Input
                  value={policyForm.companyId}
                  onChange={(e) => {
                    const nextCompanyId = e.target.value;
                    setCompanyIdFilter(nextCompanyId);
                    setPolicyForm((prev) => ({ ...prev, companyId: nextCompanyId }));
                  }}
                  placeholder="UUID"
                />
              </div>
              <div className="space-y-2">
                <Label>Online Payments</Label>
                <Select
                  value={policyForm.onlinePaymentsEnabled ? "enabled" : "disabled"}
                  onValueChange={(value) =>
                    setPolicyForm((prev) => ({
                      ...prev,
                      onlinePaymentsEnabled: value === "enabled",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enabled">Enabled</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Default Provider</Label>
                <Select
                  value={policyForm.defaultProvider}
                  onValueChange={(value) =>
                    setPolicyForm((prev) => ({
                      ...prev,
                      defaultProvider: value as PolicyFormState["defaultProvider"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">No default</SelectItem>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Provider Override</Label>
                <Select
                  value={policyForm.allowProviderOverride ? "allowed" : "locked"}
                  onValueChange={(value) =>
                    setPolicyForm((prev) => ({
                      ...prev,
                      allowProviderOverride: value === "allowed",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allowed">Allow override</SelectItem>
                    <SelectItem value="locked">Lock to default</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant={policy?.globalPaymentsEnabled ? "secondary" : "outline"}>
                Global env: {policy?.globalPaymentsEnabled ? "ON" : "OFF"}
              </Badge>
              <Badge variant={policy?.effectiveOnlinePaymentsEnabled ? "secondary" : "outline"}>
                Effective: {policy?.effectiveOnlinePaymentsEnabled ? "ON" : "OFF"}
              </Badge>
              <span>
                Active providers in production: {availableProviders.length}
              </span>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() =>
                  policyMutation.mutate({
                    companyId: policyForm.companyId.trim(),
                    onlinePaymentsEnabled: policyForm.onlinePaymentsEnabled,
                    defaultProvider:
                      policyForm.defaultProvider === "NONE"
                        ? null
                        : policyForm.defaultProvider,
                    allowProviderOverride: policyForm.allowProviderOverride,
                  })
                }
                disabled={!policyDirty || policyMutation.isPending || !policyForm.companyId.trim()}
              >
                {policyMutation.isPending ? "Saving..." : "Save Policy"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-4">
          {providerCards.map((item) => (
            <Card key={item.provider} className="rounded-2xl border-border/70">
              <CardContent className="p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{item.provider}</div>
                <div className="mt-1 text-2xl font-semibold">{item.total}</div>
                <div className="mt-1 text-xs text-muted-foreground">{item.enabled} active</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="rounded-2xl border-border/70">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Configured Providers</CardTitle>
              <div className="flex items-center gap-2">
                <Input
                  value={companyIdFilter}
                  onChange={(e) => setCompanyIdFilter(e.target.value)}
                  placeholder="Filter by company UUID"
                  className="w-[280px]"
                />
                <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
                  {query.isFetching ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Env</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Keys</TableHead>
                    <TableHead>Secret</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Callback</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                        No provider configs found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.provider}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.environment}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.companyId}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {[
                            row.merchantId ? `merchant:${row.merchantId}` : null,
                            row.serviceId ? `service:${row.serviceId}` : null,
                            row.accountId ? `account:${row.accountId}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "-"}
                        </TableCell>
                        <TableCell>{row.secretMasked ?? "-"}</TableCell>
                        <TableCell>
                          <Badge variant={row.isEnabled ? "secondary" : "outline"}>
                            {row.isEnabled ? "Active" : "Disabled"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.callbackPath ?? "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => testMutation.mutate(row.id)}
                              disabled={testMutation.isPending}
                            >
                              Test
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                setForm({
                                  id: row.id,
                                  companyId: row.companyId,
                                  provider: row.provider,
                                  environment: row.environment,
                                  isEnabled: row.isEnabled,
                                  merchantId: row.merchantId ?? "",
                                  serviceId: row.serviceId ?? "",
                                  accountId: row.accountId ?? "",
                                  secret: "",
                                });
                                setDialogOpen(true);
                              }}
                            >
                              Edit
                            </Button>
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
      </div>
    </PageShell>
  );
}
