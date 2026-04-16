"use client";
import { CreditCard, Package, Shield, Truck, Weight } from "lucide-react";

import type {
  CreateOrderFormApi,
  CreateOrderParcelsFieldArray,
} from "@/components/orders/create-order-form.types";
import type { PricingQuote } from "@/lib/pricing";

import { useI18n } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

import { IconField } from "../IconField";
import {
  DEFAULT_SERVICE_TYPE,
  SERVICE_TYPES,
} from "@/lib/orders/service-types";
const CURRENCIES = ["EUR", "USD", "UZS"] as const;
const PAID_STATUS = ["NOT_PAID", "PAID", "PARTIAL"] as const;

export function ShipmentStep({
  form,
  parcels,
  pricingQuote,
  pricingLoading,
}: {
  form: CreateOrderFormApi;
  parcels: CreateOrderParcelsFieldArray;
  pricingQuote?: PricingQuote;
  pricingLoading?: boolean;
}) {
  const { t } = useI18n();
  const codEnabled = form.watch("shipment.codEnabled") ?? false;

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border bg-background/60 p-5 backdrop-blur">
        <h3 className="flex items-center gap-2 font-semibold">
          <Package className="h-4 w-4 text-muted-foreground" />
          {t("createOrder.shipment.title")}
        </h3>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label>{t("createOrder.shipment.serviceType")}</Label>
            <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-3 py-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/25">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <Select
                  value={
                    (form.watch("shipment.serviceType") as string | undefined) ??
                    DEFAULT_SERVICE_TYPE
                  }
                  onValueChange={(value) =>
                    form.setValue("shipment.serviceType", value as never, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                >
                  <SelectTrigger className="rounded-2xl border-0 bg-transparent focus:ring-0">
                    <SelectValue placeholder={t("createOrder.shipment.selectService")} />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map((serviceType) => (
                      <SelectItem key={serviceType} value={serviceType}>
                        {t(`createOrder.shipment.enum.serviceType.${serviceType}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("createOrder.shipment.totalWeight")}</Label>
            <IconField icon={<Weight className="h-4 w-4" />}>
              <Input
                type="number"
                step="0.01"
                placeholder={t("createOrder.shipment.totalWeightPlaceholder")}
                className="rounded-2xl border-0 bg-transparent pl-3 focus-visible:ring-0 focus-visible:ring-offset-0"
                {...form.register("shipment.weightKg", {
                  setValueAs: (value) => (value === "" || value === null ? undefined : Number(value)),
                })}
              />
            </IconField>
          </div>

          <div className="space-y-2">
            <Label>{t("createOrder.shipment.itemValue")}</Label>
            <IconField icon={<Shield className="h-4 w-4" />}>
              <Input
                type="number"
                step="0.01"
                placeholder={t("createOrder.shipment.itemValuePlaceholder")}
                className="rounded-2xl border-0 bg-transparent pl-3 focus-visible:ring-0 focus-visible:ring-offset-0"
                {...form.register("shipment.itemValue", {
                  setValueAs: (value) => (value === "" || value === null ? undefined : Number(value)),
                })}
              />
            </IconField>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-border/60 bg-background/60 p-4">
            <p className="text-xs text-muted-foreground">
              {t("createOrder.payment.quoteStatus")}
            </p>
            <p className="mt-1 font-medium">
              {pricingLoading
                ? t("createOrder.payment.quoteLoading")
                : pricingQuote?.quoteAvailable
                  ? t("createOrder.payment.quoteReady")
                  : t(
                      `createOrder.payment.quoteReason.${pricingQuote?.reason ?? "missing_required_fields"}`,
                    )}
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/60 p-4">
            <p className="text-xs text-muted-foreground">
              {t("createOrder.payment.quoteZone")}
            </p>
            <p className="mt-1 font-medium">{pricingQuote?.zone ?? "-"}</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/60 p-4">
            <p className="text-xs text-muted-foreground">
              {t("createOrder.payment.quotePlan")}
            </p>
            <p className="mt-1 font-medium">{pricingQuote?.tariffPlan?.name ?? "-"}</p>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/60 p-4">
            <p className="text-xs text-muted-foreground">
              {t("createOrder.payment.quoteAmount")}
            </p>
            <p className="mt-1 font-medium">
              {pricingQuote?.quoteAvailable && pricingQuote.serviceCharge != null
                ? `${pricingQuote.serviceCharge.toFixed(2)} ${pricingQuote.currency ?? ""}`.trim()
                : "-"}
            </p>
          </div>
        </div>

        <Separator className="my-5" />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 p-4">
            <div>
              <p className="font-medium">{t("createOrder.shipment.fragile")}</p>
              <p className="text-xs text-muted-foreground">{t("createOrder.shipment.fragileHint")}</p>
            </div>
            <Switch
              checked={!!form.watch("shipment.fragile")}
              onCheckedChange={(value) =>
                form.setValue("shipment.fragile", value, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 p-4">
            <div>
              <p className="font-medium">{t("createOrder.shipment.dangerousGoods")}</p>
              <p className="text-xs text-muted-foreground">{t("createOrder.shipment.dangerousGoodsHint")}</p>
            </div>
            <Switch
              checked={!!form.watch("shipment.dangerousGoods")}
              onCheckedChange={(value) =>
                form.setValue("shipment.dangerousGoods", value, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 p-4">
            <div>
              <p className="font-medium">{t("createOrder.shipment.insurance")}</p>
              <p className="text-xs text-muted-foreground">{t("createOrder.shipment.insuranceHint")}</p>
            </div>
            <Switch
              checked={!!form.watch("shipment.shipmentInsurance")}
              onCheckedChange={(value) =>
                form.setValue("shipment.shipmentInsurance", value, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
            />
          </div>
        </div>
      </Card>

      <Card className="rounded-2xl border bg-background/60 p-5 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-semibold">
              <Package className="h-4 w-4 text-muted-foreground" />
              {t("createOrder.shipment.parcelsTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">{t("createOrder.shipment.parcelsSubtitle")}</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              parcels.append({
                weightKg: null,
                lengthCm: null,
                widthCm: null,
                heightCm: null,
              })
            }
          >
            {t("createOrder.shipment.addPiece")}
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          {parcels.fields.map((field, index) => (
            <div
              key={field.id}
              className="rounded-2xl border border-border/60 bg-background/60 p-4 transition-all hover:shadow-[0_18px_55px_-40px_rgba(0,0,0,0.35)]"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium">{t("createOrder.shipment.piece", { index: index + 1 })}</p>
                {parcels.fields.length > 1 ? (
                  <Button type="button" variant="ghost" className="text-destructive" onClick={() => parcels.remove(index)}>
                    {t("createOrder.shipment.remove")}
                  </Button>
                ) : null}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                <div className="space-y-1">
                  <Label className="text-xs">{t("createOrder.shipment.weight")}</Label>
                  <IconField icon={<Weight className="h-4 w-4" />}>
                    <Input
                      type="number"
                      step="0.01"
                      className="rounded-2xl border-0 bg-transparent pl-3 focus-visible:ring-0 focus-visible:ring-offset-0"
                      {...form.register(`shipment.parcels.${index}.weightKg` as const, {
                        setValueAs: (value) => (value === "" || value === null ? undefined : Number(value)),
                      })}
                    />
                  </IconField>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">{t("createOrder.shipment.length")}</Label>
                  <IconField icon={<Package className="h-4 w-4" />}>
                    <Input
                      type="number"
                      step="1"
                      className="rounded-2xl border-0 bg-transparent pl-3 focus-visible:ring-0 focus-visible:ring-offset-0"
                      {...form.register(`shipment.parcels.${index}.lengthCm` as const, {
                        setValueAs: (value) => (value === "" || value === null ? undefined : Number(value)),
                      })}
                    />
                  </IconField>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">{t("createOrder.shipment.width")}</Label>
                  <IconField icon={<Package className="h-4 w-4" />}>
                    <Input
                      type="number"
                      step="1"
                      className="rounded-2xl border-0 bg-transparent pl-3 focus-visible:ring-0 focus-visible:ring-offset-0"
                      {...form.register(`shipment.parcels.${index}.widthCm` as const, {
                        setValueAs: (value) => (value === "" || value === null ? undefined : Number(value)),
                      })}
                    />
                  </IconField>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">{t("createOrder.shipment.height")}</Label>
                  <IconField icon={<Package className="h-4 w-4" />}>
                    <Input
                      type="number"
                      step="1"
                      className="rounded-2xl border-0 bg-transparent pl-3 focus-visible:ring-0 focus-visible:ring-offset-0"
                      {...form.register(`shipment.parcels.${index}.heightCm` as const, {
                        setValueAs: (value) => (value === "" || value === null ? undefined : Number(value)),
                      })}
                    />
                  </IconField>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="rounded-2xl border bg-gradient-to-b from-amber-500/10 to-background p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-semibold">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              {t("createOrder.shipment.codTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">{t("createOrder.shipment.codSubtitle")}</p>
          </div>

          <Switch
            checked={codEnabled}
            onCheckedChange={(enabled) => {
              form.setValue("shipment.codEnabled", enabled, {
                shouldValidate: true,
                shouldDirty: true,
              });

              if (!enabled) {
                form.setValue("shipment.codAmount", null, {
                  shouldValidate: true,
                  shouldDirty: true,
                });
                form.setValue("payment.codPaidStatus", null, {
                  shouldValidate: true,
                  shouldDirty: true,
                });
              } else {
                const current = form.getValues("shipment.codAmount");
                if (current == null) {
                  form.setValue("shipment.codAmount", 1, {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                }
              }
            }}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label>{t("createOrder.shipment.codAmount")}</Label>
            <IconField icon={<CreditCard className="h-4 w-4" />}>
              <Input
                type="number"
                step="0.01"
                placeholder={t("createOrder.shipment.amountPlaceholder")}
                disabled={!codEnabled}
                className="rounded-2xl border-0 bg-transparent pl-3 focus-visible:ring-0 focus-visible:ring-offset-0"
                {...form.register("shipment.codAmount", {
                  setValueAs: (value) => (value === "" || value === null ? undefined : Number(value)),
                })}
              />
            </IconField>
          </div>

          <div className="space-y-2">
            <Label>{t("createOrder.shipment.currency")}</Label>
            <Select
              disabled={!codEnabled}
              value={(form.watch("shipment.currency") as string | undefined) ?? "EUR"}
              onValueChange={(value) =>
                form.setValue("shipment.currency", value as never, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger className="rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((currency) => (
                  <SelectItem key={currency} value={currency}>
                    {currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("createOrder.shipment.codPaidStatus")}</Label>
            <Select
              disabled={!codEnabled}
              value={(form.watch("payment.codPaidStatus") as string | undefined) ?? undefined}
              onValueChange={(value) =>
                form.setValue("payment.codPaidStatus", value as never, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger className="rounded-2xl">
                <SelectValue placeholder={t("createOrder.shipment.select")} />
              </SelectTrigger>
              <SelectContent>
                {PAID_STATUS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {t(`createOrder.shipment.enum.paidStatus.${status}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>
    </div>
  );
}
