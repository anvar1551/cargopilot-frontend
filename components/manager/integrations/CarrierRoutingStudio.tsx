"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  Boxes,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  GitBranch,
  Loader2,
  PencilLine,
  Plus,
  Route,
  Save,
  Search,
  Trash2,
  Truck,
  X,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { SERVICE_TYPES, type ServiceType } from "@/lib/orders/service-types";
import type { Organization } from "@/lib/organizations";
import {
  createCarrierRoutingRule,
  createRouteTemplate,
  deleteCarrierRoutingRule,
  deleteRouteTemplate,
  listCarrierRoutingRulesPage,
  listIntegrationProviders,
  listRouteTemplates,
  listRouteTemplatesPage,
  updateCarrierRoutingRule,
  updateRouteTemplate,
  type CarrierRoutingRule,
  type IntegrationProviderConfig,
  type IntegrationServiceType,
  type IntegrationTransportMode,
  type RouteTemplate,
} from "@/lib/integrations";
import { cn } from "@/lib/utils";

const TRANSPORT_MODES: IntegrationTransportMode[] = ["road", "air", "rail", "sea", "multimodal"];
const NULL_SELECT_VALUE = "__none__";
const PAGE_SIZE = 10;

type RouteLegDraft = {
  id?: string;
  localId: string;
  sequence: string;
  legCode: string;
  label: string;
  mode: IntegrationTransportMode;
  originCountryCode: string;
  destinationCountryCode: string;
};

type RouteTemplateFormState = {
  companyId: string;
  name: string;
  code: string;
  isActive: boolean;
  priority: string;
  serviceType: ServiceType;
  transportMode: IntegrationTransportMode;
  originCountryCode: string;
  destinationCountryCode: string;
  legs: RouteLegDraft[];
};

type CarrierRuleFormState = {
  companyId: string;
  name: string;
  code: string;
  providerId: string;
  routeTemplateId: string;
  routeTemplateLegId: string;
  isActive: boolean;
  priority: string;
  autoBook: boolean;
  serviceType: ServiceType;
  transportMode: IntegrationTransportMode;
  originCountryCode: string;
  destinationCountryCode: string;
  minWeightKg: string;
  maxWeightKg: string;
  legSequence: string;
};

type CarrierRoutingStudioProps = {
  selectedCompanyId?: string;
  fallbackCompanyId?: string;
  companies: Organization[];
};

function makeLocalId() {
  return Math.random().toString(36).slice(2, 10);
}

function normalizeCountryCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
}

function parseOptionalInt(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function labelize(value: string | null | undefined) {
  if (!value) return "-";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractApiErrorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) return error instanceof Error ? error.message : fallback;
  const payload = error.response?.data as
    | { error?: string; message?: string; issues?: { fieldErrors?: Record<string, string[]> } }
    | undefined;
  const base = payload?.error || payload?.message || error.message || fallback;
  const fieldErrors = payload?.issues?.fieldErrors
    ? Object.entries(payload.issues.fieldErrors).flatMap(([field, messages]) =>
        (messages ?? []).map((message) => `${field}: ${message}`),
      )
    : [];
  return fieldErrors.length ? `${base}. ${fieldErrors.join(" | ")}` : base;
}

function companyName(companies: Organization[], companyId: string) {
  return companies.find((company) => company.id === companyId)?.name ?? companyId;
}

function makeRouteLegDraft(partial?: Partial<RouteLegDraft>): RouteLegDraft {
  return {
    localId: partial?.localId ?? makeLocalId(),
    id: partial?.id,
    sequence: partial?.sequence ?? "1",
    legCode: partial?.legCode ?? "",
    label: partial?.label ?? "",
    mode: partial?.mode ?? "road",
    originCountryCode: partial?.originCountryCode ?? "",
    destinationCountryCode: partial?.destinationCountryCode ?? "",
  };
}

function makeRouteTemplateForm(companyId = ""): RouteTemplateFormState {
  return {
    companyId,
    name: "",
    code: "",
    isActive: true,
    priority: "100",
    serviceType: "DOOR_TO_DOOR",
    transportMode: "air",
    originCountryCode: "",
    destinationCountryCode: "",
    legs: [
      makeRouteLegDraft({
        sequence: "1",
        legCode: "origin_pickup",
        label: "Origin pickup",
        mode: "road",
      }),
      makeRouteLegDraft({
        sequence: "2",
        legCode: "linehaul",
        label: "International linehaul",
        mode: "air",
      }),
      makeRouteLegDraft({
        sequence: "3",
        legCode: "last_mile",
        label: "Destination last mile",
        mode: "road",
      }),
    ],
  };
}

function makeCarrierRuleForm(companyId = ""): CarrierRuleFormState {
  return {
    companyId,
    name: "",
    code: "",
    providerId: "",
    routeTemplateId: "",
    routeTemplateLegId: "",
    isActive: true,
    priority: "100",
    autoBook: true,
    serviceType: "DOOR_TO_DOOR",
    transportMode: "air",
    originCountryCode: "",
    destinationCountryCode: "",
    minWeightKg: "",
    maxWeightKg: "",
    legSequence: "",
  };
}

