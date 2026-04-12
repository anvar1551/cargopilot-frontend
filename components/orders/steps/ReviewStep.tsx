"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  MapPin,
  Package,
  StickyNote,
  User,
} from "lucide-react";

import type { CreateOrderFormApi } from "@/components/orders/create-order-form.types";

import { useI18n } from "@/components/i18n/I18nProvider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function safeNumber(value: unknown) {
  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}

function prettyMoney(amount: number | null, currency?: string | null) {
  if (amount == null) return "-";
  const currentCurrency = currency ?? "EUR";
  return `${amount.toFixed(2)} ${currentCurrency}`;
}

export function ReviewStep({
  form,
  paymentsEnabled,
}: {
  form: CreateOrderFormApi;
  paymentsEnabled?: boolean;
}) {
  const { t } = useI18n();
  const pickup = form.watch("addresses.pickupAddress");
  const dropoff = form.watch("addresses.dropoffAddress");
  const destinationCity = form.watch("addresses.destinationCity");

  const senderName = form.watch("sender.name");
  const senderPhone = form.watch("sender.phone");
  const receiverName = form.watch("receiver.name");
  const receiverPhone = form.watch("receiver.phone");

  const parcels = form.watch("shipment.parcels") ?? [];
  const pieceTotal = parcels.length;

  const serviceType = form.watch("shipment.serviceType");
  const weightKg = safeNumber(form.watch("shipment.weightKg"));
  const itemValue = safeNumber(form.watch("shipment.itemValue"));

  const codAmount = safeNumber(form.watch("shipment.codAmount"));
  const currency = form.watch("shipment.currency") ?? "EUR";

  const stripeAmount = safeNumber(form.watch("amount"));

  const note = form.watch("note");
  const schedulePickup = form.watch("schedule.plannedPickupAt");
  const scheduleDelivery = form.watch("schedule.plannedDeliveryAt");

  const missing: string[] = [];
  if (!pickup || pickup.trim().length < 3) missing.push(t("createOrder.review.pickup"));
  if (!dropoff || dropoff.trim().length < 3) missing.push(t("createOrder.review.dropoff"));
  if (!pieceTotal || pieceTotal < 1) missing.push(t("createOrder.review.parcels"));

  const paymentStatus = stripeAmount != null ? "PAY_NOW" : "MANUAL";
  const hasBlockingErrors = missing.length > 0;

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border bg-background/60 p-5 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {hasBlockingErrors ? (
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />
            )}

            <div>
              <p className="font-semibold">
                {hasBlockingErrors ? t("createOrder.review.missingTitle") : t("createOrder.review.readyTitle")}
              </p>
              <p className="text-sm text-muted-foreground">
                {hasBlockingErrors ? t("createOrder.review.missingSubtitle") : t("createOrder.review.readySubtitle")}
              </p>

              {hasBlockingErrors ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {missing.map((item) => (
                    <Badge key={item} variant="secondary" className="rounded-full">
                      {item}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs text-muted-foreground">{t("createOrder.review.paymentMode")}</p>
            <Badge className="rounded-full" variant={paymentStatus === "PAY_NOW" ? "default" : "secondary"}>
              {paymentStatus === "PAY_NOW" ? t("createOrder.review.payNow") : t("createOrder.review.manual")}
            </Badge>
            <p className="mt-1 text-xs text-muted-foreground">
              PAYMENTS_ENABLED={paymentsEnabled ? "true" : "false"}
            </p>
          </div>
        </div>
      </Card>

      <Card className="rounded-2xl border bg-linear-to-b from-primary/10 to-background p-5">
        <div className="flex items-center gap-2 font-semibold">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          {t("createOrder.review.route")}
        </div>
        <Separator className="my-4" />

        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-background/60 p-4">
            <p className="text-muted-foreground">{t("createOrder.review.pickup")}</p>
            <p className="font-medium break-words">{pickup || "-"}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/60 p-4">
            <p className="text-muted-foreground">{t("createOrder.review.dropoff")}</p>
            <p className="font-medium break-words">{dropoff || "-"}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/60 p-4">
            <p className="text-muted-foreground">{t("createOrder.review.destinationCity")}</p>
            <p className="font-medium break-words">{destinationCity || "-"}</p>
          </div>
        </div>
      </Card>

      <Card className="rounded-2xl border bg-background/60 p-5 backdrop-blur">
        <div className="flex items-center gap-2 font-semibold">
          <User className="h-4 w-4 text-muted-foreground" />
          {t("createOrder.review.people")}
        </div>
        <Separator className="my-4" />

        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div className="rounded-xl border border-border/60 bg-background/60 p-4">
            <p className="text-muted-foreground">{t("createOrder.review.sender")}</p>
            <p className="font-medium">{senderName || "-"}</p>
            <p className="text-xs text-muted-foreground">{senderPhone || "-"}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/60 p-4">
            <p className="text-muted-foreground">{t("createOrder.review.receiver")}</p>
            <p className="font-medium">{receiverName || "-"}</p>
            <p className="text-xs text-muted-foreground">{receiverPhone || "-"}</p>
          </div>
        </div>
      </Card>

      <Card className="rounded-2xl border bg-background/60 p-5 backdrop-blur">
        <div className="flex items-center gap-2 font-semibold">
          <Package className="h-4 w-4 text-muted-foreground" />
          {t("createOrder.review.shipment")}
        </div>
        <Separator className="my-4" />

        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-4">
          <div className="rounded-xl border border-border/60 bg-background/60 p-4">
            <p className="text-muted-foreground">{t("createOrder.review.service")}</p>
            <p className="font-medium">{serviceType || "-"}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/60 p-4">
            <p className="text-muted-foreground">{t("createOrder.review.pieces")}</p>
            <p className="font-medium">{pieceTotal}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/60 p-4">
            <p className="text-muted-foreground">{t("createOrder.review.totalWeight")}</p>
            <p className="font-medium">{weightKg != null ? `${weightKg} kg` : "-"}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/60 p-4">
            <p className="text-muted-foreground">{t("createOrder.review.itemValue")}</p>
            <p className="font-medium">{prettyMoney(itemValue, currency)}</p>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="rounded-xl border border-border/60 bg-background/60 p-4">
          <p className="text-sm text-muted-foreground">{t("createOrder.review.parcels")}</p>
          <div className="mt-3 space-y-2">
            {parcels.length ? (
              parcels.map((parcel, index) => {
                const weight = safeNumber(parcel?.weightKg);
                const length = safeNumber(parcel?.lengthCm);
                const width = safeNumber(parcel?.widthCm);
                const height = safeNumber(parcel?.heightCm);

                return (
                  <div key={index} className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2 text-sm">
                    <span className="font-medium">{t("createOrder.review.piece", { index: index + 1 })}</span>
                    <span className="text-muted-foreground">
                      {weight != null ? `${weight}kg` : "-"}
                      {" - "}
                      {length != null && width != null && height != null
                        ? `${length}x${width}x${height} cm`
                        : t("createOrder.review.dimsMissing")}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">{t("createOrder.review.noParcels")}</p>
            )}
          </div>
        </div>
      </Card>

      <Card className="rounded-2xl border bg-linear-to-b from-violet-500/10 to-background p-5">
        <div className="flex items-center gap-2 font-semibold">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          {t("createOrder.review.payment")}
        </div>
        <Separator className="my-4" />

        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-background/60 p-4">
            <p className="text-muted-foreground">{t("createOrder.review.stripeAmount")}</p>
            <p className="font-medium">{stripeAmount != null ? prettyMoney(stripeAmount, "EUR") : "-"}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/60 p-4">
            <p className="text-muted-foreground">{t("createOrder.review.cod")}</p>
            <p className="font-medium">{codAmount != null ? prettyMoney(codAmount, currency) : t("createOrder.review.no")}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/60 p-4">
            <p className="text-muted-foreground">{t("createOrder.review.currency")}</p>
            <p className="font-medium">{currency || "-"}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border bg-background/60 p-5 backdrop-blur">
          <div className="flex items-center gap-2 font-semibold">
            <Clock className="h-4 w-4 text-muted-foreground" />
            {t("createOrder.review.schedule")}
          </div>
          <Separator className="my-4" />
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border border-border/60 bg-background/60 p-4">
              <p className="text-muted-foreground">{t("createOrder.review.pickup")}</p>
              <p className="font-medium break-words">{schedulePickup || "-"}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 p-4">
              <p className="text-muted-foreground">{t("createOrder.review.delivery")}</p>
              <p className="font-medium break-words">{scheduleDelivery || "-"}</p>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border bg-background/60 p-5 backdrop-blur">
          <div className="flex items-center gap-2 font-semibold">
            <StickyNote className="h-4 w-4 text-muted-foreground" />
            {t("createOrder.review.note")}
          </div>
          <Separator className="my-4" />
          <div className="rounded-xl border border-border/60 bg-background/60 p-4 text-sm">
            <p className="text-muted-foreground">{t("createOrder.review.instructions")}</p>
            <p className="font-medium break-words">{note || "-"}</p>
          </div>
        </Card>
      </div>

      <input type="hidden" value={hasBlockingErrors ? "1" : "0"} readOnly />
    </div>
  );
}
