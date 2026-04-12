"use client";

import * as React from "react";
import {
  CalendarClock,
  CalendarDays,
  Clock3,
  CreditCard,
  Hash,
  Layers,
  TicketPercent,
  X,
} from "lucide-react";

import type { CreateOrderFormApi } from "@/components/orders/create-order-form.types";
import type { CreateOrderFormValues } from "@/lib/validators/order";

import { useI18n } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

import { IconField } from "../IconField";

const PAYMENT_TYPES = ["CASH", "CARD", "COD", "TRANSFER", "OTHER"] as const;
const PAID_BY = ["SENDER", "RECIPIENT", "COMPANY"] as const;
const PAID_STATUS = ["NOT_PAID", "PAID", "PARTIAL"] as const;
const RECIPIENT_UNAVAILABLE = [
  "DO_NOT_DELIVER",
  "LEAVE_AT_DOOR",
  "LEAVE_WITH_CONCIERGE",
  "CALL_SENDER",
  "RESCHEDULE",
  "RETURN_TO_SENDER",
] as const;

type PaymentModel = NonNullable<CreateOrderFormValues["payment"]>;
type PaymentTypeValue = NonNullable<PaymentModel["paymentType"]>;
type PaidByValue = NonNullable<PaymentModel["deliveryChargePaidBy"]>;
type RecipientUnavailableValue = NonNullable<PaymentModel["ifRecipientNotAvailable"]>;
type PaidStatusValue = NonNullable<PaymentModel["serviceChargePaidStatus"]>;

