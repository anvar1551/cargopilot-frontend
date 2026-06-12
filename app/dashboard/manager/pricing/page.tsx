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
import { listRouteTemplates, type RouteTemplate } from "@/lib/integrations";
import { cn } from "@/lib/utils";
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
  deleteDeliverySlaRule,
  deletePricingRegion,
  deleteTariffPlan,
  fetchPricingCatalog,
  fetchDeliverySlaRules,
  fetchOperationalSlaPolicy,
  fetchTariffPlan,
  fetchPricingRegions,
  fetchTariffPlansPage,
  fetchZoneMatrix,
  saveZoneMatrix,
  type DeliverySlaRule,
  type PricingRegion,
  type TariffCoverageType,
  type TariffPricingStrategy,
  type TariffPlanStatus,
  type TariffPriceType,
  type TransitLegRate,
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
  Trash2,
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
type TransitLegDraft = {
  id: string;
  sequence: string;
  legCode: string;
  label: string;
  mode: string;
  originCountryCode: string;
  destinationCountryCode: string;
  ratePerKg: string;
  minCharge: string;
  flatFee: string;
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
  pricingStrategy: TariffPricingStrategy;
  coverageType: TariffCoverageType;
  transportMode: string;
  originCountryCode: string;
  destinationCountryCode: string;
  routeTemplateId: string;
  currency: string;
  priority: string;
  isDefault: boolean;
  customerEntityId: string;
  rates: RateDraft[];
  transitLegRates: TransitLegDraft[];
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
type PricingDeleteTarget =
  | { type: "region"; id: string; name: string }
  | { type: "sla"; id: string; name: string }
  | { type: "tariff"; id: string; name: string };

const STATUS_OPTIONS: TariffPlanStatus[] = ["draft", "active", "archived"];
const PRICE_TYPES: TariffPriceType[] = ["bucket", "linear"];
const COVERAGE_TYPES: TariffCoverageType[] = ["domestic", "international"];
const PRICING_STRATEGIES: TariffPricingStrategy[] = [
  "FIXED_LANE",
  "LEG_TRANSIT",
];

function makeRateDraft(partial?: Partial<RateDraft>): RateDraft {
  return {
    id: Math.random().toString(36).slice(2, 10),
    zone: partial?.zone ?? "0",
    weightFromKg: partial?.weightFromKg ?? "0",
    weightToKg: partial?.weightToKg ?? "1",
    price: partial?.price ?? "",
  };
}

function makeTransitLegDraft(
  partial?: Partial<TransitLegDraft>,
): TransitLegDraft {
  return {
    id: Math.random().toString(36).slice(2, 10),
    sequence: partial?.sequence ?? "1",
    legCode: partial?.legCode ?? "",
    label: partial?.label ?? "",
    mode: partial?.mode ?? "",
    originCountryCode: partial?.originCountryCode ?? "",
    destinationCountryCode: partial?.destinationCountryCode ?? "",
    ratePerKg: partial?.ratePerKg ?? "",
    minCharge: partial?.minCharge ?? "0",
    flatFee: partial?.flatFee ?? "0",
  };
}

function buildTransitLegDraftsFromRouteTemplate(
  route: RouteTemplate,
  existing: TransitLegDraft[] = [],
) {
  const existingByCode = new globalThis.Map(
    existing
      .filter((leg) => leg.legCode.trim())
      .map((leg) => [leg.legCode.trim().toLowerCase(), leg]),
  );

  return [...(route.legs ?? [])]
    .sort((a, b) => a.sequence - b.sequence)
    .map((leg) => {
      const previous = existingByCode.get(leg.legCode.trim().toLowerCase());
      return makeTransitLegDraft({
        sequence: String(leg.sequence),
        legCode: leg.legCode,
        label: leg.label ?? "",
        mode: (leg.mode ?? "").toUpperCase(),
        originCountryCode: leg.originCountryCode ?? "",
        destinationCountryCode: leg.destinationCountryCode ?? "",
        ratePerKg: previous?.ratePerKg ?? "",
        minCharge: previous?.minCharge ?? "0",
        flatFee: previous?.flatFee ?? "0",
      });
    });
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
    pricingStrategy: "FIXED_LANE",
    coverageType: "domestic",
    transportMode: "ROAD",
    originCountryCode: "",
    destinationCountryCode: "",
    routeTemplateId: "none",
    currency: "UZS",
    priority: "0",
    isDefault: false,
    customerEntityId: "all",
    rates: [makeRateDraft()],
    transitLegRates: [],
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

function normalizeCountryCode(value: string) {
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : "";
}

function pricingStrategyLabel(value: TariffPricingStrategy) {
  return value === "LEG_TRANSIT" ? "Leg Transit" : "Fixed Lane";
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
  const [planCoverageFilter, setPlanCoverageFilter] = React.useState<
    "all" | TariffCoverageType
  >("all");
  const [planTransportFilter, setPlanTransportFilter] =
    React.useState<string>("all");
  const [planCursorStack, setPlanCursorStack] = React.useState<(string | null)[]>([null]);
  const [planCursorIndex, setPlanCursorIndex] = React.useState(0);
  const [pricingDeleteTarget, setPricingDeleteTarget] =
    React.useState<PricingDeleteTarget | null>(null);
  const [regionEditorOpen, setRegionEditorOpen] = React.useState(false);
  const [slaEditorOpen, setSlaEditorOpen] = React.useState(false);
  const [tariffEditorOpen, setTariffEditorOpen] = React.useState(false);

  const pricingCatalogQuery = useQuery({
    queryKey: ["pricing", "catalog"],
    queryFn: fetchPricingCatalog,
  });
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
  const planCursor = planCursorStack[planCursorIndex] ?? null;

  React.useEffect(() => {
    setPlanCursorStack([null]);
    setPlanCursorIndex(0);
  }, [planSearch, planStatusFilter, planServiceTypeFilter, planCoverageFilter, planTransportFilter]);

  const tariffPlansQuery = useQuery({
    queryKey: [
      "pricing",
      "plans",
      planSearch,
      planStatusFilter,
      planServiceTypeFilter,
      planCoverageFilter,
      planTransportFilter,
      planCursor,
    ],
    queryFn: () =>
      fetchTariffPlansPage({
        q: planSearch.trim() || undefined,
        status: planStatusFilter === "all" ? undefined : planStatusFilter,
        serviceType:
          planServiceTypeFilter === "all" ? undefined : planServiceTypeFilter,
        coverageType:
          planCoverageFilter === "all" ? undefined : planCoverageFilter,
        transportMode:
          planTransportFilter === "all"
            ? undefined
            : planTransportFilter.toUpperCase(),
        cursor: planCursor,
        limit: 10,
      }),
  });
  const customersQuery = useQuery({
    queryKey: ["pricing", "customers"],
    queryFn: () => fetchCustomers({ page: 1, limit: 200 }),
  });
  const routeTemplatesQuery = useQuery({
    queryKey: ["pricing", "route-templates"],
    queryFn: () => listRouteTemplates({ isActive: true }),
  });
  const customers = customersQuery.data?.data ?? [];
  const routeTemplates = routeTemplatesQuery.data ?? [];
  const selectedTariffRouteTemplate =
    routeTemplates.find((route) => route.id === tariffForm.routeTemplateId) ??
    null;
  const transportModes = pricingCatalogQuery.data?.transportModes ?? ["ROAD"];
  const pricingStrategies =
    pricingCatalogQuery.data?.pricingStrategies ?? PRICING_STRATEGIES;

  React.useEffect(() => {
    if (!transportModes.length) return;
    setTariffForm((current) => {
      const normalizedCurrent = current.transportMode.trim().toUpperCase();
      const nextMode = transportModes.includes(normalizedCurrent)
        ? normalizedCurrent
        : transportModes[0];
      if (nextMode === current.transportMode) return current;
      return {
        ...current,
        transportMode: nextMode,
      };
    });
  }, [transportModes]);

  React.useEffect(() => {
    if (!pricingStrategies.length) return;
    setTariffForm((current) => {
      const nextStrategy = pricingStrategies.includes(current.pricingStrategy)
        ? current.pricingStrategy
        : pricingStrategies[0];
      if (nextStrategy === current.pricingStrategy) return current;
      return {
        ...current,
        pricingStrategy: nextStrategy,
      };
    });
  }, [pricingStrategies]);

  React.useEffect(() => {
    if (!selectedTariffRouteTemplate) return;
    setTariffForm((current) => {
      if (
        current.pricingStrategy !== "LEG_TRANSIT" ||
        current.routeTemplateId !== selectedTariffRouteTemplate.id
      ) {
        return current;
      }

      const nextLegRates = buildTransitLegDraftsFromRouteTemplate(
        selectedTariffRouteTemplate,
        current.transitLegRates,
      );
      const currentIdentity = current.transitLegRates
        .map((leg) => `${leg.sequence}:${leg.legCode}:${leg.originCountryCode}:${leg.destinationCountryCode}`)
        .join("|");
      const nextIdentity = nextLegRates
        .map((leg) => `${leg.sequence}:${leg.legCode}:${leg.originCountryCode}:${leg.destinationCountryCode}`)
        .join("|");

      if (currentIdentity === nextIdentity) return current;
      return { ...current, transitLegRates: nextLegRates };
    });
  }, [selectedTariffRouteTemplate]);

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

  const openCreateRegion = React.useCallback(() => {
    resetRegionForm();
    setRegionEditorOpen(true);
  }, [resetRegionForm]);

  const openCreateSlaRule = React.useCallback(() => {
    resetSlaForm();
    setSlaEditorOpen(true);
  }, [resetSlaForm]);

  const openCreateTariffPlan = React.useCallback(() => {
    resetTariffForm();
    setTariffEditorOpen(true);
  }, [resetTariffForm]);

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
      setRegionEditorOpen(false);
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
      setSlaEditorOpen(false);
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
      queryClient.invalidateQueries({ queryKey: ["manager-analytics-v2-summary"] });
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

  const buildTransitLegPayload = React.useCallback((): TransitLegRate[] => {
    return tariffForm.transitLegRates
      .map((leg) => ({
        sequence: parseNumber(leg.sequence, 0),
        legCode: leg.legCode.trim(),
        label: leg.label.trim() || null,
        mode: leg.mode.trim().toUpperCase() || null,
        originCountryCode: normalizeCountryCode(leg.originCountryCode),
        destinationCountryCode: normalizeCountryCode(leg.destinationCountryCode),
        ratePerKg: parseNumber(leg.ratePerKg, Number.NaN),
        minCharge: parseNumber(leg.minCharge, 0),
        flatFee: parseNumber(leg.flatFee, 0),
      }))
      .filter((leg) => leg.legCode || Number.isFinite(leg.ratePerKg));
  }, [tariffForm.transitLegRates]);

  const tariffSubmitMutation = useMutation({
    mutationFn: async () => {
      if (
        tariffForm.pricingStrategy === "LEG_TRANSIT" &&
        tariffForm.routeTemplateId === "none"
      ) {
        throw new Error("Select a route template before using Leg Transit pricing.");
      }

      const normalizedTransportMode = tariffForm.transportMode
        .trim()
        .toUpperCase();
      const normalizedOriginCountryCode =
        tariffForm.coverageType === "international"
          ? normalizeCountryCode(tariffForm.originCountryCode) || null
          : null;
      const normalizedDestinationCountryCode =
        tariffForm.coverageType === "international"
          ? normalizeCountryCode(tariffForm.destinationCountryCode) || null
          : null;
      const transitLegRates = buildTransitLegPayload();

      const basePayload = {
        name: tariffForm.name.trim(),
        code: tariffForm.code.trim() || null,
        description: tariffForm.description.trim() || null,
        status: tariffForm.status,
        serviceType: tariffForm.serviceType,
        priceType: tariffForm.priceType,
        pricingStrategy: tariffForm.pricingStrategy,
        coverageType: tariffForm.coverageType,
        transportMode: normalizedTransportMode,
        originCountryCode: normalizedOriginCountryCode,
        destinationCountryCode: normalizedDestinationCountryCode,
        routeTemplateId:
          tariffForm.routeTemplateId === "none"
            ? null
            : tariffForm.routeTemplateId,
        currency: tariffForm.currency.trim().toUpperCase() || "UZS",
        priority: parseNumber(tariffForm.priority),
        isDefault: tariffForm.isDefault,
        customerEntityId:
          tariffForm.customerEntityId === "all"
            ? null
            : tariffForm.customerEntityId,
        rates:
          tariffForm.pricingStrategy === "FIXED_LANE"
            ? tariffForm.rates.map((rate) => ({
                zone: parseNumber(rate.zone),
                weightFromKg: parseNumber(rate.weightFromKg),
                weightToKg: parseNumber(rate.weightToKg),
                price: parseNumber(rate.price),
              }))
            : [],
        transitLegRates:
          tariffForm.pricingStrategy === "LEG_TRANSIT" ? transitLegRates : [],
      };

      if (editingPlanId) {
        return updateTariffPlan(editingPlanId, basePayload);
      }
      return createTariffPlan(basePayload);
    },
    onSuccess: () => {
      toast.success(
        editingPlanId
          ? t("pricingPage.toast.planUpdated")
          : t("pricingPage.toast.planCreated"),
      );
      resetTariffForm();
      setTariffEditorOpen(false);
      queryClient.invalidateQueries({ queryKey: ["pricing", "plans"] });
    },
    onError: (error: unknown) => {
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message?: unknown }).message || "")
          : "";
      toast.error(message || t("pricingPage.toast.actionFailed"));
    },
  });

  const pricingDeleteMutation = useMutation({
    mutationFn: (target: PricingDeleteTarget) => {
      if (target.type === "region") return deletePricingRegion(target.id);
      if (target.type === "sla") return deleteDeliverySlaRule(target.id);
      return deleteTariffPlan(target.id);
    },
    onSuccess: (_result, target) => {
      toast.success(`${target.name} deleted`);
      setPricingDeleteTarget(null);

      if (target.type === "region") {
        if (editingRegionId === target.id) resetRegionForm();
        queryClient.invalidateQueries({ queryKey: ["pricing", "regions"] });
        queryClient.invalidateQueries({ queryKey: ["pricing", "zones"] });
        queryClient.invalidateQueries({ queryKey: ["pricing", "sla-rules"] });
        return;
      }

      if (target.type === "sla") {
        if (editingSlaRuleId === target.id) resetSlaForm();
        queryClient.invalidateQueries({ queryKey: ["pricing", "sla-rules"] });
        return;
      }

      if (editingPlanId === target.id) resetTariffForm();
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
    setRegionEditorOpen(true);
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
    setSlaEditorOpen(true);
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
          pricingStrategy: plan.pricingStrategy ?? "FIXED_LANE",
          coverageType: plan.coverageType ?? "domestic",
          transportMode: plan.transportMode ?? "ROAD",
          originCountryCode: plan.originCountryCode ?? "",
          destinationCountryCode: plan.destinationCountryCode ?? "",
          routeTemplateId: plan.routeTemplateId ?? "none",
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
          transitLegRates:
            plan.pricingStrategy === "LEG_TRANSIT" &&
            Array.isArray(plan.transitPricingConfig?.legs) &&
            plan.transitPricingConfig.legs.length
              ? plan.transitPricingConfig.legs.map((leg) =>
                  makeTransitLegDraft({
                    sequence: String(leg.sequence ?? ""),
                    legCode: leg.legCode ?? "",
                    label: leg.label ?? "",
                    mode: leg.mode ?? "",
                    originCountryCode: leg.originCountryCode ?? "",
                    destinationCountryCode: leg.destinationCountryCode ?? "",
                    ratePerKg: String(leg.ratePerKg ?? ""),
                    minCharge: String(leg.minCharge ?? 0),
                    flatFee: String(leg.flatFee ?? 0),
                  }),
                )
            : [makeTransitLegDraft()],
        });
        setTariffEditorOpen(true);
      } catch {
        toast.error(t("pricingPage.toast.actionFailed"));
      } finally {
        setLoadingPlanId(null);
      }
    },
    [t],
  );

  const tariffPlans = tariffPlansQuery.data?.data ?? [];
  const tariffPlanTotal = tariffPlansQuery.data?.total ?? tariffPlans.length;

  const goToNextPlanPage = React.useCallback(() => {
    const nextCursor = tariffPlansQuery.data?.pageInfo.nextCursor;
    if (!nextCursor) return;
    setPlanCursorStack((current) => {
      const next = current.slice(0, planCursorIndex + 1);
      next.push(nextCursor);
      return next;
    });
    setPlanCursorIndex((current) => current + 1);
  }, [planCursorIndex, tariffPlansQuery.data?.pageInfo.nextCursor]);

  const goToPreviousPlanPage = React.useCallback(() => {
    setPlanCursorIndex((current) => Math.max(0, current - 1));
  }, []);

  const stats = React.useMemo(() => {
    return {
      regions: regions.length,
      zoneLinks: zoneMatrixQuery.data?.length ?? 0,
      plans: tariffPlanTotal,
      activePlans: tariffPlans.filter((plan) => plan.status === "active").length,
    };
  }, [regions.length, tariffPlans, tariffPlanTotal, zoneMatrixQuery.data]);

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
          <div className="space-y-5">
            {regionEditorOpen ? (
              <div
                className="fixed inset-0 z-50 bg-black/45"
                onClick={() => setRegionEditorOpen(false)}
              />
            ) : null}
            <Card
              className={cn(
                "border-border/70",
                regionEditorOpen
                  ? "fixed left-1/2 top-1/2 z-[60] flex max-h-[calc(100dvh-2rem)] w-[min(840px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden shadow-2xl"
                  : "hidden",
              )}
            >
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle>{t("pricingPage.regions.createTitle")}</CardTitle>
                  <CardDescription>
                    {t("pricingPage.regions.createDescription")}
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setRegionEditorOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="min-h-0 space-y-4 overflow-y-auto">
                {editingRegionId ? (
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                    <span>{t("pricingPage.regions.editing")}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        resetRegionForm();
                        setRegionEditorOpen(false);
                      }}
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
                          onClick={() => {
                            resetRegionForm();
                            setRegionEditorOpen(false);
                          }}
                        >
                      {t("pricingPage.shared.cancelEdit")}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <CardTitle>{t("pricingPage.regions.listTitle")}</CardTitle>
                  <CardDescription>
                    {t("pricingPage.regions.listDescription")}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={openCreateRegion}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add region
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => regionsQuery.refetch()}
                    disabled={regionsQuery.isFetching}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t("pricingPage.shared.refresh")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {regionsQuery.isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : regions.length ? (
                  <div className="max-h-[min(64vh,620px)] space-y-3 overflow-auto pr-2">
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
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                              onClick={() =>
                                setPricingDeleteTarget({
                                  type: "region",
                                  id: region.id,
                                  name: region.name,
                                })
                              }
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
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
                  <div className="max-h-[calc(100dvh-18rem)] w-full overflow-auto rounded-2xl border bg-background">
                    <div className="min-w-max p-4">
                      <div
                        className="grid gap-2"
                        style={{
                          gridTemplateColumns: `220px repeat(${regions.length}, minmax(112px, 112px))`,
                        }}
                      >
                        <div className="sticky left-0 top-0 z-30 rounded-xl bg-background px-3 py-2 text-sm font-medium text-muted-foreground shadow-sm">
                          {t("pricingPage.zones.originToDestination")}
                        </div>
                        {regions.map((region) => (
                          <div
                            key={`header-${region.id}`}
                            className="sticky top-0 z-20 truncate rounded-xl bg-muted px-3 py-2 text-center text-sm font-medium shadow-sm"
                            title={`${region.name} (${region.code})`}
                          >
                            {region.name}
                          </div>
                        ))}
                        {regions.map((origin) => (
                          <React.Fragment key={`row-${origin.id}`}>
                            <div className="sticky left-0 z-10 rounded-xl bg-background px-3 py-2 text-sm font-medium shadow-sm">
                              <div className="truncate" title={origin.name}>
                                {origin.name}
                              </div>
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
                  </div>
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

          <div className="space-y-5">
            {slaEditorOpen ? (
              <div
                className="fixed inset-0 z-50 bg-black/45"
                onClick={() => setSlaEditorOpen(false)}
              />
            ) : null}
            <Card
              className={cn(
                "border-border/70",
                slaEditorOpen
                  ? "fixed left-1/2 top-1/2 z-[60] flex max-h-[calc(100dvh-2rem)] w-[min(920px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden shadow-2xl"
                  : "hidden",
              )}
            >
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle>{t("pricingPage.sla.createTitle")}</CardTitle>
                  <CardDescription>
                    {t("pricingPage.sla.createDescription")}
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setSlaEditorOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="min-h-0 space-y-4 overflow-y-auto">
                {editingSlaRuleId ? (
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
                    <span>{t("pricingPage.sla.editing")}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        resetSlaForm();
                        setSlaEditorOpen(false);
                      }}
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
                      onClick={() => {
                        resetSlaForm();
                        setSlaEditorOpen(false);
                      }}
                    >
                      {t("pricingPage.shared.cancelEdit")}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <CardTitle>{t("pricingPage.sla.listTitle")}</CardTitle>
                  <CardDescription>
                    {t("pricingPage.sla.listDescription")}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={openCreateSlaRule}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add SLA
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => slaRulesQuery.refetch()}
                    disabled={slaRulesQuery.isFetching}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t("pricingPage.shared.refresh")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {slaRulesQuery.isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : slaRulesQuery.data?.length ? (
                  <div className="max-h-[min(64vh,620px)] space-y-3 overflow-auto pr-2">
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
                            <div className="flex flex-wrap gap-2 pt-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => startSlaEdit(rule)}
                              >
                                <PencilLine className="mr-2 h-4 w-4" />
                                {t("pricingPage.shared.edit")}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                                onClick={() =>
                                  setPricingDeleteTarget({
                                    type: "sla",
                                    id: rule.id,
                                    name: rule.name,
                                  })
                                }
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
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
          <div className="space-y-5">
            {tariffEditorOpen ? (
              <div
                className="fixed inset-0 z-50 bg-black/45"
                onClick={() => setTariffEditorOpen(false)}
              />
            ) : null}
            <Card
              className={cn(
                "border-border/70",
                tariffEditorOpen
                  ? "fixed left-1/2 top-1/2 z-[60] flex max-h-[calc(100dvh-2rem)] w-[min(1180px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden shadow-2xl"
                  : "hidden",
              )}
            >
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle>{t("pricingPage.plans.createTitle")}</CardTitle>
                  <CardDescription>
                    {t("pricingPage.plans.createDescription")}
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setTariffEditorOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="min-h-0 space-y-4 overflow-y-auto">
                {editingPlanId ? (
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    <span>{t("pricingPage.plans.editing")}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        resetTariffForm();
                        setTariffEditorOpen(false);
                      }}
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

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 [&>*]:min-w-0">
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
                    <Label>Pricing strategy</Label>
                    <Select
                      value={tariffForm.pricingStrategy}
                      onValueChange={(value: TariffPricingStrategy) =>
                        setTariffForm((current) => ({
                          ...current,
                          pricingStrategy: value,
                          coverageType:
                            value === "LEG_TRANSIT"
                              ? "international"
                              : current.coverageType,
                          transitLegRates:
                            value === "LEG_TRANSIT" &&
                            selectedTariffRouteTemplate
                              ? buildTransitLegDraftsFromRouteTemplate(
                                  selectedTariffRouteTemplate,
                                  current.transitLegRates,
                                )
                              : current.transitLegRates,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {pricingStrategies.map((strategy) => (
                          <SelectItem key={strategy} value={strategy}>
                            {pricingStrategyLabel(strategy)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Coverage</Label>
                    <Select
                      value={tariffForm.coverageType}
                      disabled={tariffForm.pricingStrategy === "LEG_TRANSIT"}
                      onValueChange={(value: TariffCoverageType) =>
                        setTariffForm((current) => ({
                          ...current,
                          coverageType: value,
                          ...(value === "domestic"
                            ? {
                                originCountryCode: "",
                                destinationCountryCode: "",
                              }
                            : {}),
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COVERAGE_TYPES.map((coverageType) => (
                          <SelectItem key={coverageType} value={coverageType}>
                            {coverageType === "domestic"
                              ? "Domestic"
                              : "International"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Transport mode</Label>
                    <Select
                      value={tariffForm.transportMode}
                      onValueChange={(value) =>
                        setTariffForm((current) => ({
                          ...current,
                          transportMode: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {transportModes.map((mode) => (
                          <SelectItem key={mode} value={mode}>
                            {mode}
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
                  {tariffForm.coverageType === "international" ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="plan-origin-country">
                          Origin country (ISO2)
                        </Label>
                        <Input
                          id="plan-origin-country"
                          value={tariffForm.originCountryCode}
                          onChange={(event) =>
                            setTariffForm((current) => ({
                              ...current,
                              originCountryCode: event.target.value
                                .toUpperCase()
                                .slice(0, 2),
                            }))
                          }
                          placeholder="CN"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="plan-destination-country">
                          Destination country (ISO2)
                        </Label>
                        <Input
                          id="plan-destination-country"
                          value={tariffForm.destinationCountryCode}
                          onChange={(event) =>
                            setTariffForm((current) => ({
                              ...current,
                              destinationCountryCode: event.target.value
                                .toUpperCase()
                                .slice(0, 2),
                            }))
                          }
                          placeholder="UZ"
                        />
                      </div>
                    </>
                  ) : null}
                  <div className="space-y-2 md:col-span-2 xl:col-span-3 2xl:col-span-4">
                    <Label>Route template (optional)</Label>
                    <Select
                      value={tariffForm.routeTemplateId}
                      onValueChange={(value) => {
                        const selectedRoute = routeTemplates.find((route) => route.id === value);
                        setTariffForm((current) => ({
                          ...current,
                          routeTemplateId: value,
                          ...(selectedRoute
                            ? {
                                serviceType: (selectedRoute.serviceType ?? current.serviceType) as ServiceType,
                                coverageType: "international" as TariffCoverageType,
                                transportMode: (selectedRoute.transportMode ?? current.transportMode).toUpperCase(),
                                originCountryCode: selectedRoute.originCountryCode ?? current.originCountryCode,
                                destinationCountryCode:
                                  selectedRoute.destinationCountryCode ?? current.destinationCountryCode,
                                transitLegRates:
                                  current.pricingStrategy === "LEG_TRANSIT"
                                    ? buildTransitLegDraftsFromRouteTemplate(
                                        selectedRoute,
                                        current.transitLegRates,
                                      )
                                    : current.transitLegRates,
                              }
                            : {
                                transitLegRates:
                                  current.pricingStrategy === "LEG_TRANSIT"
                                    ? []
                                    : current.transitLegRates,
                              }),
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No route template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No route template</SelectItem>
                        {routeTemplates.map((route) => (
                          <SelectItem key={route.id} value={route.id}>
                            {route.name} ({route.originCountryCode || "*"} - {route.destinationCountryCode || "*"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {tariffForm.pricingStrategy === "LEG_TRANSIT"
                        ? "Required for Leg Transit pricing. Legs are loaded from this route template and priced below."
                        : "Optional operational route. For Fixed Lane pricing this only stamps order legs; pricing stays in the weight/zone rate grid below."}
                    </p>
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

                {tariffForm.pricingStrategy === "FIXED_LANE" ? (
                  <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/15 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold">
                          Fixed lane weight/zone rates
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Define customer charge by pricing zone and weight
                          bucket. This does not create route legs.
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
                        Add weight rate
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
                ) : (
                  <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/15 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold">
                          Transit leg pricing
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Route legs come from the selected route template.
                          Configure only pricing values here.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {!selectedTariffRouteTemplate ? (
                        <div className="rounded-2xl border border-dashed bg-background p-4 text-sm text-muted-foreground">
                          Select a route template above to load operational legs
                          for transit pricing. Legs are managed only in Carrier
                          Routing route templates.
                        </div>
                      ) : null}
                      {selectedTariffRouteTemplate ? tariffForm.transitLegRates.map((leg) => (
                        <div
                          key={leg.id}
                          className="grid gap-3 rounded-2xl border bg-background p-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 [&>*]:min-w-0"
                        >
                          <div className="space-y-2">
                            <Label>Sequence</Label>
                            <Input
                              type="number"
                              min={1}
                              value={leg.sequence}
                              disabled
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Leg code</Label>
                            <Input
                              value={leg.legCode}
                              disabled
                              placeholder="linehaul_cn_kz"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Label</Label>
                            <Input
                              value={leg.label}
                              disabled
                              placeholder="CN to KZ air leg"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Mode</Label>
                            <Select
                              value={leg.mode || "NONE"}
                              disabled
                            >
                              <SelectTrigger className="w-full min-w-0">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="NONE">Plan default</SelectItem>
                                {transportModes.map((mode) => (
                                  <SelectItem key={mode} value={mode}>
                                    {mode}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Rate per kg</Label>
                            <Input
                              type="number"
                              value={leg.ratePerKg}
                              onChange={(event) =>
                                setTariffForm((current) => ({
                                  ...current,
                                  transitLegRates: current.transitLegRates.map(
                                    (item) =>
                                      item.id === leg.id
                                        ? {
                                            ...item,
                                            ratePerKg: event.target.value,
                                          }
                                        : item,
                                  ),
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Origin country</Label>
                            <Input
                              value={leg.originCountryCode}
                              disabled
                              placeholder="CN"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Destination country</Label>
                            <Input
                              value={leg.destinationCountryCode}
                              disabled
                              placeholder="KZ"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Min charge</Label>
                            <Input
                              type="number"
                              value={leg.minCharge}
                              onChange={(event) =>
                                setTariffForm((current) => ({
                                  ...current,
                                  transitLegRates: current.transitLegRates.map(
                                    (item) =>
                                      item.id === leg.id
                                        ? {
                                            ...item,
                                            minCharge: event.target.value,
                                          }
                                        : item,
                                  ),
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Flat fee</Label>
                            <Input
                              type="number"
                              value={leg.flatFee}
                              onChange={(event) =>
                                setTariffForm((current) => ({
                                  ...current,
                                  transitLegRates: current.transitLegRates.map(
                                    (item) =>
                                      item.id === leg.id
                                        ? {
                                            ...item,
                                            flatFee: event.target.value,
                                          }
                                        : item,
                                  ),
                                }))
                              }
                            />
                          </div>
                        </div>
                      )) : null}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => tariffSubmitMutation.mutate()}
                    disabled={
                      tariffSubmitMutation.isPending ||
                      !tariffForm.name.trim() ||
                      (tariffForm.pricingStrategy === "LEG_TRANSIT" &&
                        (!selectedTariffRouteTemplate ||
                          tariffForm.transitLegRates.length === 0))
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
                      onClick={() => {
                        resetTariffForm();
                        setTariffEditorOpen(false);
                      }}
                    >
                      {t("pricingPage.shared.cancelEdit")}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/70">
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <CardTitle>{t("pricingPage.plans.listTitle")}</CardTitle>
                    <CardDescription>
                      {t("pricingPage.plans.listDescription")}
                    </CardDescription>
                  </div>
                  <Button type="button" size="sm" onClick={openCreateTariffPlan}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create tariff plan
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-3 [&>*]:min-w-0">
                  <Input
                    value={planSearch}
                    onChange={(event) => setPlanSearch(event.target.value)}
                    placeholder={t("pricingPage.plans.searchPlaceholder")}
                    className="min-w-[240px] flex-1 basis-[320px]"
                  />
                  <div className="min-w-[170px] flex-none">
                    <Select
                      value={planStatusFilter}
                      onValueChange={(value: "all" | TariffPlanStatus) =>
                        setPlanStatusFilter(value)
                      }
                    >
                      <SelectTrigger className="w-full">
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
                  </div>
                  <div className="min-w-[180px] flex-none">
                    <Select
                      value={planServiceTypeFilter}
                      onValueChange={(value: "all" | ServiceType) =>
                        setPlanServiceTypeFilter(value)
                      }
                    >
                      <SelectTrigger className="w-full">
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
                  </div>
                  <div className="min-w-[170px] flex-none">
                    <Select
                      value={planCoverageFilter}
                      onValueChange={(value: "all" | TariffCoverageType) =>
                        setPlanCoverageFilter(value)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All coverage</SelectItem>
                        {COVERAGE_TYPES.map((coverageType) => (
                          <SelectItem key={coverageType} value={coverageType}>
                            {coverageType === "domestic"
                              ? "Domestic"
                              : "International"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-[170px] flex-none">
                    <Select
                      value={planTransportFilter}
                      onValueChange={(value) => setPlanTransportFilter(value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All transport</SelectItem>
                        {transportModes.map((mode) => (
                          <SelectItem key={mode} value={mode}>
                            {mode}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => tariffPlansQuery.refetch()}
                    disabled={tariffPlansQuery.isFetching}
                    className="w-full min-w-[130px] sm:w-auto"
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
                ) : tariffPlans.length ? (
                  <>
                    <div className="max-h-[min(68vh,720px)] space-y-3 overflow-auto pr-2">
                      {tariffPlans.map((plan) => (
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
                              <Badge variant="outline" className="rounded-full">
                                {pricingStrategyLabel(
                                  plan.pricingStrategy ?? "FIXED_LANE",
                                )}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                              <span>
                                {plan.code || t("pricingPage.plans.noCode")}
                              </span>
                              <span>
                                {plan.coverageType === "international"
                                  ? "International"
                                  : "Domestic"}
                              </span>
                              <span>{plan.transportMode}</span>
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
                              {plan.pricingStrategy === "LEG_TRANSIT" ? (
                                <span>
                                  Transit legs:{" "}
                                  {plan.transitPricingConfig?.legs?.length ?? 0}
                                </span>
                              ) : null}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {plan.description ||
                                t("pricingPage.plans.noDescription")}
                            </p>
                            {plan.coverageType === "international" ? (
                              <p className="text-xs text-muted-foreground">
                                Country scope:{" "}
                                {plan.originCountryCode || "*"} -{" "}
                                {plan.destinationCountryCode || "*"}
                              </p>
                            ) : null}
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
                            <div className="flex flex-wrap justify-end gap-2 pt-1">
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
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                                onClick={() =>
                                  setPricingDeleteTarget({
                                    type: "tariff",
                                    id: plan.id,
                                    name: plan.name,
                                  })
                                }
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </Button>
                            </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-col gap-3 border-t pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                      <span>
                        Loaded {tariffPlans.length} of {tariffPlanTotal}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={goToPreviousPlanPage}
                          disabled={planCursorIndex <= 0}
                        >
                          Previous
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={goToNextPlanPage}
                          disabled={!tariffPlansQuery.data?.pageInfo.hasNextPage}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </>
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

      <Dialog
        open={Boolean(pricingDeleteTarget)}
        onOpenChange={(open) => !open && setPricingDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              Delete{" "}
              {pricingDeleteTarget?.type === "region"
                ? "region"
                : pricingDeleteTarget?.type === "sla"
                  ? "delivery SLA"
                  : "tariff plan"}
              ?
            </DialogTitle>
            <DialogDescription>
              {pricingDeleteTarget?.type === "region"
                ? `This removes "${pricingDeleteTarget.name}" and also clears linked zone-matrix entries and SLA rules. Existing orders are kept.`
                : pricingDeleteTarget?.type === "sla"
                  ? `This removes "${pricingDeleteTarget.name}". Existing orders are kept and detached from this SLA rule.`
                  : `This removes "${pricingDeleteTarget?.name}". Its tariff rates are deleted with the plan.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPricingDeleteTarget(null)}
              disabled={pricingDeleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pricingDeleteMutation.isPending || !pricingDeleteTarget}
              onClick={() => {
                if (pricingDeleteTarget)
                  pricingDeleteMutation.mutate(pricingDeleteTarget);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
