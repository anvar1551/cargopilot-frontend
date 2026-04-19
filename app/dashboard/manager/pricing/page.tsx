"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n/I18nProvider";
import PageShell from "@/components/layout/PageShell";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { fetchCustomers } from "@/lib/customerEntities";
import { getServiceTypeLabel } from "@/lib/i18n/labels";
import {
  DEFAULT_SERVICE_TYPE,
  SERVICE_TYPES,
  type ServiceType,
} from "@/lib/orders/service-types";
import {
  createDeliverySlaRule,
  createPricingRegion,
  createTariffPlan,
  fetchDeliverySlaRules,
  fetchOperationalSlaPolicy,
  fetchTariffPlan,
  fetchPricingRegions,
  fetchTariffPlans,
  fetchZoneMatrix,
  saveZoneMatrix,
  type DeliverySlaRule,
  type PricingRegion,
  type TariffPlanStatus,
  type TariffPriceType,
  updateOperationalSlaPolicy,
  updateDeliverySlaRule,
  updatePricingRegion,
  updateTariffPlan,
} from "@/lib/pricing";
import {
  Calculator,
  CircleDollarSign,
  Layers3,
  Map,
  PencilLine,
  Plus,
  RefreshCw,
  Route,
  Save,
  Sparkles,
  X,
} from "lucide-react";

type ZoneDraftMap = Record<string, string>;
type RateDraft = {
  id: string;
  zone: string;
  weightFromKg: string;
  weightToKg: string;
  price: string;
};
type RegionFormState = {
  code: string;
  name: string;
  aliases: string;
  sortOrder: string;
  isActive: boolean;
};
type SlaMatchMode = "service_default" | "zone" | "exact_route";
type TariffFormState = {
  name: string;
  code: string;
  description: string;
  status: TariffPlanStatus;
  serviceType: ServiceType;
  priceType: TariffPriceType;
  currency: string;
  priority: string;
  isDefault: boolean;
  customerEntityId: string;
  rates: RateDraft[];
};
type SlaFormState = {
  name: string;
  description: string;
  serviceType: ServiceType;
  matchMode: SlaMatchMode;
  originRegionId: string;
  destinationRegionId: string;
  zone: string;
  deliveryDays: string;
  priority: string;
  isActive: boolean;
};
type SlaPolicyFormState = {
  staleHours: string;
  dueSoonHours: string;
  overdueGraceHours: string;
};

const STATUS_OPTIONS: TariffPlanStatus[] = ["draft", "active", "archived"];
const PRICE_TYPES: TariffPriceType[] = ["bucket", "linear"];

function makeRateDraft(partial?: Partial<RateDraft>): RateDraft {
  return {
    id: Math.random().toString(36).slice(2, 10),
    zone: partial?.zone ?? "0",
    weightFromKg: partial?.weightFromKg ?? "0",
    weightToKg: partial?.weightToKg ?? "1",
    price: partial?.price ?? "",
  };
}

function makeEmptyRegionForm(): RegionFormState {
  return { code: "", name: "", aliases: "", sortOrder: "", isActive: true };
}

function detectSlaMatchMode(
  rule: Pick<
    DeliverySlaRule,
    "originRegionId" | "destinationRegionId" | "zone"
  >,
): SlaMatchMode {
  if (rule.originRegionId && rule.destinationRegionId) return "exact_route";
  if (rule.zone !== null && rule.zone !== undefined) return "zone";
  return "service_default";
}

function makeEmptyTariffForm(): TariffFormState {
  return {
    name: "",
    code: "",
    description: "",
    status: "draft",
    serviceType: DEFAULT_SERVICE_TYPE,
    priceType: "bucket",
    currency: "UZS",
    priority: "0",
    isDefault: false,
    customerEntityId: "all",
    rates: [makeRateDraft()],
  };
}

function makeEmptySlaForm(): SlaFormState {
  return {
    name: "",
    description: "",
    serviceType: DEFAULT_SERVICE_TYPE,
    matchMode: "service_default",
    originRegionId: "all",
    destinationRegionId: "all",
    zone: "0",
    deliveryDays: "1",
    priority: "0",
    isActive: true,
  };
}

function makeEmptySlaPolicyForm(): SlaPolicyFormState {
  return {
    staleHours: "48",
    dueSoonHours: "24",
    overdueGraceHours: "0",
  };
}

function keyForZone(originId: string, destinationId: string) {
  return `${originId}:${destinationId}`;
}

function sortRegions(regions: PricingRegion[]) {
  return [...regions].sort((a, b) =>
    a.sortOrder !== b.sortOrder
      ? a.sortOrder - b.sortOrder
      : a.name.localeCompare(b.name),
  );
}

function parseNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function planStatusVariant(status: TariffPlanStatus) {
  if (status === "active") return "default" as const;
  if (status === "archived") return "secondary" as const;
  return "outline" as const;
}

