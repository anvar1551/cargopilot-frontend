"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { createOrder } from "@/lib/orders";
import { getUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

import { useI18n } from "@/components/i18n/I18nProvider";
import {
  Dialog,
  DialogContent,
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
};

export default function CreateOrderDialog({
  mode = "customer",
  presetCustomerEntityId = null,
  presetCustomerEntityLabel = null,
  lockCustomerEntitySelection = false,
  triggerLabel = "New Shipment",
}: CreateOrderDialogProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>("customer");

  const qc = useQueryClient();
  const user = useMemo(() => getUser(), []);
  const isManager = mode === "manager";

  const form = useForm<CreateOrderFormValues, unknown, CreateOrderPayload>({
    resolver: zodResolver(createOrderPayloadSchema),
    mode: "onSubmit",
    shouldFocusError: true,
    shouldUnregister: false,
    defaultValues: {
      customerEntityId: isManager
        ? (presetCustomerEntityId ?? undefined)
        : (user?.customerEntityId ?? undefined),
      sender: { name: null, phone: null },
      receiver: { name: null, phone: null },
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
        weightKg: undefined,
        codEnabled: false,
        codAmount: undefined,
        currency: "EUR",
        parcels: [{ weightKg: null, lengthCm: null, widthCm: null, heightCm: null }],
        pieceTotal: 1,
        fragile: false,
        dangerousGoods: false,
        shipmentInsurance: false,
        itemValue: undefined,
      },
      payment: {
        paymentType: null,
        deliveryChargePaidBy: null,
        codPaidStatus: null,
        serviceCharge: undefined,
        serviceChargePaidStatus: null,
        ifRecipientNotAvailable: null,
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

  const canSaveAddresses = isManager
    ? Boolean(selectedCustomerEntityId)
    : Boolean(user?.customerEntityId);

  useEffect(() => {
    if (!isManager || !presetCustomerEntityId) return;
    form.setValue("customerEntityId", presetCustomerEntityId, {
      shouldDirty: false,
      shouldValidate: false,
    });
  }, [form, isManager, presetCustomerEntityId]);

  const mutation = useMutation({
    mutationFn: async (values: CreateOrderPayload) => {
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

      return createOrder(normalized);
    },
    onSuccess: async (data, variables) => {
      const affectedCustomerEntityId =
        (isManager
          ? variables.customerEntityId ?? presetCustomerEntityId
          : user?.customerEntityId) ?? null;

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["orders"] }),
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
      setOpen(false);
      setTab("customer");
      form.reset();

      if (data?.paymentUrl) window.location.href = data.paymentUrl;
    },
    onError: (error: unknown) => {
      const message =
        typeof error === "object" && error !== null
          ? (
              error as {
                response?: { data?: { error?: string } };
                message?: string;
              }
            ).response?.data?.error ?? (error as { message?: string }).message
          : undefined;

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

  const paymentsEnabled = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "true";
  const canSubmit = !mutation.isPending;
  const activeTabIndex = TAB_STEPS.findIndex((step) => step.key === tab);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-2xl shadow-sm">
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
          <p className="text-sm text-muted-foreground">{t("createOrder.dialogSubtitle")}</p>
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
                  <ShipmentStep form={form} parcels={parcels} />
                </TabsContent>

                <TabsContent value="payment" className="mt-0 data-[state=inactive]:hidden" forceMount>
                  <PaymentStep form={form} paymentsEnabled={paymentsEnabled} />
                </TabsContent>

                <TabsContent value="review" className="mt-0 space-y-4 data-[state=inactive]:hidden" forceMount>
                  <ReviewStep form={form} paymentsEnabled={paymentsEnabled} />
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
                <Button type="button" onClick={next} className="rounded-2xl">
                  {t("createOrder.continue")}
                </Button>
              ) : (
                <Button type="submit" form={FORM_ID} disabled={!canSubmit} className="rounded-2xl">
                  {mutation.isPending
                    ? t("createOrder.creating")
                    : paymentsEnabled
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
