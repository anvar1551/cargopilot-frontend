import { api } from "@/lib/api";

export type IntegrationDomain = "carrier" | "sms" | "payment" | "webhook_sink";
export type IntegrationEnvironment = "sandbox" | "production";
export type IntegrationProviderStatus = "active" | "paused" | "disabled";
export type IntegrationOutboxStatus =
  | "pending"
  | "processing"
  | "sent"
  | "failed"
  | "dead_letter";
export type IntegrationCanonicalEventStatus =
  | "pending"
  | "processing"
  | "processed"
  | "failed"
  | "ignored";
export type IntegrationServiceType =
  | "DOOR_TO_DOOR"
  | "DOOR_TO_POINT"
  | "POINT_TO_DOOR"
  | "POINT_TO_POINT";
export type IntegrationTransportMode = "road" | "air" | "rail" | "sea" | "multimodal";

export type IntegrationProviderConfig = {
  id: string;
  companyId: string;
  domain: IntegrationDomain;
  providerCode: string;
  status: IntegrationProviderStatus;
  environment: IntegrationEnvironment;
  capabilities: string[];
  rateLimitRps: number | null;
  timeoutMs: number;
  retryPolicyId: string | null;
  secretRef: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type IntegrationOutboxItem = {
  id: string;
  companyId: string;
  providerId: string | null;
  providerCode: string;
  domain: IntegrationDomain;
  eventType: string;
  status: IntegrationOutboxStatus;
  maxAttempts: number;
  attemptCount: number;
  nextAttemptAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  idempotencyKey: string;
  createdAt: string | null;
  updatedAt: string | null;
  provider: {
    id: string;
    providerCode: string;
    status: IntegrationProviderStatus;
    environment: IntegrationEnvironment;
  } | null;
  latestAttempt: {
    attemptNo: number;
    outcome: string;
    statusCode: number | null;
    retryable: boolean;
    errorMessage: string | null;
    createdAt: string;
  } | null;
};

export type IntegrationOutboxResponse = {
  items: IntegrationOutboxItem[];
  total: number;
  page: number;
  limit: number;
};

export type IntegrationWebhookEventItem = {
  id: string;
  companyId: string | null;
  providerId: string | null;
  providerCode: string;
  domain: IntegrationDomain;
  environment: IntegrationEnvironment;
  providerEventId: string;
  signatureVerified: boolean;
  rawBodySha256: string;
  ipAddress: string | null;
  userAgent: string | null;
  receivedAt: string | null;
  processedAt: string | null;
  canonical: {
    eventType: string;
    aggregateType: string | null;
    aggregateId: string | null;
    occurredAt: string | null;
  } | null;
  latestCanonicalEvent: {
    id: string;
    status: IntegrationCanonicalEventStatus;
    eventType: string;
    aggregateType: string | null;
    aggregateId: string | null;
    lastError: string | null;
    processedAt: string | null;
    createdAt: string | null;
  } | null;
};

export type IntegrationCanonicalEventItem = {
  id: string;
  source: "outbound_response" | "inbound_webhook";
  status: IntegrationCanonicalEventStatus;
  companyId: string | null;
  providerId: string | null;
  webhookEventId: string | null;
  outboxId: string | null;
  domain: IntegrationDomain;
  providerCode: string;
  eventType: string;
  aggregateType: string | null;
  aggregateId: string | null;
  processAttempts: number;
  lastError: string | null;
  occurredAt: string | null;
  lockedAt: string | null;
  processedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type IntegrationWebhookEventsResponse = {
  items: IntegrationWebhookEventItem[];
  total: number;
  page: number;
  limit: number;
};

export type IntegrationCanonicalEventsResponse = {
  items: IntegrationCanonicalEventItem[];
  total: number;
  page: number;
  limit: number;
};

export type CursorPage<T> = {
  data: T[];
  total: number;
  pageInfo: {
    limit: number;
    hasNextPage: boolean;
    nextCursor: string | null;
  };
};

export type IntegrationDeliveryAttempt = {
  id: string;
  outboxId: string;
  attemptNo: number;
  outcome: string;
  statusCode: number | null;
  retryable: boolean;
  errorMessage: string | null;
  providerRequestId: string | null;
  requestJson: unknown;
  responseJson: unknown;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string | null;
};

export type RouteTemplateLeg = {
  id: string;
  routeTemplateId: string;
  sequence: number;
  legCode: string;
  label: string | null;
  mode: IntegrationTransportMode;
  originCountryCode: string | null;
  destinationCountryCode: string | null;
  metadata: unknown;
  createdAt: string | null;
  updatedAt: string | null;
};

export type RouteTemplate = {
  id: string;
  companyId: string;
  company?: {
    id: string;
    name: string;
    code?: string | null;
    type?: string | null;
  } | null;
  name: string;
  code: string | null;
  isActive: boolean;
  priority: number;
  serviceType: IntegrationServiceType | null;
  transportMode: IntegrationTransportMode | null;
  originCountryCode: string | null;
  destinationCountryCode: string | null;
  metadata: unknown;
  legs: RouteTemplateLeg[];
  legCount?: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type RouteTemplateInput = {
  companyId?: string;
  name: string;
  code?: string | null;
  isActive?: boolean;
  priority?: number;
  serviceType?: IntegrationServiceType | null;
  transportMode?: IntegrationTransportMode | null;
  originCountryCode?: string | null;
  destinationCountryCode?: string | null;
  metadata?: unknown;
  legs: Array<{
    id?: string;
    sequence: number;
    legCode: string;
    label?: string | null;
    mode: IntegrationTransportMode;
    originCountryCode?: string | null;
    destinationCountryCode?: string | null;
    metadata?: unknown;
  }>;
};

export type CarrierRoutingRule = {
  id: string;
  companyId: string;
  name: string;
  code: string | null;
  providerId: string;
  providerCode: string | null;
  providerEnvironment: IntegrationEnvironment | null;
  fallbackProviderId: string | null;
  fallbackProviderCode: string | null;
  routeTemplateId: string | null;
  routeTemplateName: string | null;
  routeTemplateCode: string | null;
  routeTemplateLegId: string | null;
  routeTemplateLegCode: string | null;
  routeTemplateLegSequence: number | null;
  isActive: boolean;
  priority: number;
  autoBook: boolean;
  serviceType: IntegrationServiceType | null;
  transportMode: IntegrationTransportMode | null;
  originCountryCode: string | null;
  destinationCountryCode: string | null;
  minWeightKg: number | null;
  maxWeightKg: number | null;
  legSequence: number | null;
  conditionsJson: unknown;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CarrierRoutingRuleInput = {
  companyId?: string;
  name: string;
  code?: string | null;
  providerId: string;
  fallbackProviderId?: string | null;
  routeTemplateId?: string | null;
  routeTemplateLegId?: string | null;
  isActive?: boolean;
  priority?: number;
  autoBook?: boolean;
  serviceType?: IntegrationServiceType | null;
  transportMode?: IntegrationTransportMode | null;
  originCountryCode?: string | null;
  destinationCountryCode?: string | null;
  minWeightKg?: number | null;
  maxWeightKg?: number | null;
  legSequence?: number | null;
  conditionsJson?: unknown;
};

export async function listIntegrationProviders(params?: {
  companyId?: string;
  domain?: IntegrationDomain | "all";
  status?: IntegrationProviderStatus | "all";
  environment?: IntegrationEnvironment | "all";
  providerCode?: string;
  q?: string;
}) {
  const query = {
    ...params,
    domain: params?.domain === "all" ? undefined : params?.domain,
    status: params?.status === "all" ? undefined : params?.status,
    environment: params?.environment === "all" ? undefined : params?.environment,
  };
  const res = await api.get<IntegrationProviderConfig[]>("/api/integrations/providers", {
    params: query,
  });
  return res.data;
}

export async function listIntegrationProvidersPage(params?: {
  companyId?: string;
  domain?: IntegrationDomain | "all";
  status?: IntegrationProviderStatus | "all";
  environment?: IntegrationEnvironment | "all";
  providerCode?: string;
  q?: string;
  cursor?: string | null;
  limit?: number;
}) {
  const query = {
    ...params,
    cursor: params?.cursor || undefined,
    domain: params?.domain === "all" ? undefined : params?.domain,
    status: params?.status === "all" ? undefined : params?.status,
    environment: params?.environment === "all" ? undefined : params?.environment,
  };
  const res = await api.get<CursorPage<IntegrationProviderConfig>>(
    "/api/integrations/providers",
    { params: query },
  );
  return res.data;
}

export async function upsertIntegrationProvider(input: {
  companyId: string;
  domain: IntegrationDomain;
  providerCode: string;
  environment: IntegrationEnvironment;
  status?: IntegrationProviderStatus;
  capabilities?: string[];
  rateLimitRps?: number | null;
  timeoutMs?: number;
  retryPolicyId?: string | null;
}) {
  const res = await api.post<IntegrationProviderConfig>("/api/integrations/providers", input);
  return res.data;
}

export async function updateIntegrationProviderStatus(
  id: string,
  status: IntegrationProviderStatus,
) {
  const res = await api.patch<IntegrationProviderConfig>(
    `/api/integrations/providers/${id}/status`,
    { status },
  );
  return res.data;
}

export async function deleteIntegrationProvider(id: string) {
  const res = await api.delete<{ deleted: true; id: string; providerCode: string }>(
    `/api/integrations/providers/${id}`,
  );
  return res.data;
}

export async function rotateIntegrationProviderSecret(input: {
  id: string;
  secretPayload: string | Record<string, unknown>;
  keyVersion?: number;
}) {
  const res = await api.post<{
    providerId: string;
    secretRef: string;
    keyVersion: number;
    secretMasked: string;
    rotatedAt: string | null;
    createdAt: string | null;
  }>(`/api/integrations/providers/${input.id}/rotate-secret`, {
    secretPayload: input.secretPayload,
    keyVersion: input.keyVersion,
  });
  return res.data;
}

export async function listIntegrationOutbox(params?: {
  companyId?: string;
  status?: IntegrationOutboxStatus | "all";
  domain?: IntegrationDomain | "all";
  providerCode?: string;
  page?: number;
  limit?: number;
}) {
  const query = {
    ...params,
    status: params?.status === "all" ? undefined : params?.status,
    domain: params?.domain === "all" ? undefined : params?.domain,
  };
  const res = await api.get<IntegrationOutboxResponse>("/api/integrations/outbox", {
    params: query,
  });
  return res.data;
}

export async function listIntegrationOutboxAttempts(id: string, limit = 50) {
  const res = await api.get<IntegrationDeliveryAttempt[]>(
    `/api/integrations/outbox/${id}/attempts`,
    { params: { limit } },
  );
  return res.data;
}

export async function listIntegrationWebhookEvents(params?: {
  companyId?: string;
  domain?: IntegrationDomain | "all";
  providerCode?: string;
  q?: string;
  page?: number;
  limit?: number;
}) {
  const query = {
    ...params,
    domain: params?.domain === "all" ? undefined : params?.domain,
  };
  const res = await api.get<IntegrationWebhookEventsResponse>(
    "/api/integrations/webhook-events",
    { params: query },
  );
  return res.data;
}

export async function listIntegrationCanonicalEvents(params?: {
  companyId?: string;
  status?: IntegrationCanonicalEventStatus | "all";
  domain?: IntegrationDomain | "all";
  providerCode?: string;
  q?: string;
  page?: number;
  limit?: number;
}) {
  const query = {
    ...params,
    status: params?.status === "all" ? undefined : params?.status,
    domain: params?.domain === "all" ? undefined : params?.domain,
  };
  const res = await api.get<IntegrationCanonicalEventsResponse>(
    "/api/integrations/canonical-events",
    { params: query },
  );
  return res.data;
}

export async function replayIntegrationOutbox(id: string) {
  const res = await api.post<{
    replayedFromOutboxId: string;
    outboxId: string;
    idempotencyKey: string;
    status: IntegrationOutboxStatus;
    nextAttemptAt: string | null;
  }>(`/api/integrations/outbox/${id}/replay`);
  return res.data;
}

export async function retryIntegrationOutboxNow(id: string) {
  const res = await api.post<{
    outboxId: string;
    status: IntegrationOutboxStatus;
    nextAttemptAt: string | null;
    updatedAt: string | null;
  }>(`/api/integrations/outbox/${id}/retry-now`);
  return res.data;
}

export async function listRouteTemplates(params?: {
  companyId?: string;
  isActive?: boolean;
  q?: string;
}) {
  const res = await api.get<RouteTemplate[]>("/api/integrations/route-templates", {
    params,
  });
  return Array.isArray(res.data) ? res.data : [];
}

export async function listRouteTemplatesPage(params?: {
  companyId?: string;
  isActive?: boolean;
  q?: string;
  cursor?: string | null;
  limit?: number;
}) {
  const res = await api.get<CursorPage<RouteTemplate>>("/api/integrations/route-templates", {
    params: { ...params, cursor: params?.cursor || undefined },
  });
  return res.data;
}

export async function createRouteTemplate(input: RouteTemplateInput & { companyId: string }) {
  const res = await api.post<RouteTemplate>("/api/integrations/route-templates", input);
  return res.data;
}

export async function updateRouteTemplate(id: string, input: RouteTemplateInput) {
  const res = await api.put<RouteTemplate>(`/api/integrations/route-templates/${id}`, input);
  return res.data;
}

export async function deleteRouteTemplate(id: string) {
  const res = await api.delete<{ deleted: true; id: string }>(
    `/api/integrations/route-templates/${id}`,
  );
  return res.data;
}

export async function listCarrierRoutingRules(params?: {
  companyId?: string;
  providerId?: string;
  routeTemplateId?: string;
  isActive?: boolean;
  q?: string;
}) {
  const res = await api.get<CarrierRoutingRule[]>("/api/integrations/carrier-routing-rules", {
    params,
  });
  return Array.isArray(res.data) ? res.data : [];
}

export async function listCarrierRoutingRulesPage(params?: {
  companyId?: string;
  providerId?: string;
  routeTemplateId?: string;
  isActive?: boolean;
  q?: string;
  cursor?: string | null;
  limit?: number;
}) {
  const res = await api.get<CursorPage<CarrierRoutingRule>>(
    "/api/integrations/carrier-routing-rules",
    { params: { ...params, cursor: params?.cursor || undefined } },
  );
  return res.data;
}

export async function createCarrierRoutingRule(input: CarrierRoutingRuleInput & { companyId: string }) {
  const res = await api.post<CarrierRoutingRule>("/api/integrations/carrier-routing-rules", input);
  return res.data;
}

export async function updateCarrierRoutingRule(id: string, input: CarrierRoutingRuleInput) {
  const res = await api.put<CarrierRoutingRule>(
    `/api/integrations/carrier-routing-rules/${id}`,
    input,
  );
  return res.data;
}

export async function deleteCarrierRoutingRule(id: string) {
  const res = await api.delete<{ deleted: true; id: string }>(
    `/api/integrations/carrier-routing-rules/${id}`,
  );
  return res.data;
}