function routeTemplateToForm(route: RouteTemplate): RouteTemplateFormState {
  return {
    companyId: route.companyId,
    name: route.name,
    code: route.code ?? "",
    isActive: route.isActive,
    priority: String(route.priority ?? 0),
    serviceType: (route.serviceType ?? "DOOR_TO_DOOR") as ServiceType,
    transportMode: route.transportMode ?? "air",
    originCountryCode: route.originCountryCode ?? "",
    destinationCountryCode: route.destinationCountryCode ?? "",
    legs: (route.legs ?? []).length
      ? (route.legs ?? [])
          .slice()
          .sort((a, b) => a.sequence - b.sequence)
          .map((leg) =>
            makeRouteLegDraft({
              id: leg.id,
              sequence: String(leg.sequence),
              legCode: leg.legCode,
              label: leg.label ?? "",
              mode: leg.mode,
              originCountryCode: leg.originCountryCode ?? "",
              destinationCountryCode: leg.destinationCountryCode ?? "",
            }),
          )
      : [makeRouteLegDraft()],
  };
}

function carrierRuleToForm(rule: CarrierRoutingRule): CarrierRuleFormState {
  return {
    companyId: rule.companyId,
    name: rule.name,
    code: rule.code ?? "",
    providerId: rule.providerId,
    routeTemplateId: rule.routeTemplateId ?? "",
    routeTemplateLegId: rule.routeTemplateLegId ?? "",
    isActive: rule.isActive,
    priority: String(rule.priority ?? 0),
    autoBook: rule.autoBook,
    serviceType: (rule.serviceType ?? "DOOR_TO_DOOR") as ServiceType,
    transportMode: rule.transportMode ?? "air",
    originCountryCode: rule.originCountryCode ?? "",
    destinationCountryCode: rule.destinationCountryCode ?? "",
    minWeightKg: rule.minWeightKg == null ? "" : String(rule.minWeightKg),
    maxWeightKg: rule.maxWeightKg == null ? "" : String(rule.maxWeightKg),
    legSequence: rule.legSequence == null ? "" : String(rule.legSequence),
  };
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full",
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-50 text-slate-600",
      )}
    >
      {active ? "Active" : "Paused"}
    </Badge>
  );
}

