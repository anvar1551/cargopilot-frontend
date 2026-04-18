import { api } from "@/lib/api";
import type { ServiceType } from "@/lib/orders/service-types";

export type PricingRegion = {
  id: string;
  code: string;
  name: string;
  aliases: string[];
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ZoneMatrixEntry = {
  id: string;
  originRegionId: string;
  destinationRegionId: string;
  zone: number;
  createdAt: string;
  updatedAt: string;
  originRegion: PricingRegion;
  destinationRegion: PricingRegion;
};

export type TariffRate = {
  id: string;
  tariffPlanId: string;
  zone: number;
  weightFromKg: string;
  weightToKg: string;
  price: string;
  createdAt: string;
  updatedAt: string;
};

export type TariffPlanStatus = "draft" | "active" | "archived";
export type TariffPriceType = "bucket" | "linear";
export type DeliverySlaRule = {
  id: string;
  name: string;
  description?: string | null;
  serviceType: ServiceType;
  originRegionId?: string | null;
  destinationRegionId?: string | null;
  zone?: number | null;
  deliveryDays: number;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  originRegion?: PricingRegion | null;
  destinationRegion?: PricingRegion | null;
};

export type OperationalSlaPolicy = {
  id: string;
  singletonKey: string;
  staleHours: number;
  dueSoonHours: number;
  overdueGraceHours: number;
  createdAt: string;
  updatedAt: string;
};

export type TariffPlanSummary = {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  status: TariffPlanStatus;
  serviceType: ServiceType;
  priceType: TariffPriceType;
  currency: string;
  priority: number;
  isDefault: boolean;
  customerEntityId?: string | null;
  createdAt: string;
  updatedAt: string;
  customerEntity?: {
    id: string;
    name: string;
    type: "PERSON" | "COMPANY";
  } | null;
  _count?: {
    rates: number;
  };
};

export type TariffPlanDetail = TariffPlanSummary & {
  rates: TariffRate[];
};

export type PricingQuote = {
  quoteAvailable: boolean;
  reason: string | null;
  serviceType: ServiceType;
  weightKg?: number | null;
  currency?: string | null;
  serviceCharge?: number | null;
  zone?: number | null;
  originRegion?: {
    id: string;
    code: string;
    name: string;
  } | null;
  destinationRegion?: {
    id: string;
    code: string;
    name: string;
  } | null;
  tariffPlan?: {
    id: string;
    name: string;
    code?: string | null;
    priceType?: TariffPriceType;
    priority?: number;
    isDefault?: boolean;
    customerEntityId?: string | null;
  } | null;
  matchedRate?: {
    id: string;
    zone: number;
    weightFromKg?: number | null;
    weightToKg?: number | null;
    price?: number | null;
  } | null;
};

export async function fetchPricingRegions(params?: {
  q?: string;
  isActive?: boolean;
}): Promise<PricingRegion[]> {
  const res = await api.get("/api/pricing/regions", {
    params,
  });
  return Array.isArray(res.data) ? res.data : [];
}

export async function createPricingRegion(payload: {
  code: string;
  name: string;
  aliases?: string[];
  sortOrder?: number;
  isActive?: boolean;
}): Promise<PricingRegion> {
  const res = await api.post("/api/pricing/regions", payload);
  return res.data;
}

export async function updatePricingRegion(
  id: string,
  payload: {
    code: string;
    name: string;
    aliases?: string[];
    sortOrder?: number;
    isActive?: boolean;
  },
): Promise<PricingRegion> {
  const res = await api.put(`/api/pricing/regions/${id}`, payload);
  return res.data;
}

export async function fetchZoneMatrix(params?: {
  originRegionId?: string;
  destinationRegionId?: string;
}): Promise<ZoneMatrixEntry[]> {
  const res = await api.get("/api/pricing/zones", {
    params,
  });
  return Array.isArray(res.data) ? res.data : [];
}

export async function saveZoneMatrix(payload: {
  entries: Array<{
    originRegionId: string;
    destinationRegionId: string;
    zone: number;
  }>;
}): Promise<ZoneMatrixEntry[]> {
  const res = await api.post("/api/pricing/zones/bulk", payload);
  return Array.isArray(res.data) ? res.data : [];
}

export async function fetchTariffPlans(params?: {
  status?: TariffPlanStatus;
  serviceType?: ServiceType;
  customerEntityId?: string;
  q?: string;
}): Promise<TariffPlanSummary[]> {
  const res = await api.get("/api/pricing/tariff-plans", {
    params,
  });
  return Array.isArray(res.data) ? res.data : [];
}

export async function fetchTariffPlan(id: string): Promise<TariffPlanDetail> {
  const res = await api.get(`/api/pricing/tariff-plans/${id}`);
  return res.data;
}

export async function fetchDeliverySlaRules(params?: {
  q?: string;
  serviceType?: ServiceType;
  isActive?: boolean;
}): Promise<DeliverySlaRule[]> {
  const res = await api.get("/api/pricing/sla-rules", {
    params,
  });
  return Array.isArray(res.data) ? res.data : [];
}

export async function fetchOperationalSlaPolicy(): Promise<OperationalSlaPolicy> {
  const res = await api.get("/api/pricing/sla-policy");
  return res.data;
}

export async function updateOperationalSlaPolicy(payload: {
  staleHours: number;
  dueSoonHours: number;
  overdueGraceHours: number;
}): Promise<OperationalSlaPolicy> {
  const res = await api.put("/api/pricing/sla-policy", payload);
  return res.data;
}

export async function createDeliverySlaRule(payload: {
  name: string;
  description?: string | null;
  serviceType: ServiceType;
  originRegionId?: string | null;
  destinationRegionId?: string | null;
  zone?: number | null;
  deliveryDays: number;
  priority?: number;
  isActive?: boolean;
}): Promise<DeliverySlaRule> {
  const res = await api.post("/api/pricing/sla-rules", payload);
  return res.data;
}

export async function updateDeliverySlaRule(
  id: string,
  payload: {
    name: string;
    description?: string | null;
    serviceType: ServiceType;
    originRegionId?: string | null;
    destinationRegionId?: string | null;
    zone?: number | null;
    deliveryDays: number;
    priority?: number;
    isActive?: boolean;
  },
): Promise<DeliverySlaRule> {
  const res = await api.put(`/api/pricing/sla-rules/${id}`, payload);
  return res.data;
}

export async function createTariffPlan(payload: {
  name: string;
  code?: string | null;
  description?: string | null;
  status?: TariffPlanStatus;
  serviceType: ServiceType;
  priceType?: TariffPriceType;
  currency?: string;
  priority?: number;
  isDefault?: boolean;
  customerEntityId?: string | null;
  rates: Array<{
    zone: number;
    weightFromKg: number;
    weightToKg: number;
    price: number;
  }>;
}): Promise<TariffPlanDetail> {
  const res = await api.post("/api/pricing/tariff-plans", payload);
  return res.data;
}

export async function updateTariffPlan(
  id: string,
  payload: {
    name: string;
    code?: string | null;
    description?: string | null;
    status?: TariffPlanStatus;
    serviceType: ServiceType;
    priceType?: TariffPriceType;
    currency?: string;
    priority?: number;
    isDefault?: boolean;
    customerEntityId?: string | null;
    rates: Array<{
      zone: number;
      weightFromKg: number;
      weightToKg: number;
      price: number;
    }>;
  },
): Promise<TariffPlanDetail> {
  const res = await api.put(`/api/pricing/tariff-plans/${id}`, payload);
  return res.data;
}

export async function fetchPricingQuote(payload: {
  customerEntityId?: string | null;
  serviceType?: ServiceType | null;
  weightKg?: number | null;
  originQuery?: string | null;
  destinationQuery?: string | null;
}): Promise<PricingQuote> {
  const res = await api.post("/api/pricing/quote", payload);
  return res.data;
}
