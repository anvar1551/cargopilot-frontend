"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { PackagePlus } from "lucide-react";

import {
  createOrderPayloadSchema,
  type CreateOrderFormValues,
  type CreateOrderPayload,
} from "@/lib/validators/order";
import type { CreateOrderParcelsFieldArray } from "./create-order-form.types";
import { createOrder, type Order, type OrdersResponse } from "@/lib/orders";
import {
  fetchPricingQuote,
  fetchPricingQuoteOptions,
  type PricingQuote,
  type PricingQuoteOptionsResponse,
} from "@/lib/pricing";
import { getUser, type AuthUser } from "@/lib/auth";
import {
  getCompanyPaymentPolicy,
  listAvailablePaymentProviders,
  type PaymentEnvironment,
} from "@/lib/paymentProviders";
import { cn } from "@/lib/utils";

import { useI18n } from "@/components/i18n/I18nProvider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

import { CustomerStep } from "./steps/CustomerStep";
import { ShipmentStep } from "./steps/ShipmentStep";
import { PaymentStep } from "./steps/PaymentStep";
import { ReviewStep } from "./steps/ReviewStep";

type TabKey = "customer" | "shipment" | "payment" | "review";
const FORM_ID = "create-shipment-form";
const TAB_STEPS: Array<{ key: TabKey; labelKey: string }> = [
  { key: "customer", labelKey: "createOrder.step.customer" },
  { key: "shipment", labelKey: "createOrder.step.shipment" },
  { key: "payment", labelKey: "createOrder.step.payment" },
  { key: "review", labelKey: "createOrder.step.review" },
];

type CreateOrderDialogProps = {
  mode?: "customer" | "manager";
  presetCustomerEntityId?: string | null;
  presetCustomerEntityLabel?: string | null;
  lockCustomerEntitySelection?: boolean;
  triggerLabel?: string;
  triggerClassName?: string;
};

type OrdersCache = OrdersResponse | Order[] | undefined;

type CreateOrderResponse = {
  order?: Order | null;
  paymentUrl?: string | null;
  warning?: string | null;
};

type CreateOrderMutationContext = {
  optimisticOrderId?: string;
};

const ONLINE_PRICING_REASON_KEYS = new Set([
  "missing_required_fields",
  "origin_region_not_found",
  "destination_region_not_found",
  "zone_not_found",
  "tariff_plan_not_found",
  "rate_not_found",
]);

function extractApiErrorMessage(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const candidate = error as {
    response?: { data?: { error?: string } };
    message?: string;
  };
  return candidate.response?.data?.error ?? candidate.message;
}

function resolveFriendlyCreateOrderError(
  message: string | undefined,
  t: (key: string, values?: Record<string, string | number>) => string,
): string | null {
  if (!message) return null;

  const reasonMatch = message.match(/\(([^)]+)\)\s*$/);
  const reason = reasonMatch?.[1]?.trim();
  if (reason && ONLINE_PRICING_REASON_KEYS.has(reason)) {
    return t(`createOrder.payment.quoteReason.${reason}`);
  }

  if (message.includes("No payable pricing components found for online payment")) {
    return t("createOrder.payment.onlinePricingNoComponents");
  }

  if (message.includes("Online payment requires active pricing rule quote")) {
    return t("createOrder.payment.onlinePricingRequired");
  }

  return null;
}

function buildOptimisticOrder(
  values: CreateOrderPayload,
  user: AuthUser | null,
  isManager: boolean,
  presetCustomerEntityId: string | null,
): Order {
  const now = new Date().toISOString();
  const optimisticId = `optimistic-order-${Date.now()}`;
  const customerEntityId = isManager
    ? values.customerEntityId ?? presetCustomerEntityId ?? null
    : user?.customerEntityId ?? null;

  return {
    id: optimisticId,
    orderNumber: "Creating...",
    status: "pending",
    pickupAddress: values.addresses?.pickupAddress ?? null,
    dropoffAddress: values.addresses?.dropoffAddress ?? null,
    pickupLat: values.addresses?.senderAddress?.latitude ?? null,
    pickupLng: values.addresses?.senderAddress?.longitude ?? null,
    dropoffLat: values.addresses?.receiverAddress?.latitude ?? null,
    dropoffLng: values.addresses?.receiverAddress?.longitude ?? null,
    createdAt: now,
    updatedAt: now,
    plannedDeliveryAt: values.schedule?.plannedDeliveryAt ?? null,
    destinationCity: values.addresses?.destinationCity ?? null,
    serviceType: values.shipment?.serviceType ?? null,
    customer: user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
        }
      : null,
    customerEntity: customerEntityId
      ? {
          id: customerEntityId,
          name: null,
          companyName: null,
          phone: null,
        }
      : null,
    senderName: values.sender?.name ?? null,
    senderPhone: values.sender?.phone ?? null,
    receiverName: values.receiver?.name ?? null,
    receiverPhone: values.receiver?.phone ?? null,
    parcels: (values.shipment?.parcels ?? []).map((_, index) => ({
      id: `${optimisticId}-parcel-${index}`,
      labelKey: null,
      parcelCode: null,
      pieceNo: index + 1,
      pieceTotal: values.shipment?.parcels?.length ?? 1,
    })),
    __optimistic: true,
  };
}