export function CarrierRoutingStudio({
  selectedCompanyId,
  fallbackCompanyId,
  companies,
}: CarrierRoutingStudioProps) {
  const queryClient = useQueryClient();
  const effectiveCompanyId = selectedCompanyId || fallbackCompanyId || "";
  const [editingRouteId, setEditingRouteId] = React.useState<string | null>(null);
  const [editingRuleId, setEditingRuleId] = React.useState<string | null>(null);
  const [routeEditorOpen, setRouteEditorOpen] = React.useState(false);
  const [ruleEditorOpen, setRuleEditorOpen] = React.useState(false);
  const [routeSearch, setRouteSearch] = React.useState("");
  const [ruleSearch, setRuleSearch] = React.useState("");
  const [routeCursorStack, setRouteCursorStack] = React.useState<(string | null)[]>([null]);
  const [routeCursorIndex, setRouteCursorIndex] = React.useState(0);
  const [ruleCursorStack, setRuleCursorStack] = React.useState<(string | null)[]>([null]);
  const [ruleCursorIndex, setRuleCursorIndex] = React.useState(0);
  const [deleteTarget, setDeleteTarget] = React.useState<
    | { type: "route"; id: string; name: string }
    | { type: "rule"; id: string; name: string }
    | null
  >(null);
  const [routeForm, setRouteForm] = React.useState<RouteTemplateFormState>(() =>
    makeRouteTemplateForm(effectiveCompanyId),
  );
  const [ruleForm, setRuleForm] = React.useState<CarrierRuleFormState>(() =>
    makeCarrierRuleForm(effectiveCompanyId),
  );

  React.useEffect(() => {
    if (!effectiveCompanyId) return;
    setRouteForm((current) => (current.companyId ? current : { ...current, companyId: effectiveCompanyId }));
    setRuleForm((current) => (current.companyId ? current : { ...current, companyId: effectiveCompanyId }));
  }, [effectiveCompanyId]);

  const routeCursor = routeCursorStack[routeCursorIndex] ?? null;
  const ruleCursor = ruleCursorStack[ruleCursorIndex] ?? null;

  React.useEffect(() => {
    setRouteCursorStack([null]);
    setRouteCursorIndex(0);
  }, [selectedCompanyId, routeSearch]);

  React.useEffect(() => {
    setRuleCursorStack([null]);
    setRuleCursorIndex(0);
  }, [selectedCompanyId, ruleSearch]);

  const routeTemplatesQuery = useQuery({
    queryKey: ["integration-route-templates", selectedCompanyId, routeSearch, routeCursor],
    queryFn: () =>
      listRouteTemplatesPage({
        companyId: selectedCompanyId,
        q: routeSearch.trim() || undefined,
        cursor: routeCursor,
        limit: PAGE_SIZE,
      }),
  });
  const routeTemplateOptionsQuery = useQuery({
    queryKey: ["integration-route-template-options", selectedCompanyId],
    queryFn: () => listRouteTemplates({ companyId: selectedCompanyId, isActive: true }),
    enabled: Boolean(selectedCompanyId),
  });
  const carrierProvidersQuery = useQuery({
    queryKey: ["integration-carrier-providers", selectedCompanyId],
    queryFn: () =>
      listIntegrationProviders({
        companyId: selectedCompanyId,
        domain: "carrier",
      }),
  });
  const carrierRulesQuery = useQuery({
    queryKey: ["integration-carrier-routing-rules", selectedCompanyId, ruleSearch, ruleCursor],
    queryFn: () =>
      listCarrierRoutingRulesPage({
        companyId: selectedCompanyId,
        q: ruleSearch.trim() || undefined,
        cursor: ruleCursor,
        limit: PAGE_SIZE,
      }),
  });

  const routeTemplatePage = routeTemplatesQuery.data;
  const carrierRulePage = carrierRulesQuery.data;
  const routeTemplates = routeTemplatePage?.data ?? [];
  const routeTemplateOptions = routeTemplateOptionsQuery.data ?? routeTemplates;
  const carrierProviders = carrierProvidersQuery.data ?? [];
  const carrierRules = carrierRulePage?.data ?? [];
  const filteredRouteTemplates = React.useMemo(() => {
    const query = routeSearch.trim().toLowerCase();
    if (!query) return routeTemplates;
    return routeTemplates.filter((route) =>
      [
        route.name,
        route.code,
        route.originCountryCode,
        route.destinationCountryCode,
        route.serviceType,
        route.transportMode,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [routeSearch, routeTemplates]);
  const filteredCarrierRules = React.useMemo(() => {
    const query = ruleSearch.trim().toLowerCase();
    if (!query) return carrierRules;
    return carrierRules.filter((rule) =>
      [
        rule.name,
        rule.code,
        rule.providerCode,
        rule.routeTemplateName,
        rule.routeTemplateLegCode,
        rule.originCountryCode,
        rule.destinationCountryCode,
        rule.serviceType,
        rule.transportMode,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [carrierRules, ruleSearch]);
  const pagedRouteTemplates = filteredRouteTemplates;
  const pagedCarrierRules = filteredCarrierRules;
  const selectedRoute = routeTemplateOptions.find((route) => route.id === ruleForm.routeTemplateId) ?? null;
  const selectedRouteLeg = (selectedRoute?.legs ?? []).find((leg) => leg.id === ruleForm.routeTemplateLegId) ?? null;

  const goToNextRoutePage = React.useCallback(() => {
    const nextCursor = routeTemplatePage?.pageInfo.nextCursor;
    if (!nextCursor) return;
    setRouteCursorStack((current) => {
      const next = current.slice(0, routeCursorIndex + 1);
      next.push(nextCursor);
      return next;
    });
    setRouteCursorIndex((current) => current + 1);
  }, [routeCursorIndex, routeTemplatePage?.pageInfo.nextCursor]);

  const goToPreviousRoutePage = React.useCallback(() => {
    setRouteCursorIndex((current) => Math.max(0, current - 1));
  }, []);

  const goToNextRulePage = React.useCallback(() => {
    const nextCursor = carrierRulePage?.pageInfo.nextCursor;
    if (!nextCursor) return;
    setRuleCursorStack((current) => {
      const next = current.slice(0, ruleCursorIndex + 1);
      next.push(nextCursor);
      return next;
    });
    setRuleCursorIndex((current) => current + 1);
  }, [carrierRulePage?.pageInfo.nextCursor, ruleCursorIndex]);

  const goToPreviousRulePage = React.useCallback(() => {
    setRuleCursorIndex((current) => Math.max(0, current - 1));
  }, []);

  const resetRouteForm = React.useCallback(() => {
    setEditingRouteId(null);
    setRouteForm(makeRouteTemplateForm(effectiveCompanyId));
  }, [effectiveCompanyId]);

  const resetRuleForm = React.useCallback(() => {
    setEditingRuleId(null);
    setRuleForm(makeCarrierRuleForm(effectiveCompanyId));
  }, [effectiveCompanyId]);

  const openCreateRoute = React.useCallback(() => {
    setEditingRouteId(null);
    setRouteForm(makeRouteTemplateForm(effectiveCompanyId));
    setRouteEditorOpen(true);
  }, [effectiveCompanyId]);

  const openEditRoute = React.useCallback((route: RouteTemplate) => {
    setEditingRouteId(route.id);
    setRouteForm(routeTemplateToForm(route));
    setRouteEditorOpen(true);
  }, []);

  const openCreateRule = React.useCallback(() => {
    setEditingRuleId(null);
    setRuleForm(makeCarrierRuleForm(effectiveCompanyId));
    setRuleEditorOpen(true);
  }, [effectiveCompanyId]);

  const openEditRule = React.useCallback((rule: CarrierRoutingRule) => {
    setEditingRuleId(rule.id);
    setRuleForm(carrierRuleToForm(rule));
    setRuleEditorOpen(true);
  }, []);

  const invalidateCarrierRouting = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["integration-route-templates"] }),
      queryClient.invalidateQueries({ queryKey: ["integration-route-template-options"] }),
      queryClient.invalidateQueries({ queryKey: ["integration-carrier-routing-rules"] }),
      queryClient.invalidateQueries({ queryKey: ["integration-carrier-providers"] }),
      queryClient.invalidateQueries({ queryKey: ["pricing", "plans"] }),
    ]);
  }, [queryClient]);

  const saveRouteMutation = useMutation({
    mutationFn: async () => {
      const companyId = routeForm.companyId.trim();
      if (!companyId) throw new Error("Company is required");
      if (!routeForm.name.trim()) throw new Error("Route name is required");

      const payload = {
        companyId,
        name: routeForm.name.trim(),
        code: routeForm.code.trim() || null,
        isActive: routeForm.isActive,
        priority: parseOptionalInt(routeForm.priority, 0),
        serviceType: routeForm.serviceType as IntegrationServiceType,
        transportMode: routeForm.transportMode,
        originCountryCode: normalizeCountryCode(routeForm.originCountryCode) || null,
        destinationCountryCode: normalizeCountryCode(routeForm.destinationCountryCode) || null,
        legs: routeForm.legs
          .slice()
          .sort((a, b) => parseOptionalInt(a.sequence, 0) - parseOptionalInt(b.sequence, 0))
          .map((leg, index) => ({
            id: leg.id,
            sequence: parseOptionalInt(leg.sequence, index + 1),
            legCode: leg.legCode.trim(),
            label: leg.label.trim() || null,
            mode: leg.mode,
            originCountryCode: normalizeCountryCode(leg.originCountryCode) || null,
            destinationCountryCode: normalizeCountryCode(leg.destinationCountryCode) || null,
          })),
      };

      if (payload.legs.some((leg) => !leg.legCode)) {
        throw new Error("Every route leg needs a leg code");
      }

      if (editingRouteId) return updateRouteTemplate(editingRouteId, payload);
      return createRouteTemplate(payload);
    },
    onSuccess: async () => {
      toast.success(editingRouteId ? "Route template updated" : "Route template created");
      resetRouteForm();
      setRouteEditorOpen(false);
      await invalidateCarrierRouting();
    },
    onError: (error) => toast.error(extractApiErrorMessage(error, "Failed to save route template")),
  });

  const saveRuleMutation = useMutation({
    mutationFn: async () => {
      const companyId = ruleForm.companyId.trim();
      if (!companyId) throw new Error("Company is required");
      if (!ruleForm.name.trim()) throw new Error("Rule name is required");
      if (!ruleForm.providerId.trim()) throw new Error("Carrier provider is required");

      const payload = {
        companyId,
        name: ruleForm.name.trim(),
        code: ruleForm.code.trim() || null,
        providerId: ruleForm.providerId,
        routeTemplateId: ruleForm.routeTemplateId || null,
        routeTemplateLegId: ruleForm.routeTemplateLegId || null,
        isActive: ruleForm.isActive,
        priority: parseOptionalInt(ruleForm.priority, 0),
        autoBook: ruleForm.autoBook,
        serviceType: ruleForm.serviceType as IntegrationServiceType,
        transportMode: ruleForm.transportMode,
        originCountryCode: normalizeCountryCode(ruleForm.originCountryCode) || null,
        destinationCountryCode: normalizeCountryCode(ruleForm.destinationCountryCode) || null,
        minWeightKg: parseOptionalNumber(ruleForm.minWeightKg),
        maxWeightKg: parseOptionalNumber(ruleForm.maxWeightKg),
        legSequence: ruleForm.legSequence.trim() ? parseOptionalInt(ruleForm.legSequence, 0) : null,
      };

      if (editingRuleId) return updateCarrierRoutingRule(editingRuleId, payload);
      return createCarrierRoutingRule(payload);
    },
    onSuccess: async () => {
      toast.success(editingRuleId ? "Carrier rule updated" : "Carrier rule created");
      resetRuleForm();
      setRuleEditorOpen(false);
      await invalidateCarrierRouting();
    },
    onError: (error) => toast.error(extractApiErrorMessage(error, "Failed to save carrier rule")),
  });

  const deleteRouteMutation = useMutation({
    mutationFn: deleteRouteTemplate,
    onSuccess: async () => {
      toast.success("Route template removed");
      setDeleteTarget(null);
      await invalidateCarrierRouting();
    },
    onError: (error) => toast.error(extractApiErrorMessage(error, "Failed to delete route template")),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: deleteCarrierRoutingRule,
    onSuccess: async () => {
      toast.success("Carrier rule removed");
      setDeleteTarget(null);
      await invalidateCarrierRouting();
    },
    onError: (error) => toast.error(extractApiErrorMessage(error, "Failed to delete carrier rule")),
  });

  const applySelectedRouteLeg = React.useCallback(() => {
    if (!selectedRoute || !selectedRouteLeg) return;
    setRuleForm((current) => ({
      ...current,
      serviceType: (selectedRoute.serviceType ?? current.serviceType) as ServiceType,
      transportMode: selectedRouteLeg.mode,
      originCountryCode: selectedRouteLeg.originCountryCode ?? "",
      destinationCountryCode: selectedRouteLeg.destinationCountryCode ?? "",
      legSequence: String(selectedRouteLeg.sequence),
      name:
        current.name ||
        `${selectedRoute.name} / ${selectedRouteLeg.label || selectedRouteLeg.legCode}`,
      code:
        current.code ||
        `${selectedRoute.code || "ROUTE"}_${selectedRouteLeg.legCode}`.replace(/[^A-Za-z0-9_]/g, "_"),
    }));
  }, [selectedRoute, selectedRouteLeg]);

  const routeCompanyInOptions = companies.some((company) => company.id === routeForm.companyId);
  const ruleCompanyInOptions = companies.some((company) => company.id === ruleForm.companyId);
  const activeAutoBookRules = carrierRules.filter((rule) => rule.isActive && rule.autoBook).length;
  const activeCarrierProviders = carrierProviders.filter((provider) => provider.status === "active").length;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: "Route templates", value: routeTemplatePage?.total ?? routeTemplates.length, icon: Route },
          { label: "Carrier rules", value: carrierRulePage?.total ?? carrierRules.length, icon: GitBranch },
          { label: "Auto-book rules", value: activeAutoBookRules, icon: WandSparkles },
          { label: "Active carriers", value: activeCarrierProviders, icon: Truck },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="rounded-xl border-border/70 py-4">
              <CardContent className="flex items-center justify-between px-4">
                <div>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-2xl font-semibold">{item.value}</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
                  <Icon className="h-5 w-5" />
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="space-y-5">
        {routeEditorOpen ? (
          <div className="fixed inset-0 z-50 bg-black/45" onClick={() => setRouteEditorOpen(false)} />
        ) : null}
        <Card
          className={cn(
            "rounded-2xl border-border/70",
            routeEditorOpen
              ? "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[min(980px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden shadow-2xl"
              : "hidden",
          )}
        >
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Route className="h-5 w-5 text-cyan-700" />
                  {editingRouteId ? "Edit Route Template" : "Create Route Template"}
                </CardTitle>
                <CardDescription className="mt-2">
                  Build the operational legs that order creation will stamp onto matching shipments.
                </CardDescription>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setRouteEditorOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="min-h-0 space-y-4 overflow-y-auto">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Company</Label>
                <Select
                  value={routeCompanyInOptions ? routeForm.companyId : NULL_SELECT_VALUE}
                  onValueChange={(value) =>
                    setRouteForm((current) => ({
                      ...current,
                      companyId: value === NULL_SELECT_VALUE ? "" : value,
                    }))
                  }
                  disabled={Boolean(editingRouteId)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NULL_SELECT_VALUE}>Manual company ID</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!routeForm.companyId || !routeCompanyInOptions ? (
                  <Input
                    value={routeForm.companyId}
                    onChange={(event) =>
                      setRouteForm((current) => ({ ...current, companyId: event.target.value }))
                    }
                    placeholder="Company UUID"
                    disabled={Boolean(editingRouteId)}
                  />
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={routeForm.name}
                  onChange={(event) => setRouteForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="CN to UZ Air Express"
                />
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={routeForm.code}
                  onChange={(event) => setRouteForm((current) => ({ ...current, code: event.target.value }))}
                  placeholder="CN_UZ_AIR_EXP"
                />
              </div>
              <div className="space-y-2">
                <Label>Service</Label>
                <Select
                  value={routeForm.serviceType}
                  onValueChange={(value: ServiceType) =>
                    setRouteForm((current) => ({ ...current, serviceType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map((serviceType) => (
                      <SelectItem key={serviceType} value={serviceType}>
                        {labelize(serviceType)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Main mode</Label>
                <Select
                  value={routeForm.transportMode}
                  onValueChange={(value: IntegrationTransportMode) =>
                    setRouteForm((current) => ({ ...current, transportMode: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSPORT_MODES.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {labelize(mode)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Origin country</Label>
                <Input
                  value={routeForm.originCountryCode}
                  onChange={(event) =>
                    setRouteForm((current) => ({
                      ...current,
                      originCountryCode: normalizeCountryCode(event.target.value),
                    }))
                  }
                  placeholder="CN"
                />
              </div>
              <div className="space-y-2">
                <Label>Destination country</Label>
                <Input
                  value={routeForm.destinationCountryCode}
                  onChange={(event) =>
                    setRouteForm((current) => ({
                      ...current,
                      destinationCountryCode: normalizeCountryCode(event.target.value),
                    }))
                  }
                  placeholder="UZ"
                />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Input
                  type="number"
                  value={routeForm.priority}
                  onChange={(event) => setRouteForm((current) => ({ ...current, priority: event.target.value }))}
                />
              </div>
              <label className="flex items-end gap-2 rounded-xl border px-3 py-2 text-sm">
                <Checkbox
                  checked={routeForm.isActive}
                  onCheckedChange={(checked) =>
                    setRouteForm((current) => ({ ...current, isActive: checked === true }))
                  }
                />
                Active route
              </label>
            </div>

            <div className="rounded-2xl border bg-muted/20 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Route legs</h3>
                  <p className="text-xs text-muted-foreground">Ordered legs become `OrderLeg` records.</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setRouteForm((current) => ({
                      ...current,
                      legs: [
                        ...current.legs,
                        makeRouteLegDraft({ sequence: String(current.legs.length + 1) }),
                      ],
                    }))
                  }
                >
                  <Plus className="h-4 w-4" />
                  Add leg
                </Button>
              </div>
              <div className="space-y-3">
                {routeForm.legs.map((leg) => (
                  <div key={leg.localId} className="grid gap-3 rounded-xl border bg-white p-3 md:grid-cols-6">
                    <div className="space-y-2">
                      <Label>Seq</Label>
                      <Input
                        type="number"
                        value={leg.sequence}
                        onChange={(event) =>
                          setRouteForm((current) => ({
                            ...current,
                            legs: current.legs.map((item) =>
                              item.localId === leg.localId ? { ...item, sequence: event.target.value } : item,
                            ),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Leg code</Label>
                      <Input
                        value={leg.legCode}
                        onChange={(event) =>
                          setRouteForm((current) => ({
                            ...current,
                            legs: current.legs.map((item) =>
                              item.localId === leg.localId ? { ...item, legCode: event.target.value } : item,
                            ),
                          }))
                        }
                        placeholder="linehaul"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Label</Label>
                      <Input
                        value={leg.label}
                        onChange={(event) =>
                          setRouteForm((current) => ({
                            ...current,
                            legs: current.legs.map((item) =>
                              item.localId === leg.localId ? { ...item, label: event.target.value } : item,
                            ),
                          }))
                        }
                        placeholder="China to Uzbekistan air"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Mode</Label>
                      <Select
                        value={leg.mode}
                        onValueChange={(value: IntegrationTransportMode) =>
                          setRouteForm((current) => ({
                            ...current,
                            legs: current.legs.map((item) =>
                              item.localId === leg.localId ? { ...item, mode: value } : item,
                            ),
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TRANSPORT_MODES.map((mode) => (
                            <SelectItem key={mode} value={mode}>
                              {labelize(mode)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>From</Label>
                      <Input
                        value={leg.originCountryCode}
                        onChange={(event) =>
                          setRouteForm((current) => ({
                            ...current,
                            legs: current.legs.map((item) =>
                              item.localId === leg.localId
                                ? { ...item, originCountryCode: normalizeCountryCode(event.target.value) }
                                : item,
                            ),
                          }))
                        }
                        placeholder="CN"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>To</Label>
                      <Input
                        value={leg.destinationCountryCode}
                        onChange={(event) =>
                          setRouteForm((current) => ({
                            ...current,
                            legs: current.legs.map((item) =>
                              item.localId === leg.localId
                                ? { ...item, destinationCountryCode: normalizeCountryCode(event.target.value) }
                                : item,
                            ),
                          }))
                        }
                        placeholder="UZ"
                      />
                    </div>
                    <div className="flex items-end md:col-span-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={routeForm.legs.length === 1}
                        onClick={() =>
                          setRouteForm((current) => ({
                            ...current,
                            legs: current.legs.filter((item) => item.localId !== leg.localId),
                          }))
                        }
                      >
                        Remove leg
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetRouteForm}>
                Reset
              </Button>
              <Button
                type="button"
                onClick={() => saveRouteMutation.mutate()}
                disabled={saveRouteMutation.isPending}
              >
                {saveRouteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editingRouteId ? "Update route" : "Create route"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70">
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Configured Route Templates</CardTitle>
                <CardDescription className="mt-2">
                  Tariff plans can reference one route template; carrier rules can target exact legs.
                </CardDescription>
              </div>
              <Button type="button" onClick={openCreateRoute}>
                <Plus className="h-4 w-4" />
                Create route template
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={routeSearch}
                  onChange={(event) => setRouteSearch(event.target.value)}
                  placeholder="Search route templates..."
                  className="pl-9"
                />
              </div>
              <div className="text-sm text-muted-foreground">
                Showing {pagedRouteTemplates.length} of {routeTemplatePage?.total ?? filteredRouteTemplates.length}
              </div>
            </div>
            <div className="max-h-[min(64vh,620px)] overflow-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Route</TableHead>
                    <TableHead>Lane</TableHead>
                    <TableHead>Legs</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {routeTemplatesQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        Loading route templates...
                      </TableCell>
                    </TableRow>
                  ) : filteredRouteTemplates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No route templates configured yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagedRouteTemplates.map((route) => (
                      <TableRow key={route.id}>
                        <TableCell>
                          <div className="font-medium">{route.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {route.code || "-"} / {companyName(companies, route.companyId)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {route.originCountryCode || "-"} {"\u2192"} {route.destinationCountryCode || "-"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {labelize(route.serviceType)} / {labelize(route.transportMode)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(route.legs ?? []).slice(0, 4).map((leg) => (
                              <Badge key={leg.id} variant="secondary" className="rounded-full">
                                {leg.sequence}. {leg.legCode}
                              </Badge>
                            ))}
                            {(route.legs ?? []).length > 4 ? (
                              <Badge variant="outline">+{(route.legs ?? []).length - 4}</Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge active={route.isActive} />
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              onClick={() => {
                                openEditRoute(route);
                              }}
                              title="Edit route"
                            >
                              <PencilLine className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              onClick={() => {
                                setDeleteTarget({ type: "route", id: route.id, name: route.name });
                              }}
                              title="Delete route"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                Loaded {pagedRouteTemplates.length} of {routeTemplatePage?.total ?? filteredRouteTemplates.length}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={routeCursorIndex <= 0}
                  onClick={goToPreviousRoutePage}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!routeTemplatePage?.pageInfo.hasNextPage}
                  onClick={goToNextRoutePage}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-5">
        {ruleEditorOpen ? (
          <div className="fixed inset-0 z-50 bg-black/45" onClick={() => setRuleEditorOpen(false)} />
        ) : null}
        <Card
          className={cn(
            "rounded-2xl border-border/70",
            ruleEditorOpen
              ? "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[min(980px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden shadow-2xl"
              : "hidden",
          )}
        >
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5 text-cyan-700" />
                  {editingRuleId ? "Edit Carrier Rule" : "Create Carrier Rule"}
                </CardTitle>
                <CardDescription className="mt-2">
                  Bind a carrier provider to a route leg. If auto-book is enabled, order creation books that leg automatically.
                </CardDescription>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setRuleEditorOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="min-h-0 space-y-4 overflow-y-auto">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Company</Label>
                <Select
                  value={ruleCompanyInOptions ? ruleForm.companyId : NULL_SELECT_VALUE}
                  onValueChange={(value) =>
                    setRuleForm((current) => ({
                      ...current,
                      companyId: value === NULL_SELECT_VALUE ? "" : value,
                    }))
                  }
                  disabled={Boolean(editingRuleId)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NULL_SELECT_VALUE}>Manual company ID</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!ruleForm.companyId || !ruleCompanyInOptions ? (
                  <Input
                    value={ruleForm.companyId}
                    onChange={(event) =>
                      setRuleForm((current) => ({ ...current, companyId: event.target.value }))
                    }
                    placeholder="Company UUID"
                    disabled={Boolean(editingRuleId)}
                  />
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Carrier provider</Label>
                <Select
                  value={ruleForm.providerId || NULL_SELECT_VALUE}
                  onValueChange={(value) =>
                    setRuleForm((current) => ({ ...current, providerId: value === NULL_SELECT_VALUE ? "" : value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select carrier provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NULL_SELECT_VALUE}>Select carrier provider</SelectItem>
                    {carrierProviders.map((provider: IntegrationProviderConfig) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.providerCode} ({provider.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Route template</Label>
                <Select
                  value={ruleForm.routeTemplateId || NULL_SELECT_VALUE}
                  onValueChange={(value) =>
                    setRuleForm((current) => ({
                      ...current,
                      routeTemplateId: value === NULL_SELECT_VALUE ? "" : value,
                      routeTemplateLegId: "",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional route template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NULL_SELECT_VALUE}>No route template</SelectItem>
                    {routeTemplateOptions.map((route) => (
                      <SelectItem key={route.id} value={route.id}>
                        {route.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Route leg</Label>
                <Select
                  value={ruleForm.routeTemplateLegId || NULL_SELECT_VALUE}
                  disabled={!selectedRoute}
                  onValueChange={(value) =>
                    setRuleForm((current) => ({
                      ...current,
                      routeTemplateLegId: value === NULL_SELECT_VALUE ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional exact route leg" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NULL_SELECT_VALUE}>No exact leg</SelectItem>
                    {(selectedRoute?.legs ?? []).map((leg) => (
                      <SelectItem key={leg.id} value={leg.id}>
                        {leg.sequence}. {leg.legCode} ({leg.originCountryCode || "-"} {"\u2192"} {leg.destinationCountryCode || "-"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedRouteLeg ? (
                <div className="md:col-span-2">
                  <Button type="button" variant="outline" size="sm" onClick={applySelectedRouteLeg}>
                    <WandSparkles className="h-4 w-4" />
                    Fill rule from selected leg
                  </Button>
                </div>
              ) : null}
              <div className="space-y-2">
                <Label>Rule name</Label>
                <Input
                  value={ruleForm.name}
                  onChange={(event) => setRuleForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Auto book CN to UZ linehaul"
                />
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={ruleForm.code}
                  onChange={(event) => setRuleForm((current) => ({ ...current, code: event.target.value }))}
                  placeholder="CN_UZ_LINEHAUL_DHL"
                />
              </div>
              <div className="space-y-2">
                <Label>Service</Label>
                <Select
                  value={ruleForm.serviceType}
                  onValueChange={(value: ServiceType) =>
                    setRuleForm((current) => ({ ...current, serviceType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map((serviceType) => (
                      <SelectItem key={serviceType} value={serviceType}>
                        {labelize(serviceType)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mode</Label>
                <Select
                  value={ruleForm.transportMode}
                  onValueChange={(value: IntegrationTransportMode) =>
                    setRuleForm((current) => ({ ...current, transportMode: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSPORT_MODES.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {labelize(mode)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Origin country</Label>
                <Input
                  value={ruleForm.originCountryCode}
                  onChange={(event) =>
                    setRuleForm((current) => ({
                      ...current,
                      originCountryCode: normalizeCountryCode(event.target.value),
                    }))
                  }
                  placeholder="CN"
                />
              </div>
              <div className="space-y-2">
                <Label>Destination country</Label>
                <Input
                  value={ruleForm.destinationCountryCode}
                  onChange={(event) =>
                    setRuleForm((current) => ({
                      ...current,
                      destinationCountryCode: normalizeCountryCode(event.target.value),
                    }))
                  }
                  placeholder="UZ"
                />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Input
                  type="number"
                  value={ruleForm.priority}
                  onChange={(event) => setRuleForm((current) => ({ ...current, priority: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Leg sequence</Label>
                <Input
                  type="number"
                  value={ruleForm.legSequence}
                  onChange={(event) => setRuleForm((current) => ({ ...current, legSequence: event.target.value }))}
                  placeholder="2"
                />
              </div>
              <div className="space-y-2">
                <Label>Min kg</Label>
                <Input
                  type="number"
                  value={ruleForm.minWeightKg}
                  onChange={(event) => setRuleForm((current) => ({ ...current, minWeightKg: event.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label>Max kg</Label>
                <Input
                  type="number"
                  value={ruleForm.maxWeightKg}
                  onChange={(event) => setRuleForm((current) => ({ ...current, maxWeightKg: event.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                <Checkbox
                  checked={ruleForm.autoBook}
                  onCheckedChange={(checked) =>
                    setRuleForm((current) => ({ ...current, autoBook: checked === true }))
                  }
                />
                Auto-book when matched
              </label>
              <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                <Checkbox
                  checked={ruleForm.isActive}
                  onCheckedChange={(checked) =>
                    setRuleForm((current) => ({ ...current, isActive: checked === true }))
                  }
                />
                Active rule
              </label>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetRuleForm}>
                Reset
              </Button>
              <Button type="button" onClick={() => saveRuleMutation.mutate()} disabled={saveRuleMutation.isPending}>
                {saveRuleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editingRuleId ? "Update rule" : "Create rule"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70">
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Carrier Routing Rules</CardTitle>
                <CardDescription className="mt-2">
                  Rules are evaluated by company, route template, leg, lane, transport mode, and weight.
                </CardDescription>
              </div>
              <Button type="button" onClick={openCreateRule}>
                <Plus className="h-4 w-4" />
                Create carrier rule
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={ruleSearch}
                  onChange={(event) => setRuleSearch(event.target.value)}
                  placeholder="Search carrier rules..."
                  className="pl-9"
                />
              </div>
              <div className="text-sm text-muted-foreground">
                Showing {pagedCarrierRules.length} of {carrierRulePage?.total ?? filteredCarrierRules.length}
              </div>
            </div>
            <div className="max-h-[min(64vh,620px)] overflow-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule</TableHead>
                    <TableHead>Carrier</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {carrierRulesQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        Loading carrier rules...
                      </TableCell>
                    </TableRow>
                  ) : filteredCarrierRules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No carrier routing rules yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagedCarrierRules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <div className="font-medium">{rule.name}</div>
                          <div className="text-xs text-muted-foreground">{rule.code || "-"}</div>
                        </TableCell>
                        <TableCell>
                          <div>{rule.providerCode || rule.providerId}</div>
                          <div className="text-xs text-muted-foreground">
                            {rule.providerEnvironment || "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{rule.routeTemplateName || "Generic lane rule"}</div>
                          <div className="text-xs text-muted-foreground">
                            {rule.routeTemplateLegCode
                              ? `Leg ${rule.routeTemplateLegSequence}: ${rule.routeTemplateLegCode}`
                              : `${rule.originCountryCode || "-"} -> ${rule.destinationCountryCode || "-"}`}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{labelize(rule.transportMode)}</div>
                          <div className="text-xs text-muted-foreground">{labelize(rule.serviceType)}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <StatusBadge active={rule.isActive} />
                            {rule.autoBook ? (
                              <Badge variant="secondary" className="w-fit rounded-full">
                                Auto-book
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              onClick={() => {
                                openEditRule(rule);
                              }}
                              title="Edit rule"
                            >
                              <PencilLine className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              onClick={() => {
                                setDeleteTarget({ type: "rule", id: rule.id, name: rule.name });
                              }}
                              title="Delete rule"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                Loaded {pagedCarrierRules.length} of {carrierRulePage?.total ?? filteredCarrierRules.length}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={ruleCursorIndex <= 0}
                  onClick={goToPreviousRulePage}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!carrierRulePage?.pageInfo.hasNextPage}
                  onClick={goToNextRulePage}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              Delete {deleteTarget?.type === "route" ? "route template" : "carrier rule"}?
            </DialogTitle>
            <DialogDescription>
              This removes &quot;{deleteTarget?.name}&quot;. Existing orders are not deleted, but future matching and auto-booking will no longer use this record.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteRouteMutation.isPending || deleteRuleMutation.isPending || !deleteTarget}
              onClick={() => {
                if (!deleteTarget) return;
                if (deleteTarget.type === "route") {
                  deleteRouteMutation.mutate(deleteTarget.id);
                } else {
                  deleteRuleMutation.mutate(deleteTarget.id);
                }
              }}
            >
              {deleteRouteMutation.isPending || deleteRuleMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="rounded-2xl border-cyan-100 bg-gradient-to-r from-cyan-50 via-white to-slate-50">
        <CardContent className="flex flex-wrap items-start gap-3 p-4 text-sm text-slate-700">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-100 text-cyan-800">
            <Boxes className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-slate-950">Recommended production flow</p>
            <p className="mt-1 text-muted-foreground">
              Configure route template first, link tariff plan to that template, then create carrier
              routing rules per leg. Orders stay provider-agnostic; only matched legs book carriers.
            </p>
          </div>
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            ERP-safe
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