export default function ManagerPricingPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [regionForm, setRegionForm] =
    React.useState<RegionFormState>(makeEmptyRegionForm);
  const [editingRegionId, setEditingRegionId] = React.useState<string | null>(
    null,
  );
  const [zoneDraft, setZoneDraft] = React.useState<ZoneDraftMap>({});
  const [slaForm, setSlaForm] = React.useState<SlaFormState>(makeEmptySlaForm);
  const [slaPolicyForm, setSlaPolicyForm] =
    React.useState<SlaPolicyFormState>(makeEmptySlaPolicyForm);
  const [editingSlaRuleId, setEditingSlaRuleId] = React.useState<string | null>(
    null,
  );
  const [tariffForm, setTariffForm] =
    React.useState<TariffFormState>(makeEmptyTariffForm);
  const [editingPlanId, setEditingPlanId] = React.useState<string | null>(null);
  const [loadingPlanId, setLoadingPlanId] = React.useState<string | null>(null);
  const [planSearch, setPlanSearch] = React.useState("");
  const [planStatusFilter, setPlanStatusFilter] = React.useState<
    "all" | TariffPlanStatus
  >("all");
  const [planServiceTypeFilter, setPlanServiceTypeFilter] = React.useState<
    "all" | ServiceType
  >("all");

  const regionsQuery = useQuery({
    queryKey: ["pricing", "regions"],
    queryFn: () => fetchPricingRegions(),
  });
  const regions = React.useMemo(
    () => sortRegions(regionsQuery.data ?? []),
    [regionsQuery.data],
  );
  const zoneMatrixQuery = useQuery({
    queryKey: ["pricing", "zones"],
    queryFn: () => fetchZoneMatrix(),
  });
  const slaRulesQuery = useQuery({
    queryKey: ["pricing", "sla-rules"],
    queryFn: () => fetchDeliverySlaRules(),
  });
  const slaPolicyQuery = useQuery({
    queryKey: ["pricing", "sla-policy"],
    queryFn: fetchOperationalSlaPolicy,
  });
  const tariffPlansQuery = useQuery({
    queryKey: [
      "pricing",
      "plans",
      planSearch,
      planStatusFilter,
      planServiceTypeFilter,
    ],
    queryFn: () =>
      fetchTariffPlans({
        q: planSearch.trim() || undefined,
        status: planStatusFilter === "all" ? undefined : planStatusFilter,
        serviceType:
          planServiceTypeFilter === "all" ? undefined : planServiceTypeFilter,
      }),
  });
  const customersQuery = useQuery({
    queryKey: ["pricing", "customers"],
    queryFn: () => fetchCustomers({ page: 1, limit: 200 }),
  });
  const customers = customersQuery.data?.data ?? [];

  React.useEffect(() => {
    const nextDraft: ZoneDraftMap = {};
    for (const entry of zoneMatrixQuery.data ?? [])
      nextDraft[keyForZone(entry.originRegionId, entry.destinationRegionId)] =
        String(entry.zone);
    for (const region of regions) {
      const diagonalKey = keyForZone(region.id, region.id);
      nextDraft[diagonalKey] = nextDraft[diagonalKey] ?? "0";
    }
    setZoneDraft(nextDraft);
  }, [regions, zoneMatrixQuery.data]);

  React.useEffect(() => {
    if (!slaPolicyQuery.data) return;
    setSlaPolicyForm({
      staleHours: String(slaPolicyQuery.data.staleHours),
      dueSoonHours: String(slaPolicyQuery.data.dueSoonHours),
      overdueGraceHours: String(slaPolicyQuery.data.overdueGraceHours),
    });
  }, [slaPolicyQuery.data]);

  const resetRegionForm = React.useCallback(() => {
    setRegionForm(makeEmptyRegionForm());
    setEditingRegionId(null);
  }, []);

  const resetSlaForm = React.useCallback(() => {
    setSlaForm(makeEmptySlaForm());
    setEditingSlaRuleId(null);
  }, []);

  const resetTariffForm = React.useCallback(() => {
    setTariffForm(makeEmptyTariffForm());
    setEditingPlanId(null);
    setLoadingPlanId(null);
  }, []);

  const regionSubmitMutation = useMutation({
    mutationFn: () =>
      editingRegionId
        ? updatePricingRegion(editingRegionId, {
            code: regionForm.code.trim().toUpperCase(),
            name: regionForm.name.trim(),
            aliases: regionForm.aliases
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
            sortOrder: regionForm.sortOrder
              ? parseNumber(regionForm.sortOrder)
              : undefined,
            isActive: regionForm.isActive,
          })
        : createPricingRegion({
            code: regionForm.code.trim().toUpperCase(),
            name: regionForm.name.trim(),
            aliases: regionForm.aliases
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
            sortOrder: regionForm.sortOrder
              ? parseNumber(regionForm.sortOrder)
              : undefined,
            isActive: regionForm.isActive,
          }),
    onSuccess: () => {
      toast.success(
        editingRegionId
          ? t("pricingPage.toast.regionUpdated")
          : t("pricingPage.toast.regionCreated"),
      );
      resetRegionForm();
      queryClient.invalidateQueries({ queryKey: ["pricing", "regions"] });
    },
    onError: () => toast.error(t("pricingPage.toast.actionFailed")),
  });

  const slaSubmitMutation = useMutation({
    mutationFn: () =>
      editingSlaRuleId
        ? updateDeliverySlaRule(editingSlaRuleId, {
            name: slaForm.name.trim(),
            description: slaForm.description.trim() || null,
            serviceType: slaForm.serviceType,
            originRegionId:
              slaForm.matchMode === "exact_route" &&
              slaForm.originRegionId !== "all"
                ? slaForm.originRegionId
                : null,
            destinationRegionId:
              slaForm.matchMode === "exact_route" &&
              slaForm.destinationRegionId !== "all"
                ? slaForm.destinationRegionId
                : null,
            zone:
              slaForm.matchMode === "zone"
                ? parseNumber(slaForm.zone, 0)
                : null,
            deliveryDays: parseNumber(slaForm.deliveryDays, 1),
            priority: parseNumber(slaForm.priority, 0),
            isActive: slaForm.isActive,
          })
        : createDeliverySlaRule({
            name: slaForm.name.trim(),
            description: slaForm.description.trim() || null,
            serviceType: slaForm.serviceType,
            originRegionId:
              slaForm.matchMode === "exact_route" &&
              slaForm.originRegionId !== "all"
                ? slaForm.originRegionId
                : null,
            destinationRegionId:
              slaForm.matchMode === "exact_route" &&
              slaForm.destinationRegionId !== "all"
                ? slaForm.destinationRegionId
                : null,
            zone:
              slaForm.matchMode === "zone"
                ? parseNumber(slaForm.zone, 0)
                : null,
            deliveryDays: parseNumber(slaForm.deliveryDays, 1),
            priority: parseNumber(slaForm.priority, 0),
            isActive: slaForm.isActive,
          }),
    onSuccess: () => {
      toast.success(
        editingSlaRuleId
          ? t("pricingPage.toast.slaUpdated")
          : t("pricingPage.toast.slaCreated"),
      );
      resetSlaForm();
      queryClient.invalidateQueries({ queryKey: ["pricing", "sla-rules"] });
    },
    onError: () => toast.error(t("pricingPage.toast.actionFailed")),
  });

  const slaPolicyMutation = useMutation({
    mutationFn: () =>
      updateOperationalSlaPolicy({
        staleHours: parseNumber(slaPolicyForm.staleHours, 48),
        dueSoonHours: parseNumber(slaPolicyForm.dueSoonHours, 24),
        overdueGraceHours: parseNumber(slaPolicyForm.overdueGraceHours, 0),
      }),
    onSuccess: () => {
      toast.success(t("pricingPage.toast.slaPolicyUpdated"));
      queryClient.invalidateQueries({ queryKey: ["pricing", "sla-policy"] });
      queryClient.invalidateQueries({ queryKey: ["manager-analytics-summary"] });
    },
    onError: () => toast.error(t("pricingPage.toast.actionFailed")),
  });

  const saveZonesMutation = useMutation({
    mutationFn: () =>
      saveZoneMatrix({
        entries: regions.flatMap((origin) =>
          regions
            .map((destination) => {
              const raw =
                zoneDraft[keyForZone(origin.id, destination.id)] ?? "";
              if (!raw.trim()) return null;
              return {
                originRegionId: origin.id,
                destinationRegionId: destination.id,
                zone: parseNumber(raw),
              };
            })
            .filter(
              (
                entry,
              ): entry is {
                originRegionId: string;
                destinationRegionId: string;
                zone: number;
              } => entry !== null,
            ),
        ),
      }),
    onSuccess: () => {
      toast.success(t("pricingPage.toast.zoneSaved"));
      queryClient.invalidateQueries({ queryKey: ["pricing", "zones"] });
    },
    onError: () => toast.error(t("pricingPage.toast.actionFailed")),
  });
  const tariffSubmitMutation = useMutation({
    mutationFn: () =>
      editingPlanId
        ? updateTariffPlan(editingPlanId, {
            name: tariffForm.name.trim(),
            code: tariffForm.code.trim() || null,
            description: tariffForm.description.trim() || null,
            status: tariffForm.status,
            serviceType: tariffForm.serviceType,
            priceType: tariffForm.priceType,
            currency: tariffForm.currency.trim().toUpperCase() || "UZS",
            priority: parseNumber(tariffForm.priority),
            isDefault: tariffForm.isDefault,
            customerEntityId:
              tariffForm.customerEntityId === "all"
                ? null
                : tariffForm.customerEntityId,
            rates: tariffForm.rates.map((rate) => ({
              zone: parseNumber(rate.zone),
              weightFromKg: parseNumber(rate.weightFromKg),
              weightToKg: parseNumber(rate.weightToKg),
              price: parseNumber(rate.price),
            })),
          })
        : createTariffPlan({
            name: tariffForm.name.trim(),
            code: tariffForm.code.trim() || null,
            description: tariffForm.description.trim() || null,
            status: tariffForm.status,
            serviceType: tariffForm.serviceType,
            priceType: tariffForm.priceType,
            currency: tariffForm.currency.trim().toUpperCase() || "UZS",
            priority: parseNumber(tariffForm.priority),
            isDefault: tariffForm.isDefault,
            customerEntityId:
              tariffForm.customerEntityId === "all"
                ? null
                : tariffForm.customerEntityId,
            rates: tariffForm.rates.map((rate) => ({
              zone: parseNumber(rate.zone),
              weightFromKg: parseNumber(rate.weightFromKg),
              weightToKg: parseNumber(rate.weightToKg),
              price: parseNumber(rate.price),
            })),
          }),
    onSuccess: () => {
      toast.success(
        editingPlanId
          ? t("pricingPage.toast.planUpdated")
          : t("pricingPage.toast.planCreated"),
      );
      resetTariffForm();
      queryClient.invalidateQueries({ queryKey: ["pricing", "plans"] });
    },
    onError: () => toast.error(t("pricingPage.toast.actionFailed")),
  });

  const startRegionEdit = React.useCallback((region: PricingRegion) => {
    setEditingRegionId(region.id);
    setRegionForm({
      code: region.code,
      name: region.name,
      aliases: region.aliases.join(", "),
      sortOrder: String(region.sortOrder),
      isActive: region.isActive,
    });
  }, []);

  const startSlaEdit = React.useCallback((rule: DeliverySlaRule) => {
    setEditingSlaRuleId(rule.id);
    setSlaForm({
      name: rule.name,
      description: rule.description ?? "",
      serviceType: rule.serviceType,
      matchMode: detectSlaMatchMode(rule),
      originRegionId: rule.originRegionId ?? "all",
      destinationRegionId: rule.destinationRegionId ?? "all",
      zone: String(rule.zone ?? 0),
      deliveryDays: String(rule.deliveryDays),
      priority: String(rule.priority ?? 0),
      isActive: rule.isActive,
    });
  }, []);

  const startTariffEdit = React.useCallback(
    async (planId: string) => {
      try {
        setLoadingPlanId(planId);
        const plan = await fetchTariffPlan(planId);
        setEditingPlanId(plan.id);
        setTariffForm({
          name: plan.name,
          code: plan.code ?? "",
          description: plan.description ?? "",
          status: plan.status,
          serviceType: plan.serviceType,
          priceType: plan.priceType,
          currency: plan.currency,
          priority: String(plan.priority ?? 0),
          isDefault: plan.isDefault,
          customerEntityId: plan.customerEntityId ?? "all",
          rates: plan.rates.length
            ? plan.rates.map((rate) =>
                makeRateDraft({
                  zone: String(rate.zone),
                  weightFromKg: String(rate.weightFromKg),
                  weightToKg: String(rate.weightToKg),
                  price: String(rate.price),
                }),
              )
            : [makeRateDraft()],
        });
      } catch {
        toast.error(t("pricingPage.toast.actionFailed"));
      } finally {
        setLoadingPlanId(null);
      }
    },
    [t],
  );

  const stats = React.useMemo(() => {
    const plans = tariffPlansQuery.data ?? [];
    return {
      regions: regions.length,
      zoneLinks: zoneMatrixQuery.data?.length ?? 0,
      plans: plans.length,
      activePlans: plans.filter((plan) => plan.status === "active").length,
    };
  }, [regions.length, tariffPlansQuery.data, zoneMatrixQuery.data]);

  return (
    <PageShell className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-border/70 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.10),_transparent_42%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.08),_transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] px-6 py-6 shadow-sm sm:px-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl space-y-3">
            <Badge
              variant="outline"
              className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.28em]"
            >
              {t("pricingPage.badge")}
            </Badge>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">
                {t("pricingPage.title")}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                {t("pricingPage.subtitle")}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px]">
            {[
              {
                icon: Layers3,
                tone: "text-sky-600 bg-sky-500/10",
                label: t("pricingPage.stats.regions"),
                value: stats.regions,
              },
              {
                icon: Map,
                tone: "text-emerald-600 bg-emerald-500/10",
                label: t("pricingPage.stats.zoneLinks"),
                value: stats.zoneLinks,
              },
              {
                icon: CircleDollarSign,
                tone: "text-violet-600 bg-violet-500/10",
                label: t("pricingPage.stats.plans"),
                value: stats.plans,
              },
              {
                icon: Sparkles,
                tone: "text-amber-600 bg-amber-500/10",
                label: t("pricingPage.stats.activePlans"),
                value: stats.activePlans,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Card
                  key={item.label}
                  className="border-border/60 bg-background/90"
                >
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className={`rounded-2xl p-2 ${item.tone}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                        {item.label}
                      </div>
                      <div className="mt-1 text-2xl font-semibold">
                        {item.value}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <Tabs defaultValue="regions" className="space-y-6">
        <TabsList className="h-auto w-full justify-start gap-2 rounded-2xl border bg-background p-1">
          <TabsTrigger
            value="regions"
            className="rounded-xl px-4 py-2 data-[state=active]:bg-zinc-900 data-[state=active]:text-white"
          >
            {t("pricingPage.tabs.regions")}
          </TabsTrigger>
          <TabsTrigger
            value="zones"
            className="rounded-xl px-4 py-2 data-[state=active]:bg-zinc-900 data-[state=active]:text-white"
          >
            {t("pricingPage.tabs.zones")}
          </TabsTrigger>
          <TabsTrigger
            value="sla"
            className="rounded-xl px-4 py-2 data-[state=active]:bg-zinc-900 data-[state=active]:text-white"
          >
            {t("pricingPage.tabs.sla")}
          </TabsTrigger>
          <TabsTrigger
            value="plans"
            className="rounded-xl px-4 py-2 data-[state=active]:bg-zinc-900 data-[state=active]:text-white"
          >
            {t("pricingPage.tabs.plans")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="regions" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.05fr_1.2fr]">
            <Card className="border-border/70">
              <CardHeader>
                <CardTitle>{t("pricingPage.regions.createTitle")}</CardTitle>
                <CardDescription>
                  {t("pricingPage.regions.createDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {editingRegionId ? (
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                    <span>{t("pricingPage.regions.editing")}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={resetRegionForm}
                    >
                      <X className="mr-2 h-4 w-4" />
                      {t("pricingPage.shared.cancelEdit")}
                    </Button>
                  </div>
                ) : null}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="region-code">
                      {t("pricingPage.regions.code")}
                    </Label>
                    <Input
                      id="region-code"
                      value={regionForm.code}
                      onChange={(event) =>
                        setRegionForm((current) => ({
                          ...current,
                          code: event.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="TAS"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="region-name">
                      {t("pricingPage.regions.name")}
                    </Label>
                    <Input
                      id="region-name"
                      value={regionForm.name}
                      onChange={(event) =>
                        setRegionForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder={t("pricingPage.regions.namePlaceholder")}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr_160px]">
                  <div className="space-y-2">
                    <Label htmlFor="region-aliases">
                      {t("pricingPage.regions.aliases")}
                    </Label>
                    <Textarea
                      id="region-aliases"
                      value={regionForm.aliases}
                      onChange={(event) =>
                        setRegionForm((current) => ({
                          ...current,
                          aliases: event.target.value,
                        }))
                      }
                      placeholder={t("pricingPage.regions.aliasesPlaceholder")}
                      className="min-h-24"
                    />
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="region-sort-order">
                        {t("pricingPage.regions.sortOrder")}
                      </Label>
                      <Input
                        id="region-sort-order"
                        type="number"
                        value={regionForm.sortOrder}
                        onChange={(event) =>
                          setRegionForm((current) => ({
                            ...current,
                            sortOrder: event.target.value,
                          }))
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="rounded-2xl border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">
                            {t("pricingPage.regions.active")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("pricingPage.regions.activeHint")}
                          </p>
                        </div>
                        <Switch
                          checked={regionForm.isActive}
                          onCheckedChange={(checked) =>
                            setRegionForm((current) => ({
                              ...current,
                              isActive: checked,
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => regionSubmitMutation.mutate()}
                    disabled={
                      regionSubmitMutation.isPending ||
                      !regionForm.code.trim() ||
                      !regionForm.name.trim()
                    }
                    className="w-full sm:w-auto"
                  >
                    {editingRegionId ? (
                      <Save className="mr-2 h-4 w-4" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    {editingRegionId
                      ? t("pricingPage.regions.saveRegion")
                      : t("pricingPage.regions.addRegion")}
                  </Button>
                  {editingRegionId ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetRegionForm}
                    >
                      {t("pricingPage.shared.cancelEdit")}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle>{t("pricingPage.regions.listTitle")}</CardTitle>
                  <CardDescription>
                    {t("pricingPage.regions.listDescription")}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => regionsQuery.refetch()}
                  disabled={regionsQuery.isFetching}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t("pricingPage.shared.refresh")}
                </Button>
              </CardHeader>
              <CardContent>
                {regionsQuery.isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : regions.length ? (
                  <div className="space-y-3">
                    {regions.map((region) => (
                      <div
                        key={region.id}
                        className="rounded-2xl border border-border/70 bg-background/80 p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-base font-semibold">
                                {region.name}
                              </div>
                              <Badge variant="outline" className="rounded-full">
                                {region.code}
                              </Badge>
                              <Badge
                                variant={
                                  region.isActive ? "default" : "secondary"
                                }
                                className="rounded-full"
                              >
                                {region.isActive
                                  ? t("pricingPage.shared.active")
                                  : t("pricingPage.shared.inactive")}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {region.aliases.length
                                ? region.aliases.join(", ")
                                : t("pricingPage.regions.noAliases")}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 self-start">
                            <div className="text-sm text-muted-foreground">
                              {t("pricingPage.regions.sortOrderValue", {
                                value: region.sortOrder,
                              })}
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => startRegionEdit(region)}
                            >
                              <PencilLine className="mr-2 h-4 w-4" />
                              {t("pricingPage.shared.edit")}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                    {t("pricingPage.regions.empty")}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="zones" className="space-y-6">
          <Card className="border-border/70">
            <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <CardTitle>{t("pricingPage.zones.title")}</CardTitle>
                <CardDescription>
                  {t("pricingPage.zones.description")}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => zoneMatrixQuery.refetch()}
                  disabled={zoneMatrixQuery.isFetching}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t("pricingPage.shared.refresh")}
                </Button>
                <Button
                  size="sm"
                  onClick={() => saveZonesMutation.mutate()}
                  disabled={saveZonesMutation.isPending || regions.length === 0}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {t("pricingPage.zones.saveMatrix")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {zoneMatrixQuery.isLoading ? (
                <Skeleton className="h-72 w-full" />
              ) : regions.length ? (
                <>
                  <div className="rounded-2xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                    {t("pricingPage.zones.legend")}
                  </div>
                  <ScrollArea className="w-full whitespace-nowrap rounded-2xl border">
                    <div className="min-w-[720px] p-4">
                      <div
                        className="grid gap-2"
                        style={{
                          gridTemplateColumns: `200px repeat(${regions.length}, minmax(96px, 1fr))`,
                        }}
                      >
                        <div className="sticky left-0 z-10 rounded-xl bg-background px-3 py-2 text-sm font-medium text-muted-foreground">
                          {t("pricingPage.zones.originToDestination")}
                        </div>
                        {regions.map((region) => (
                          <div
                            key={`header-${region.id}`}
                            className="rounded-xl bg-muted px-3 py-2 text-center text-sm font-medium"
                          >
                            {region.name}
                          </div>
                        ))}
                        {regions.map((origin) => (
                          <React.Fragment key={`row-${origin.id}`}>
                            <div className="sticky left-0 z-10 rounded-xl bg-background px-3 py-2 text-sm font-medium">
                              <div>{origin.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {origin.code}
                              </div>
                            </div>
                            {regions.map((destination) => {
                              const zoneKey = keyForZone(
                                origin.id,
                                destination.id,
                              );
                              return (
                                <Input
                                  key={zoneKey}
                                  type="number"
                                  inputMode="numeric"
                                  value={zoneDraft[zoneKey] ?? ""}
                                  onChange={(event) =>
                                    setZoneDraft((current) => ({
                                      ...current,
                                      [zoneKey]: event.target.value,
                                    }))
                                  }
                                  className="h-11 text-center"
                                />
                              );
                            })}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                  {t("pricingPage.zones.empty")}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sla" className="space-y-6">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>{t("pricingPage.sla.policyTitle")}</CardTitle>
              <CardDescription>
                {t("pricingPage.sla.policyDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="sla-policy-stale">
                    {t("pricingPage.sla.policyStaleHours")}
                  </Label>
                  <Input
                    id="sla-policy-stale"
                    type="number"
                    min={6}
                    max={720}
                    value={slaPolicyForm.staleHours}
                    onChange={(event) =>
                      setSlaPolicyForm((current) => ({
                        ...current,
                        staleHours: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sla-policy-due-soon">
                    {t("pricingPage.sla.policyDueSoonHours")}
                  </Label>
                  <Input
                    id="sla-policy-due-soon"
                    type="number"
                    min={1}
                    max={168}
                    value={slaPolicyForm.dueSoonHours}
                    onChange={(event) =>
                      setSlaPolicyForm((current) => ({
                        ...current,
                        dueSoonHours: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sla-policy-overdue-grace">
                    {t("pricingPage.sla.policyOverdueGraceHours")}
                  </Label>
                  <Input
                    id="sla-policy-overdue-grace"
                    type="number"
                    min={0}
                    max={168}
                    value={slaPolicyForm.overdueGraceHours}
                    onChange={(event) =>
                      setSlaPolicyForm((current) => ({
                        ...current,
                        overdueGraceHours: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={() => slaPolicyMutation.mutate()}
                  disabled={
                    slaPolicyMutation.isPending ||
                    !slaPolicyForm.staleHours.trim() ||
                    !slaPolicyForm.dueSoonHours.trim() ||
                    !slaPolicyForm.overdueGraceHours.trim()
                  }
                >
                  <Save className="mr-2 h-4 w-4" />
                  {t("pricingPage.sla.savePolicy")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => slaPolicyQuery.refetch()}
                  disabled={slaPolicyQuery.isFetching}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t("pricingPage.shared.refresh")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[1.02fr_1.2fr]">
            <Card className="border-border/70">
              <CardHeader>
                <CardTitle>{t("pricingPage.sla.createTitle")}</CardTitle>
                <CardDescription>
                  {t("pricingPage.sla.createDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {editingSlaRuleId ? (
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
                    <span>{t("pricingPage.sla.editing")}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={resetSlaForm}
                    >
                      <X className="mr-2 h-4 w-4" />
                      {t("pricingPage.shared.cancelEdit")}
                    </Button>
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="sla-name">
                      {t("pricingPage.sla.name")}
                    </Label>
                    <Input
                      id="sla-name"
                      value={slaForm.name}
                      onChange={(event) =>
                        setSlaForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder={t("pricingPage.sla.namePlaceholder")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("pricingPage.sla.serviceType")}</Label>
                    <Select
                      value={slaForm.serviceType}
                      onValueChange={(value: ServiceType) =>
                        setSlaForm((current) => ({
                          ...current,
                          serviceType: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SERVICE_TYPES.map((serviceType) => (
                          <SelectItem key={serviceType} value={serviceType}>
                            {getServiceTypeLabel(serviceType, t)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sla-description">
                    {t("pricingPage.sla.description")}
                  </Label>
                  <Textarea
                    id="sla-description"
                    value={slaForm.description}
                    onChange={(event) =>
                      setSlaForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder={t("pricingPage.sla.descriptionPlaceholder")}
                    className="min-h-20"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>{t("pricingPage.sla.matchMode")}</Label>
                    <Select
                      value={slaForm.matchMode}
                      onValueChange={(value: SlaMatchMode) =>
                        setSlaForm((current) => ({
                          ...current,
                          matchMode: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="service_default">
                          {t("pricingPage.sla.mode.service_default")}
                        </SelectItem>
                        <SelectItem value="zone">
                          {t("pricingPage.sla.mode.zone")}
                        </SelectItem>
                        <SelectItem value="exact_route">
                          {t("pricingPage.sla.mode.exact_route")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {slaForm.matchMode === "service_default" ? (
                      <p className="text-xs text-muted-foreground">
                        {t("pricingPage.sla.serviceDefaultHint")}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sla-days">
                      {t("pricingPage.sla.deliveryDays")}
                    </Label>
                    <Input
                      id="sla-days"
                      type="number"
                      min={1}
                      value={slaForm.deliveryDays}
                      onChange={(event) =>
                        setSlaForm((current) => ({
                          ...current,
                          deliveryDays: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sla-priority">
                      {t("pricingPage.sla.priority")}
                    </Label>
                    <Input
                      id="sla-priority"
                      type="number"
                      min={0}
                      value={slaForm.priority}
                      onChange={(event) =>
                        setSlaForm((current) => ({
                          ...current,
                          priority: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                {slaForm.matchMode === "zone" ? (
                  <div className="space-y-2">
                    <Label htmlFor="sla-zone">
                      {t("pricingPage.sla.zone")}
                    </Label>
                    <Input
                      id="sla-zone"
                      type="number"
                      min={0}
                      value={slaForm.zone}
                      onChange={(event) =>
                        setSlaForm((current) => ({
                          ...current,
                          zone: event.target.value,
                        }))
                      }
                    />
                  </div>
                ) : null}

                {slaForm.matchMode === "exact_route" ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t("pricingPage.sla.originRegion")}</Label>
                      <Select
                        value={slaForm.originRegionId}
                        onValueChange={(value) =>
                          setSlaForm((current) => ({
                            ...current,
                            originRegionId: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            {t("pricingPage.sla.selectRegion")}
                          </SelectItem>
                          {regions.map((region) => (
                            <SelectItem
                              key={`sla-origin-${region.id}`}
                              value={region.id}
                            >
                              {region.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("pricingPage.sla.destinationRegion")}</Label>
                      <Select
                        value={slaForm.destinationRegionId}
                        onValueChange={(value) =>
                          setSlaForm((current) => ({
                            ...current,
                            destinationRegionId: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            {t("pricingPage.sla.selectRegion")}
                          </SelectItem>
                          {regions.map((region) => (
                            <SelectItem
                              key={`sla-destination-${region.id}`}
                              value={region.id}
                            >
                              {region.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : null}

                <div className="rounded-2xl border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        {t("pricingPage.sla.active")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("pricingPage.sla.activeHint")}
                      </p>
                    </div>
                    <Switch
                      checked={slaForm.isActive}
                      onCheckedChange={(checked) =>
                        setSlaForm((current) => ({
                          ...current,
                          isActive: checked,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => slaSubmitMutation.mutate()}
                    disabled={
                      slaSubmitMutation.isPending ||
                      !slaForm.name.trim() ||
                      !slaForm.deliveryDays.trim() ||
                      (slaForm.matchMode === "exact_route" &&
                        (slaForm.originRegionId === "all" ||
                          slaForm.destinationRegionId === "all"))
                    }
                    className="w-full sm:w-auto"
                  >
                    {editingSlaRuleId ? (
                      <Save className="mr-2 h-4 w-4" />
                    ) : (
                      <Route className="mr-2 h-4 w-4" />
                    )}
                    {editingSlaRuleId
                      ? t("pricingPage.sla.saveRule")
                      : t("pricingPage.sla.addRule")}
                  </Button>
                  {editingSlaRuleId ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetSlaForm}
                    >
                      {t("pricingPage.shared.cancelEdit")}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle>{t("pricingPage.sla.listTitle")}</CardTitle>
                  <CardDescription>
                    {t("pricingPage.sla.listDescription")}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => slaRulesQuery.refetch()}
                  disabled={slaRulesQuery.isFetching}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t("pricingPage.shared.refresh")}
                </Button>
              </CardHeader>
              <CardContent>
                {slaRulesQuery.isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : slaRulesQuery.data?.length ? (
                  <div className="space-y-3">
                    {slaRulesQuery.data.map((rule) => {
                      const matchMode = detectSlaMatchMode(rule);
                      const routeText =
                        matchMode === "exact_route"
                          ? `${rule.originRegion?.name} -> ${rule.destinationRegion?.name}`
                          : matchMode === "zone"
                            ? t("pricingPage.sla.zoneValue", {
                                value: rule.zone ?? 0,
                              })
                            : t("pricingPage.sla.mode.service_default");

                      return (
                        <div
                          key={rule.id}
                          className="rounded-2xl border border-border/70 bg-background/80 p-4"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-base font-semibold">
                                  {rule.name}
                                </div>
                                <Badge
                                  variant={
                                    rule.isActive ? "default" : "secondary"
                                  }
                                  className="rounded-full"
                                >
                                  {rule.isActive
                                    ? t("pricingPage.shared.active")
                                    : t("pricingPage.shared.inactive")}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className="rounded-full"
                                >
                                  {getServiceTypeLabel(rule.serviceType, t)}
                                </Badge>
                                <Badge
                                  variant="secondary"
                                  className="rounded-full"
                                >
                                  {t(`pricingPage.sla.mode.${matchMode}`)}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                                <span>{routeText}</span>
                                <span>
                                  {t("pricingPage.sla.daysValue", {
                                    value: rule.deliveryDays,
                                  })}
                                </span>
                                <span>
                                  {t("pricingPage.sla.priorityValue", {
                                    value: rule.priority,
                                  })}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {rule.description ||
                                  t("pricingPage.plans.noDescription")}
                              </p>
                            </div>
                            <div className="pt-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => startSlaEdit(rule)}
                              >
                                <PencilLine className="mr-2 h-4 w-4" />
                                {t("pricingPage.shared.edit")}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                    {t("pricingPage.sla.empty")}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="plans" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.1fr_1.35fr]">
            <Card className="border-border/70">
              <CardHeader>
                <CardTitle>{t("pricingPage.plans.createTitle")}</CardTitle>
                <CardDescription>
                  {t("pricingPage.plans.createDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {editingPlanId ? (
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    <span>{t("pricingPage.plans.editing")}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={resetTariffForm}
                    >
                      <X className="mr-2 h-4 w-4" />
                      {t("pricingPage.shared.cancelEdit")}
                    </Button>
                  </div>
                ) : null}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="plan-name">
                      {t("pricingPage.plans.name")}
                    </Label>
                    <Input
                      id="plan-name"
                      value={tariffForm.name}
                      onChange={(event) =>
                        setTariffForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder={t("pricingPage.plans.namePlaceholder")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plan-code">
                      {t("pricingPage.plans.code")}
                    </Label>
                    <Input
                      id="plan-code"
                      value={tariffForm.code}
                      onChange={(event) =>
                        setTariffForm((current) => ({
                          ...current,
                          code: event.target.value,
                        }))
                      }
                      placeholder="TAS-D2D-ACTIVE"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="plan-description">
                    {t("pricingPage.plans.description")}
                  </Label>
                  <Textarea
                    id="plan-description"
                    value={tariffForm.description}
                    onChange={(event) =>
                      setTariffForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder={t("pricingPage.plans.descriptionPlaceholder")}
                    className="min-h-24"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div className="space-y-2">
                    <Label>{t("pricingPage.plans.status")}</Label>
                    <Select
                      value={tariffForm.status}
                      onValueChange={(value: TariffPlanStatus) =>
                        setTariffForm((current) => ({
                          ...current,
                          status: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status} value={status}>
                            {t(`pricingPage.status.${status}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("pricingPage.plans.serviceType")}</Label>
                    <Select
                      value={tariffForm.serviceType}
                      onValueChange={(value: ServiceType) =>
                        setTariffForm((current) => ({
                          ...current,
                          serviceType: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SERVICE_TYPES.map((serviceType) => (
                          <SelectItem key={serviceType} value={serviceType}>
                            {getServiceTypeLabel(serviceType, t)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("pricingPage.plans.priceType")}</Label>
                    <Select
                      value={tariffForm.priceType}
                      onValueChange={(value: TariffPriceType) =>
                        setTariffForm((current) => ({
                          ...current,
                          priceType: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRICE_TYPES.map((priceType) => (
                          <SelectItem key={priceType} value={priceType}>
                            {t(`pricingPage.priceType.${priceType}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plan-currency">
                      {t("pricingPage.plans.currency")}
                    </Label>
                    <Input
                      id="plan-currency"
                      value={tariffForm.currency}
                      onChange={(event) =>
                        setTariffForm((current) => ({
                          ...current,
                          currency: event.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="UZS"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plan-priority">
                      {t("pricingPage.plans.priority")}
                    </Label>
                    <Input
                      id="plan-priority"
                      type="number"
                      value={tariffForm.priority}
                      onChange={(event) =>
                        setTariffForm((current) => ({
                          ...current,
                          priority: event.target.value,
                        }))
                      }
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("pricingPage.plans.customer")}</Label>
                    <Select
                      value={tariffForm.customerEntityId}
                      onValueChange={(value) =>
                        setTariffForm((current) => ({
                          ...current,
                          customerEntityId: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t("pricingPage.plans.customerAll")}
                        </SelectItem>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.companyName || customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-2xl border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        {t("pricingPage.plans.default")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("pricingPage.plans.defaultHint")}
                      </p>
                    </div>
                    <Switch
                      checked={tariffForm.isDefault}
                      onCheckedChange={(checked) =>
                        setTariffForm((current) => ({
                          ...current,
                          isDefault: checked,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/15 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">
                        {t("pricingPage.plans.ratesTitle")}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {t("pricingPage.plans.ratesDescription")}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setTariffForm((current) => ({
                          ...current,
                          rates: [...current.rates, makeRateDraft()],
                        }))
                      }
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {t("pricingPage.plans.addRate")}
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {tariffForm.rates.map((rate) => (
                      <div
                        key={rate.id}
                        className="grid gap-3 rounded-2xl border bg-background p-3 md:grid-cols-[0.7fr_1fr_1fr_1fr_auto]"
                      >
                        <div className="space-y-2">
                          <Label>{t("pricingPage.plans.zone")}</Label>
                          <Input
                            type="number"
                            value={rate.zone}
                            onChange={(event) =>
                              setTariffForm((current) => ({
                                ...current,
                                rates: current.rates.map((item) =>
                                  item.id === rate.id
                                    ? { ...item, zone: event.target.value }
                                    : item,
                                ),
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t("pricingPage.plans.weightFrom")}</Label>
                          <Input
                            type="number"
                            value={rate.weightFromKg}
                            onChange={(event) =>
                              setTariffForm((current) => ({
                                ...current,
                                rates: current.rates.map((item) =>
                                  item.id === rate.id
                                    ? {
                                        ...item,
                                        weightFromKg: event.target.value,
                                      }
                                    : item,
                                ),
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t("pricingPage.plans.weightTo")}</Label>
                          <Input
                            type="number"
                            value={rate.weightToKg}
                            onChange={(event) =>
                              setTariffForm((current) => ({
                                ...current,
                                rates: current.rates.map((item) =>
                                  item.id === rate.id
                                    ? {
                                        ...item,
                                        weightToKg: event.target.value,
                                      }
                                    : item,
                                ),
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t("pricingPage.plans.price")}</Label>
                          <Input
                            type="number"
                            value={rate.price}
                            onChange={(event) =>
                              setTariffForm((current) => ({
                                ...current,
                                rates: current.rates.map((item) =>
                                  item.id === rate.id
                                    ? { ...item, price: event.target.value }
                                    : item,
                                ),
                              }))
                            }
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={tariffForm.rates.length === 1}
                            onClick={() =>
                              setTariffForm((current) => ({
                                ...current,
                                rates: current.rates.filter(
                                  (item) => item.id !== rate.id,
                                ),
                              }))
                            }
                          >
                            {t("pricingPage.plans.removeRate")}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => tariffSubmitMutation.mutate()}
                    disabled={
                      tariffSubmitMutation.isPending || !tariffForm.name.trim()
                    }
                    className="w-full sm:w-auto"
                  >
                    {editingPlanId ? (
                      <Save className="mr-2 h-4 w-4" />
                    ) : (
                      <Calculator className="mr-2 h-4 w-4" />
                    )}
                    {editingPlanId
                      ? t("pricingPage.plans.savePlan")
                      : t("pricingPage.plans.createPlan")}
                  </Button>
                  {editingPlanId ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetTariffForm}
                    >
                      {t("pricingPage.shared.cancelEdit")}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/70">
              <CardHeader className="space-y-4">
                <div className="space-y-1">
                  <CardTitle>{t("pricingPage.plans.listTitle")}</CardTitle>
                  <CardDescription>
                    {t("pricingPage.plans.listDescription")}
                  </CardDescription>
                </div>
                <div className="grid gap-3 lg:grid-cols-[1.2fr_220px_220px_auto]">
                  <Input
                    value={planSearch}
                    onChange={(event) => setPlanSearch(event.target.value)}
                    placeholder={t("pricingPage.plans.searchPlaceholder")}
                  />
                  <Select
                    value={planStatusFilter}
                    onValueChange={(value: "all" | TariffPlanStatus) =>
                      setPlanStatusFilter(value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t("pricingPage.plans.statusAll")}
                      </SelectItem>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status} value={status}>
                          {t(`pricingPage.status.${status}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={planServiceTypeFilter}
                    onValueChange={(value: "all" | ServiceType) =>
                      setPlanServiceTypeFilter(value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t("pricingPage.plans.serviceTypeAll")}
                      </SelectItem>
                      {SERVICE_TYPES.map((serviceType) => (
                        <SelectItem key={serviceType} value={serviceType}>
                          {getServiceTypeLabel(serviceType, t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    onClick={() => tariffPlansQuery.refetch()}
                    disabled={tariffPlansQuery.isFetching}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t("pricingPage.shared.refresh")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {tariffPlansQuery.isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                  </div>
                ) : tariffPlansQuery.data?.length ? (
                  <div className="space-y-3">
                    {tariffPlansQuery.data.map((plan) => (
                      <div
                        key={plan.id}
                        className="rounded-2xl border border-border/70 bg-background/80 p-4"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-base font-semibold">
                                {plan.name}
                              </div>
                              <Badge
                                variant={planStatusVariant(plan.status)}
                                className="rounded-full"
                              >
                                {t(`pricingPage.status.${plan.status}`)}
                              </Badge>
                              <Badge variant="outline" className="rounded-full">
                                {getServiceTypeLabel(plan.serviceType, t)}
                              </Badge>
                              <Badge
                                variant="secondary"
                                className="rounded-full"
                              >
                                {t(`pricingPage.priceType.${plan.priceType}`)}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                              <span>
                                {plan.code || t("pricingPage.plans.noCode")}
                              </span>
                              <span>{plan.currency}</span>
                              <span>
                                {t("pricingPage.plans.priorityValue", {
                                  value: plan.priority,
                                })}
                              </span>
                              <span>
                                {t("pricingPage.plans.ratesValue", {
                                  value: plan._count?.rates ?? 0,
                                })}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {plan.description ||
                                t("pricingPage.plans.noDescription")}
                            </p>
                          </div>
                          <div className="space-y-2 text-sm text-muted-foreground lg:text-right">
                            <div>
                              {plan.customerEntity?.name ||
                                t("pricingPage.plans.customerAll")}
                            </div>
                            <div>
                              {plan.isDefault
                                ? t("pricingPage.plans.defaultEnabled")
                                : t("pricingPage.plans.defaultDisabled")}
                            </div>
                            <div className="pt-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => startTariffEdit(plan.id)}
                                disabled={loadingPlanId === plan.id}
                              >
                                <PencilLine className="mr-2 h-4 w-4" />
                                {loadingPlanId === plan.id
                                  ? t("pricingPage.shared.loading")
                                  : t("pricingPage.shared.edit")}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                    {t("pricingPage.plans.empty")}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