function prependOrderToCache(cache: OrdersCache, optimisticOrder: Order): OrdersCache {
  if (!cache) return cache;
  if (Array.isArray(cache)) {
    return [
      optimisticOrder,
      ...cache.filter((order) => order.id !== optimisticOrder.id),
    ];
  }

  return {
    ...cache,
    total: typeof cache.total === "number" ? cache.total + 1 : cache.total,
    orders: [
      optimisticOrder,
      ...(cache.orders ?? []).filter((order) => order.id !== optimisticOrder.id),
    ],
  };
}

function replaceOrderInCache(
  cache: OrdersCache,
  optimisticOrderId: string,
  createdOrder?: Order | null,
): OrdersCache {
  if (!cache) return cache;
  if (Array.isArray(cache)) {
    return createdOrder
      ? cache.map((order) =>
          order.id === optimisticOrderId ? createdOrder : order,
        )
      : cache.filter((order) => order.id !== optimisticOrderId);
  }

  const nextOrders = createdOrder
    ? (cache.orders ?? []).map((order) =>
        order.id === optimisticOrderId ? createdOrder : order,
      )
    : (cache.orders ?? []).filter((order) => order.id !== optimisticOrderId);

  return {
    ...cache,
    total:
      !createdOrder && typeof cache.total === "number"
        ? Math.max(0, cache.total - 1)
        : cache.total,
    orders: nextOrders,
  };
}