function toLocalDateTimeInput(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function localInputToIso(local: string) {
  if (!local) return null;
  const date = new Date(local);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function DateTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string | null;
  onChange: (next: string | null) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<string>(() => toLocalDateTimeInput(value));

  React.useEffect(() => {
    if (!open) setDraft(toLocalDateTimeInput(value));
  }, [value, open]);

  const formatDateLabel = (iso?: string | null) => {
    if (!iso) return t("createOrder.payment.pickDateTime");
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return t("createOrder.payment.pickDateTime");
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatHeaderDate = (local: string) => {
    if (!local) return t("createOrder.payment.noDateSelected");
    const date = new Date(local);
    if (Number.isNaN(date.getTime())) return t("createOrder.payment.noDateSelected");
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  };

  const formatHeaderTime = (local: string) => {
    if (!local) return "--:--";
    const date = new Date(local);
    if (Number.isNaN(date.getTime())) return "--:--";
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start rounded-2xl border-border/60 bg-background/70 px-3 text-left font-normal"
          >
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{formatDateLabel(value)}</span>
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-[22rem] overflow-hidden rounded-2xl border-border/70 p-0">
          <div className="bg-linear-to-r from-indigo-600 to-blue-600 p-4 text-white">
            <p className="text-xs/4 opacity-80">{t("createOrder.payment.datePickerSchedule")}</p>
            <div className="mt-1 flex items-end justify-between gap-3">
              <p className="text-lg font-semibold">{formatHeaderDate(draft)}</p>
              <p className="text-3xl font-light tracking-tight">{formatHeaderTime(draft)}</p>
            </div>
          </div>

          <div className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                <p className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {t("createOrder.payment.datePickerDate")}
                </p>
                <Input
                  type="date"
                  className="h-8 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                  value={draft ? draft.slice(0, 10) : ""}
                  onChange={(event) => {
                    const datePart = event.target.value;
                    const timePart = draft?.slice(11, 16) || "12:00";
                    if (!datePart) return setDraft("");
                    setDraft(`${datePart}T${timePart}`);
                  }}
                />
              </div>

              <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                <p className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  {t("createOrder.payment.datePickerTime")}
                </p>
                <Input
                  type="time"
                  className="h-8 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                  value={draft ? draft.slice(11, 16) : "12:00"}
                  onChange={(event) => {
                    const timePart = event.target.value || "12:00";
                    const datePart = draft?.slice(0, 10);
                    if (!datePart) return;
                    setDraft(`${datePart}T${timePart}`);
                  }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/60 p-2.5">
              <Input
                type="datetime-local"
                className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl text-muted-foreground"
                onClick={() => {
                  setDraft("");
                  onChange(null);
                  setOpen(false);
                }}
              >
                <X className="h-4 w-4" />
                {t("createOrder.payment.clear")}
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    setDraft(toLocalDateTimeInput(value));
                    setOpen(false);
                  }}
                >
                  {t("createOrder.payment.cancel")}
                </Button>
                <Button
                  type="button"
                  className="rounded-xl"
                  onClick={() => {
                    onChange(localInputToIso(draft));
                    setOpen(false);
                  }}
                >
                  {t("createOrder.payment.apply")}
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function PaymentStep({
  form,
}: {
  form: CreateOrderFormApi;
  paymentsEnabled?: boolean;
}) {
  const { t } = useI18n();
  const paymentType = form.watch("payment.paymentType");
  const deliveryChargePaidBy = form.watch("payment.deliveryChargePaidBy");
  const ifRecipientNotAvailable = form.watch("payment.ifRecipientNotAvailable");
  const serviceChargePaidStatus = form.watch("payment.serviceChargePaidStatus");
  const plannedPickupAt = form.watch("schedule.plannedPickupAt");
  const plannedDeliveryAt = form.watch("schedule.plannedDeliveryAt");
  const promiseDate = form.watch("schedule.promiseDate");

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border bg-linear-to-b from-violet-500/10 to-background p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-semibold">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              {t("createOrder.payment.title")}
            </h3>
            <p className="text-sm text-muted-foreground">{t("createOrder.payment.subtitle")}</p>
          </div>
          <span className="text-xs text-muted-foreground">{t("createOrder.payment.stripeOptional")}</span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label>{t("createOrder.payment.paymentType")}</Label>
            <Select
              value={paymentType ?? undefined}
              onValueChange={(value) =>
                form.setValue("payment.paymentType", value as PaymentTypeValue, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger className="rounded-2xl">
                <SelectValue placeholder={t("createOrder.shipment.select")} />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`createOrder.payment.enum.paymentType.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("createOrder.payment.deliveryPaidBy")}</Label>
            <Select
              value={deliveryChargePaidBy ?? undefined}
              onValueChange={(value) =>
                form.setValue("payment.deliveryChargePaidBy", value as PaidByValue, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger className="rounded-2xl">
                <SelectValue placeholder={t("createOrder.shipment.select")} />
              </SelectTrigger>
              <SelectContent>
                {PAID_BY.map((payer) => (
                  <SelectItem key={payer} value={payer}>
                    {t(`createOrder.payment.enum.paidBy.${payer}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("createOrder.payment.recipientUnavailable")}</Label>
            <Select
              value={ifRecipientNotAvailable ?? undefined}
              onValueChange={(value) =>
                form.setValue("payment.ifRecipientNotAvailable", value as RecipientUnavailableValue, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger className="rounded-2xl">
                <SelectValue placeholder={t("createOrder.shipment.select")} />
              </SelectTrigger>
              <SelectContent>
                {RECIPIENT_UNAVAILABLE.map((rule) => (
                  <SelectItem key={rule} value={rule}>
                    {t(`createOrder.payment.enum.recipientUnavailable.${rule}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator className="my-5" />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label>{t("createOrder.payment.serviceCharge")}</Label>
            <IconField icon={<CreditCard className="h-4 w-4" />}>
              <Input
                type="number"
                step="0.01"
                className="rounded-2xl border-0 bg-transparent pl-3 focus-visible:ring-0 focus-visible:ring-offset-0"
                {...form.register("payment.serviceCharge", {
                  setValueAs: (value) => (value === "" || value === null ? undefined : Number(value)),
                })}
              />
            </IconField>
          </div>

          <div className="space-y-2">
            <Label>{t("createOrder.payment.serviceChargeStatus")}</Label>
            <Select
              value={serviceChargePaidStatus ?? undefined}
              onValueChange={(value) =>
                form.setValue("payment.serviceChargePaidStatus", value as PaidStatusValue, {
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

          <div className="space-y-2">
            <Label>{t("createOrder.payment.stripeAmount")}</Label>
            <IconField icon={<CreditCard className="h-4 w-4" />}>
              <Input
                type="number"
                step="0.01"
                placeholder={t("createOrder.payment.stripePlaceholder")}
                className="rounded-2xl border-0 bg-transparent pl-3 focus-visible:ring-0 focus-visible:ring-offset-0"
                {...form.register("amount", {
                  setValueAs: (value) => (value === "" || value === null ? undefined : Number(value)),
                })}
              />
            </IconField>
            <p className="mt-1 text-xs text-muted-foreground">{t("createOrder.payment.stripeHint")}</p>
          </div>
        </div>
      </Card>

      <Card className="rounded-2xl border bg-background/60 p-5 backdrop-blur">
        <h3 className="flex items-center gap-2 font-semibold">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          {t("createOrder.payment.scheduleTitle")}
        </h3>
        <p className="text-sm text-muted-foreground">{t("createOrder.payment.scheduleSubtitle")}</p>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <DateTimeField
            label={t("createOrder.payment.plannedPickup")}
            value={plannedPickupAt}
            onChange={(next) =>
              form.setValue("schedule.plannedPickupAt", next, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          />

          <DateTimeField
            label={t("createOrder.payment.plannedDelivery")}
            value={plannedDeliveryAt}
            onChange={(next) =>
              form.setValue("schedule.plannedDeliveryAt", next, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          />

          <DateTimeField
            label={t("createOrder.payment.promiseDate")}
            value={promiseDate}
            onChange={(next) =>
              form.setValue("schedule.promiseDate", next, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          />
        </div>
      </Card>

      <Card className="rounded-2xl border bg-background/60 p-5 backdrop-blur">
        <h3 className="flex items-center gap-2 font-semibold">
          <TicketPercent className="h-4 w-4 text-muted-foreground" />
          {t("createOrder.payment.referenceTitle")}
        </h3>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("createOrder.payment.referenceId")}</Label>
            <IconField icon={<Hash className="h-4 w-4" />}>
              <Input className="rounded-2xl border-0 bg-transparent pl-3 focus-visible:ring-0 focus-visible:ring-offset-0" {...form.register("reference.referenceId")} />
            </IconField>
          </div>

          <div className="space-y-2">
            <Label>{t("createOrder.payment.shelfId")}</Label>
            <IconField icon={<Layers className="h-4 w-4" />}>
              <Input className="rounded-2xl border-0 bg-transparent pl-3 focus-visible:ring-0 focus-visible:ring-offset-0" {...form.register("reference.shelfId")} />
            </IconField>
          </div>

          <div className="space-y-2">
            <Label>{t("createOrder.payment.promoCode")}</Label>
            <IconField icon={<TicketPercent className="h-4 w-4" />}>
              <Input className="rounded-2xl border-0 bg-transparent pl-3 focus-visible:ring-0 focus-visible:ring-offset-0" {...form.register("reference.promoCode")} />
            </IconField>
          </div>

          <div className="space-y-2">
            <Label>{t("createOrder.payment.numberOfCalls")}</Label>
            <IconField icon={<Hash className="h-4 w-4" />}>
              <Input
                type="number"
                step="1"
                className="rounded-2xl border-0 bg-transparent pl-3 focus-visible:ring-0 focus-visible:ring-offset-0"
                {...form.register("reference.numberOfCalls", {
                  setValueAs: (value) => (value === "" || value === null ? undefined : Number(value)),
                })}
              />
            </IconField>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Label>{t("createOrder.payment.note")}</Label>
          <Textarea
            className="rounded-2xl"
            placeholder={t("createOrder.payment.notePlaceholder")}
            {...form.register("note")}
          />
        </div>
      </Card>
    </div>
  );
}
