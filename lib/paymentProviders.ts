import { api } from "@/lib/api";

export type PaymentProvider = "CLICK" | "PAYME" | "UZUM" | "STRIPE";
export type PaymentEnvironment = "TEST" | "PRODUCTION";

export type PaymentProviderConfig = {
  id: string;
  companyId: string;
  provider: PaymentProvider;
  environment: PaymentEnvironment;
  isEnabled: boolean;
  merchantId: string | null;
  serviceId: string | null;
  accountId: string | null;
  secretMasked: string | null;
  callbackPath: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CompanyPaymentPolicy = {
  companyId: string;
  globalPaymentsEnabled: boolean;
  onlinePaymentsEnabled: boolean;
  effectiveOnlinePaymentsEnabled: boolean;
  defaultProvider: PaymentProvider | null;
  allowProviderOverride: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AvailablePaymentProvider = {
  id: string;
  provider: PaymentProvider;
  environment: PaymentEnvironment;
  callbackPath: string;
  integrationMode: "redirect" | "webhook";
  supportsCheckoutRedirect: boolean;
  configuredFields: {
    merchantId: boolean;
    serviceId: boolean;
    accountId: boolean;
  };
  updatedAt: string;
};

export type PaymentIntentSummary = {
  id: string;
  orderId: string;
  companyId: string;
  provider: PaymentProvider;
  providerConfigId: string;
  environment: PaymentEnvironment;
  amountMinor: string;
  currency: string;
  status: string;
  statusCanonical: string;
  providerPaymentId: string | null;
  providerInvoiceId: string | null;
  providerCheckoutUrl: string | null;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
};

export async function listPaymentProviderConfigs(params?: {
  companyId?: string;
  provider?: PaymentProvider;
  environment?: PaymentEnvironment;
  enabledOnly?: boolean;
}) {
  const res = await api.get<PaymentProviderConfig[]>("/api/settings/payments/providers", { params });
  return res.data;
}

export async function getCompanyPaymentPolicy(params?: { companyId?: string }) {
  const res = await api.get<CompanyPaymentPolicy>("/api/settings/payments/policy", {
    params,
  });
  return res.data;
}

export async function updateCompanyPaymentPolicy(input: {
  companyId: string;
  onlinePaymentsEnabled: boolean;
  defaultProvider?: PaymentProvider | null;
  allowProviderOverride?: boolean;
}) {
  const res = await api.put<CompanyPaymentPolicy>("/api/settings/payments/policy", input);
  return res.data;
}

export async function listAvailablePaymentProviders(params?: {
  companyId?: string;
  environment?: PaymentEnvironment;
}) {
  const res = await api.get<AvailablePaymentProvider[]>("/api/payments/providers/available", {
    params,
  });
  return res.data;
}

export async function createPaymentProviderConfig(input: {
  companyId: string;
  provider: PaymentProvider;
  environment: PaymentEnvironment;
  isEnabled?: boolean;
  merchantId?: string;
  serviceId?: string;
  accountId?: string;
  secret: string;
}) {
  const res = await api.post<PaymentProviderConfig>("/api/settings/payments/providers", input);
  return res.data;
}

export async function updatePaymentProviderConfig(
  id: string,
  input: {
    isEnabled?: boolean;
    merchantId?: string;
    serviceId?: string;
    accountId?: string;
    secret?: string;
    environment?: PaymentEnvironment;
  },
) {
  const res = await api.patch<PaymentProviderConfig>(`/api/settings/payments/providers/${id}`, input);
  return res.data;
}

export async function testPaymentProviderConfig(id: string) {
  const res = await api.post<{
    id: string;
    provider: PaymentProvider;
    environment: PaymentEnvironment;
    isEnabled: boolean;
    callbackPath: string | null;
    merchantId: string | null;
    serviceId: string | null;
    accountId: string | null;
    secretMasked: string | null;
    healthy: boolean;
    issues?: string[];
  }>(`/api/settings/payments/providers/${id}/test`);
  return res.data;
}

export async function listOrderPaymentIntents(orderId: string) {
  const res = await api.get<{ items: PaymentIntentSummary[] }>(
    `/api/orders/${orderId}/payment/intents`,
  );
  return res.data.items;
}

export async function syncPaymentIntent(id: string) {
  const res = await api.post<{
    paymentIntent: PaymentIntentSummary;
    providerStatus: string;
    providerResponse?: unknown;
  }>(`/api/payments/intents/${id}/sync`);
  return res.data;
}

export async function retryOrderPayment(input: {
  orderId: string;
  provider?: PaymentProvider;
}) {
  const res = await api.post<{
    paymentIntentId: string;
    status: string;
    checkoutUrl: string | null;
    providerPaymentId: string | null;
    reused: boolean;
  }>(`/api/orders/${input.orderId}/payment/retry`, {
    provider: input.provider,
  });
  return res.data;
}