export default function CreateOrderDialog({
  mode = "customer",
  presetCustomerEntityId = null,
  presetCustomerEntityLabel = null,
  lockCustomerEntitySelection = false,
  triggerLabel = "New Shipment",
  triggerClassName,
}: CreateOrderDialogProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>("customer");

  const qc = useQueryClient();
  const user = useMemo(() => getUser(), []);
  const isManager = mode === "manager";
  const paymentAttemptKeyRef = useRef<string | null>(null);

  const form = useForm<CreateOrderFormValues, unknown, CreateOrderPayload>({
    resolver: zodResolver(createOrderPayloadSchema),
    mode: "onSubmit",
    shouldFocusError: true,
    shouldUnregister: false,
    defaultValues: {
      customerEntityId: isManager
        ? (presetCustomerEntityId ?? undefined)
        : (user?.customerEntityId ?? undefined),
      sender: { name: null, phone: null, phone2: null, phone3: null },
      receiver: { name: null, phone: null, phone2: null, phone3: null },
      addresses: {
        senderAddressId: null,
        receiverAddressId: null,
        senderAddress: null,
        receiverAddress: null,
        pickupAddress: "",
        dropoffAddress: "",
        destinationCity: null,
        savePickupToAddressBook: false,
        saveDropoffToAddressBook: false,
      },
      shipment: {
        serviceType: "DOOR_TO_DOOR",
        transportMode: "ROAD",
        weightKg: undefined,
        codEnabled: false,
        codAmount: undefined,
        currency: "UZS",
        parcels: [{ weightKg: null, lengthCm: null, widthCm: null, heightCm: null }],
        pieceTotal: 1,
        fragile: false,
        dangerousGoods: false,
        shipmentInsurance: false,
        itemValue: undefined,
      },
      payment: {
        paymentType: "CASH",
        provider: null,
        idempotencyKey: null,
        deliveryChargePaidBy: "SENDER",
        codPaidStatus: null,
        serviceCharge: undefined,
        serviceChargePaidStatus: "NOT_PAID",
        ifRecipientNotAvailable: "CALL_SENDER",
      },
      schedule: {
        plannedPickupAt: null,
        plannedDeliveryAt: null,
        promiseDate: null,
      },
      reference: {
        referenceId: null,
        shelfId: null,
        promoCode: null,
        numberOfCalls: undefined,
      },
      note: null,
      amount: undefined,
    },
  });

  const parcels = useFieldArray({
    control: form.control,
    name: "shipment.parcels",
  }) as CreateOrderParcelsFieldArray;

  const selectedCustomerEntityId = useWatch({
    control: form.control,
    name: "customerEntityId",
  });
  const senderRegionQuery = useWatch({
    control: form.control,
    name: "addresses.senderAddress.city",
  });
  const receiverRegionQuery = useWatch({
    control: form.control,
    name: "addresses.receiverAddress.city",
  });
  const senderCountryCode = useWatch({
    control: form.control,
    name: "addresses.senderAddress.country",
  });
  const receiverCountryCode = useWatch({
    control: form.control,
    name: "addresses.receiverAddress.country",
  });
  const destinationCity = useWatch({
    control: form.control,
    name: "addresses.destinationCity",
  });
  const serviceType = useWatch({
    control: form.control,
    name: "shipment.serviceType",
  });
  const transportMode = useWatch({
    control: form.control,
    name: "shipment.transportMode",
  });
  const weightKg = useWatch({
    control: form.control,
    name: "shipment.weightKg",
  });

  const canSaveAddresses = isManager
    ? Boolean(selectedCustomerEntityId)
    : Boolean(user?.customerEntityId);
  const pricingCustomerEntityId = isManager
    ? (selectedCustomerEntityId ?? null)
    : (user?.customerEntityId ?? null);
  const pricingOriginQuery = senderRegionQuery?.trim() || null;
  const pricingDestinationQuery =
    receiverRegionQuery?.trim() || destinationCity?.trim() || null;
  const pricingReady = Boolean(
    open &&
      serviceType &&
      typeof weightKg === "number" &&
      weightKg > 0 &&
      pricingOriginQuery &&
      pricingDestinationQuery,
  );

  const pricingQuoteQuery = useQuery<PricingQuote>({
    queryKey: [
      "pricing-quote",
      pricingCustomerEntityId,
      serviceType,
      transportMode,
      weightKg,
      pricingOriginQuery,
      pricingDestinationQuery,
      senderCountryCode,
      receiverCountryCode,
    ],
    queryFn: () =>
      fetchPricingQuote({
        customerEntityId: pricingCustomerEntityId,
        serviceType: serviceType ?? null,
        transportMode: transportMode?.trim() || null,
        weightKg: typeof weightKg === "number" ? weightKg : null,
        originQuery: pricingOriginQuery,
        destinationQuery: pricingDestinationQuery,
        originCountryCode: senderCountryCode?.trim() || null,
        destinationCountryCode: receiverCountryCode?.trim() || null,
      }),
    enabled: pricingReady,
    retry: false,
    staleTime: 30_000,
  });

  const pricingQuoteOptionsQuery = useQuery<PricingQuoteOptionsResponse>({
    queryKey: [
      "pricing-quote-options",
      pricingCustomerEntityId,
      serviceType,
      weightKg,
      pricingOriginQuery,
      pricingDestinationQuery,
      senderCountryCode,
      receiverCountryCode,
    ],
    queryFn: () =>
      fetchPricingQuoteOptions({
        customerEntityId: pricingCustomerEntityId,
        serviceType: serviceType ?? null,
        weightKg: typeof weightKg === "number" ? weightKg : null,
        originQuery: pricingOriginQuery,
        destinationQuery: pricingDestinationQuery,
        originCountryCode: senderCountryCode?.trim() || null,
        destinationCountryCode: receiverCountryCode?.trim() || null,
      }),
    enabled: pricingReady,
    retry: false,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!open || !pricingReady) return;
    const availableModes = pricingQuoteOptionsQuery.data?.availableModes ?? [];
    if (!availableModes.length) return;
    const forcedMode =
      availableModes.length === 1
        ? availableModes[0]
        : pricingQuoteOptionsQuery.data?.recommendedTransportMode ?? availableModes[0];
    const currentMode = (form.getValues("shipment.transportMode") ?? "ROAD")
      .trim()
      .toUpperCase();
    if (currentMode === forcedMode && availableModes.includes(currentMode)) return;
    if (availableModes.length > 1 && availableModes.includes(currentMode)) return;

    form.setValue("shipment.transportMode", forcedMode as never, {
      shouldDirty: false,
      shouldValidate: true,
    });
  }, [
    form,
    open,
    pricingReady,
    pricingQuoteOptionsQuery.data?.availableModes,
    pricingQuoteOptionsQuery.data?.recommendedTransportMode,
  ]);

  useEffect(() => {
    if (!isManager || !presetCustomerEntityId) return;
    form.setValue("customerEntityId", presetCustomerEntityId, {
      shouldDirty: false,
      shouldValidate: false,
    });
  }, [form, isManager, presetCustomerEntityId]);

  useEffect(() => {
    if (!open) return;

    const quote = pricingQuoteQuery.data;
    const serviceChargeDirty = form.getFieldState("payment.serviceCharge").isDirty;
    const amountDirty = form.getFieldState("amount").isDirty;

    if (!pricingReady || !quote?.quoteAvailable) {
      if (!serviceChargeDirty) {
        form.setValue("payment.serviceCharge", undefined, {
          shouldDirty: false,
          shouldValidate: true,
        });
      }
      if (!amountDirty) {
        form.setValue("amount", undefined, {
          shouldDirty: false,
          shouldValidate: true,
        });
      }
      return;
    }

    if (!serviceChargeDirty) {
      form.setValue("payment.serviceCharge", quote.serviceCharge ?? undefined, {
        shouldDirty: false,
        shouldValidate: true,
      });
    }
    if (!amountDirty) {
      form.setValue("amount", quote.serviceCharge ?? undefined, {
        shouldDirty: false,
        shouldValidate: true,
      });
    }
  }, [form, open, pricingQuoteQuery.data, pricingReady]);

  const paymentsEnabled = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "true";
  const paymentEnvironment: PaymentEnvironment =
    process.env.NEXT_PUBLIC_PAYMENT_ENV === "PRODUCTION" ? "PRODUCTION" : "TEST";

  const paymentType = useWatch({
    control: form.control,
    name: "payment.paymentType",
  });

  const paymentPolicyQuery = useQuery({
    queryKey: ["company-payment-policy", user?.companyId],
    queryFn: () => getCompanyPaymentPolicy({ companyId: user?.companyId ?? undefined }),
    enabled: open && Boolean(user?.companyId),
  });

  const availableProvidersQuery = useQuery({
    queryKey: ["available-payment-providers", user?.companyId, paymentEnvironment],
    queryFn: () =>
      listAvailablePaymentProviders({
        companyId: user?.companyId ?? undefined,
        environment: paymentEnvironment,
      }),
    enabled: open && Boolean(user?.companyId),
  });

  const effectivePaymentsEnabled =
    paymentPolicyQuery.data?.effectiveOnlinePaymentsEnabled ?? paymentsEnabled;

  const mutation = useMutation<
    CreateOrderResponse,
    unknown,
    CreateOrderPayload,
    CreateOrderMutationContext
  >({
    mutationFn: async (values: CreateOrderPayload) => {
      const onlinePaymentType =
        values.payment?.paymentType === "CARD" ||
        values.payment?.paymentType === "TRANSFER";

      const normalized: CreateOrderPayload = {
        ...values,
        shipment: {
          ...values.shipment,
          pieceTotal: values.shipment?.parcels?.length ?? 1,
        },
      };

      if (!isManager) {
        normalized.customerEntityId = user?.customerEntityId ?? undefined;
      }

      if (onlinePaymentType && effectivePaymentsEnabled) {
        if (!paymentAttemptKeyRef.current) {
          paymentAttemptKeyRef.current =
            globalThis.crypto?.randomUUID?.() ??
            `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        }

        const policy = paymentPolicyQuery.data;
        const availableProviders = availableProvidersQuery.data ?? [];
        const fallbackProvider =
          normalized.payment?.provider ??
          policy?.defaultProvider ??
          (availableProviders.length === 1 ? availableProviders[0].provider : null);

        normalized.payment = {
          ...(normalized.payment ?? {}),
          provider: fallbackProvider,
          idempotencyKey: paymentAttemptKeyRef.current,
        };
      } else {
        paymentAttemptKeyRef.current = null;
        normalized.payment = {
          ...(normalized.payment ?? {}),
          provider: null,
          idempotencyKey: null,
        };
      }

      return createOrder(normalized) as Promise<CreateOrderResponse>;
    },
    onMutate: async (variables) => {
      const onlinePaymentType =
        variables.payment?.paymentType === "CARD" ||
        variables.payment?.paymentType === "TRANSFER";
      if (effectivePaymentsEnabled && onlinePaymentType) return {};

      const optimisticOrder = buildOptimisticOrder(
        variables,
        user,
        isManager,
        presetCustomerEntityId,
      );

      await qc.cancelQueries({ queryKey: ["orders"] });
      qc.setQueriesData<OrdersCache>({ queryKey: ["orders"] }, (cache) =>
        prependOrderToCache(cache, optimisticOrder),
      );

      setOpen(false);
      setTab("customer");
      toast.loading(t("createOrder.creating"), { id: optimisticOrder.id });

      return { optimisticOrderId: optimisticOrder.id };
    },
    onSuccess: (data, variables, context) => {
      const affectedCustomerEntityId =
        (isManager
          ? variables.customerEntityId ?? presetCustomerEntityId
          : user?.customerEntityId) ?? null;

      if (context?.optimisticOrderId) {
        qc.setQueriesData<OrdersCache>({ queryKey: ["orders"] }, (cache) =>
          replaceOrderInCache(cache, context.optimisticOrderId!, data?.order),
        );
        toast.dismiss(context.optimisticOrderId);
      }

      void Promise.all([
        qc.invalidateQueries({ queryKey: ["orders"] }),
        qc.invalidateQueries({ queryKey: ["orders", "manager-dashboard"] }),
        qc.invalidateQueries({ queryKey: ["manager-overview"] }),
        qc.invalidateQueries({ queryKey: ["manager-analytics-v2-summary"] }),
        qc.invalidateQueries({ queryKey: ["manager-analytics-v2-trend"] }),
        qc.invalidateQueries({ queryKey: ["manager-analytics-v2-warnings"] }),
        qc.invalidateQueries({ queryKey: ["manager-analytics-v2-finance-queue"] }),
        qc.invalidateQueries({ queryKey: ["customers"] }),
        affectedCustomerEntityId
          ? qc.invalidateQueries({
              queryKey: ["customer", affectedCustomerEntityId],
            })
          : Promise.resolve(),
      ]);
      toast.success(t("createOrder.createdSuccess"));
      if (typeof data?.warning === "string" && data.warning.trim()) {
        toast.warning(data.warning);
      }
      if (!context?.optimisticOrderId) {
        setOpen(false);
        setTab("customer");
      }
      setTab("customer");
      form.reset();
      paymentAttemptKeyRef.current = null;

      if (data?.paymentUrl) window.location.href = data.paymentUrl;
    },
    onError: (error: unknown, _variables, context) => {
      if (context?.optimisticOrderId) {
        qc.setQueriesData<OrdersCache>({ queryKey: ["orders"] }, (cache) =>
          replaceOrderInCache(cache, context.optimisticOrderId!, null),
        );
        toast.dismiss(context.optimisticOrderId);
        setOpen(true);
      }

      const message = extractApiErrorMessage(error);
      const friendlyMessage = resolveFriendlyCreateOrderError(message, t);
      if (friendlyMessage) {
        setTab("payment");
        toast.error(friendlyMessage);
        return;
      }

      toast.error(message || t("createOrder.createdFailed"));
    },
  });

  async function validateStep() {
    if (tab === "customer") {
      const ok = await form.trigger([
        "receiver.name",
        "receiver.phone",
        "addresses.pickupAddress",
        "addresses.dropoffAddress",
      ]);

      if (!ok) {
        toast.error(t("createOrder.requiredBeforeContinue"));
        return false;
      }
    }

    return true;
  }

  async function next() {
    if (!(await validateStep())) return;

    if (tab === "customer") return setTab("shipment");
    if (tab === "shipment") return setTab("payment");
    if (tab === "payment") return setTab("review");
  }

  function back() {
    if (tab === "review") return setTab("payment");
    if (tab === "payment") return setTab("shipment");
    if (tab === "shipment") return setTab("customer");
  }

  const canSubmit = !mutation.isPending;
  const activeTabIndex = TAB_STEPS.findIndex((step) => step.key === tab);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={cn("rounded-2xl shadow-sm", triggerClassName)}>
          <PackagePlus className="mr-2 h-4 w-4" />
          {triggerLabel === "New Shipment" ? t("createOrder.trigger") : triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent
        className="
          flex h-[92vh] w-[96vw] max-w-225! flex-col overflow-hidden p-0
        "
      >
        <DialogHeader className="shrink-0 px-6 pb-2 pt-6">
          <DialogTitle className="text-xl">{t("createOrder.dialogTitle")}</DialogTitle>
          <DialogDescription className="text-sm">
            {t("createOrder.dialogSubtitle")}
          </DialogDescription>
        </DialogHeader>

        <Separator className="shrink-0" />

        <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)} className="flex min-h-0 flex-1 flex-col w-full">
          <div className="shrink-0 px-6 pt-4">
            <div className="rounded-2xl border border-border/70 bg-muted/40 p-1.5">
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {TAB_STEPS.map((step, index) => {
                  const isActive = tab === step.key;
                  const isDone = index < activeTabIndex;

                  return (
                    <button
                      key={step.key}
                      type="button"
                      onClick={() => setTab(step.key)}
                      className={cn(
                        "relative inline-flex h-10 items-center justify-center rounded-xl border text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                        isActive
                          ? "border-border bg-background text-foreground shadow-sm"
                          : isDone
                            ? "border-transparent bg-background/70 text-foreground/85 hover:bg-background"
                            : "border-transparent text-muted-foreground hover:bg-background/70 hover:text-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute left-3 top-1/2 size-1.5 -translate-y-1/2 rounded-full",
                          isActive
                            ? "bg-foreground"
                            : isDone
                              ? "bg-emerald-500"
                              : "bg-muted-foreground/40",
                        )}
                      />
                      {t(step.labelKey)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <form
                id={FORM_ID}
                className="space-y-6 px-6 py-6"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && tab !== "review") {
                    event.preventDefault();
                  }
                }}
                onSubmit={form.handleSubmit(
                  (values) => mutation.mutate(values),
                  (errors) => {
                    console.error("RHF errors:", errors);
                    console.log("FORM VALUES:", form.getValues());
                    toast.error(t("createOrder.validationFailed"));
                  },
                )}
              >
                <TabsContent value="customer" className="mt-0 data-[state=inactive]:hidden" forceMount>
                  <CustomerStep
                    form={form}
                    mode={mode}
                    canSaveAddresses={canSaveAddresses}
                    lockCustomerEntitySelection={lockCustomerEntitySelection}
                    lockedCustomerEntityLabel={presetCustomerEntityLabel}
                  />
                </TabsContent>

                <TabsContent value="shipment" className="mt-0 data-[state=inactive]:hidden" forceMount>
                  <ShipmentStep
                    form={form}
                    parcels={parcels}
                    pricingQuote={pricingQuoteQuery.data}
                    pricingLoading={pricingQuoteQuery.isFetching}
                    availableTransportModes={
                      pricingQuoteOptionsQuery.data?.availableModes ?? []
                    }
                  />
                </TabsContent>

                <TabsContent value="payment" className="mt-0 data-[state=inactive]:hidden" forceMount>
                  <PaymentStep
                    form={form}
                    paymentsEnabled={paymentsEnabled}
                    pricingQuote={pricingQuoteQuery.data}
                    pricingLoading={pricingQuoteQuery.isFetching}
                    paymentPolicy={paymentPolicyQuery.data}
                    availableProviders={availableProvidersQuery.data ?? []}
                  />
                </TabsContent>

                <TabsContent value="review" className="mt-0 space-y-4 data-[state=inactive]:hidden" forceMount>
                  <ReviewStep
                    form={form}
                    paymentsEnabled={effectivePaymentsEnabled}
                    pricingQuote={pricingQuoteQuery.data}
                  />
                </TabsContent>

                <div className="h-24" />
              </form>
            </ScrollArea>
          </div>

          <div className="z-50 shrink-0 border-t bg-background/95 px-6 py-4 backdrop-blur">
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={back}
                disabled={tab === "customer"}
                className="rounded-2xl"
              >
                {t("createOrder.back")}
              </Button>

              {tab !== "review" ? (
                <Button
                  key="create-order-next"
                  type="button"
                  onClick={next}
                  className="rounded-2xl"
                >
                  {t("createOrder.continue")}
                </Button>
              ) : (
                <Button
                  key="create-order-submit"
                  type="submit"
                  form={FORM_ID}
                  disabled={!canSubmit}
                  className="rounded-2xl"
                >
                  {mutation.isPending
                    ? t("createOrder.creating")
                    : effectivePaymentsEnabled &&
                        (paymentType === "CARD" || paymentType === "TRANSFER")
                      ? t("createOrder.createAndPay")
                      : t("createOrder.createShipment")}
                </Button>
              )}
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
