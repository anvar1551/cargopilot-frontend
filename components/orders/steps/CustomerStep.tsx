"use client";

import { useEffect } from "react";
import { Building2, MapPin, Navigation, Phone, User } from "lucide-react";

import { formatAddress, type Address } from "@/lib/addresses";
import type { CreateOrderFormApi } from "@/components/orders/create-order-form.types";

import { useI18n } from "@/components/i18n/I18nProvider";
import { AddressCombobox } from "@/components/combobox/AddressCombobox";
import { CustomerEntityCombobox } from "@/components/combobox/CustomerEntityCombobox";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

import { StructuredAddressFields } from "../fields/StructuredAddressFields";
import { FieldError, IconField } from "../IconField";

function toAddressSnapshot(addr: Address) {
  return {
    country: addr.country ?? null,
    city: addr.city ?? null,
    neighborhood: addr.neighborhood ?? null,
    street: addr.street ?? null,
    addressLine1: addr.addressLine1 ?? null,
    addressLine2: addr.addressLine2 ?? null,
    building: addr.building ?? null,
    apartment: addr.apartment ?? null,
    floor: addr.floor ?? null,
    landmark: addr.landmark ?? null,
    postalCode: addr.postalCode ?? null,
    addressType: addr.addressType ?? null,
  };
}

export function CustomerStep({
  form,
  mode,
  canSaveAddresses,
  lockCustomerEntitySelection = false,
  lockedCustomerEntityLabel = null,
}: {
  form: CreateOrderFormApi;
  mode: "customer" | "manager";
  canSaveAddresses: boolean;
  lockCustomerEntitySelection?: boolean;
  lockedCustomerEntityLabel?: string | null;
}) {
  const { t } = useI18n();
  const isManager = mode === "manager";

  const pickupErr = form.formState.errors.addresses?.pickupAddress?.message as string | undefined;
  const dropoffErr = form.formState.errors.addresses?.dropoffAddress?.message as string | undefined;
  const receiverNameErr = form.formState.errors.receiver?.name?.message as string | undefined;
  const receiverPhoneErr = form.formState.errors.receiver?.phone?.message as string | undefined;

  const customerEntityId = form.watch("customerEntityId") ?? null;
  const pickupId = form.watch("addresses.senderAddressId") ?? null;
  const pickupText = form.watch("addresses.pickupAddress") ?? "";
  const dropoffId = form.watch("addresses.receiverAddressId") ?? null;
  const dropoffText = form.watch("addresses.dropoffAddress") ?? "";
  const savePickup = !!form.watch("addresses.savePickupToAddressBook");
  const saveDropoff = !!form.watch("addresses.saveDropoffToAddressBook");

  useEffect(() => {
    if (!canSaveAddresses) {
      if (savePickup) {
        form.setValue("addresses.savePickupToAddressBook", false, { shouldDirty: true });
      }
      if (saveDropoff) {
        form.setValue("addresses.saveDropoffToAddressBook", false, { shouldDirty: true });
      }
    }
  }, [canSaveAddresses, form, saveDropoff, savePickup]);

  const onSelectPickup = (id: string | null, addr?: Address) => {
    form.setValue("addresses.senderAddressId", id, {
      shouldDirty: true,
      shouldValidate: true,
    });

    if (addr) {
      form.setValue("addresses.pickupAddress", formatAddress(addr), {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue("addresses.senderAddress", toAddressSnapshot(addr), {
        shouldDirty: true,
      });
      form.setValue("addresses.savePickupToAddressBook", false, {
        shouldDirty: true,
      });
    } else {
      form.setValue("addresses.senderAddress", null, { shouldDirty: true });
    }
  };

  const onTypePickup = (value: string) => {
    form.setValue("addresses.pickupAddress", value, {
      shouldDirty: true,
      shouldValidate: true,
    });

    if (pickupId) {
      form.setValue("addresses.senderAddressId", null, { shouldDirty: true });
      form.setValue("addresses.senderAddress", null, { shouldDirty: true });
    }
  };

  const onSelectDropoff = (id: string | null, addr?: Address) => {
    form.setValue("addresses.receiverAddressId", id, {
      shouldDirty: true,
      shouldValidate: true,
    });

    if (addr) {
      form.setValue("addresses.dropoffAddress", formatAddress(addr), {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue("addresses.receiverAddress", toAddressSnapshot(addr), {
        shouldDirty: true,
      });

      if (addr.city) {
        form.setValue("addresses.destinationCity", addr.city, { shouldDirty: true });
      }

      form.setValue("addresses.saveDropoffToAddressBook", false, {
        shouldDirty: true,
      });
    } else {
      form.setValue("addresses.receiverAddress", null, { shouldDirty: true });
    }
  };

  const onTypeDropoff = (value: string) => {
    form.setValue("addresses.dropoffAddress", value, {
      shouldDirty: true,
      shouldValidate: true,
    });

    if (dropoffId) {
      form.setValue("addresses.receiverAddressId", null, { shouldDirty: true });
      form.setValue("addresses.receiverAddress", null, { shouldDirty: true });
    }
  };

  const addressBookCustomerEntityId = isManager ? customerEntityId : undefined;

  return (
    <div className="space-y-4">
      {isManager ? (
        <Card className="rounded-2xl border bg-linear-to-b from-primary/10 via-background to-background p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="flex items-center gap-2 font-semibold">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {t("createOrder.customer.customerTitle")}
              </h3>
              <p className="text-sm text-muted-foreground">{t("createOrder.customer.customerSubtitle")}</p>
            </div>

            <div className="w-90">
              <Label className="text-xs">{t("createOrder.customer.customerEntity")}</Label>
              {lockCustomerEntitySelection ? (
                <div className="rounded-2xl border bg-background px-3 py-2 text-sm">
                  {customerEntityId ? (
                    <span className="font-medium">{lockedCustomerEntityLabel || customerEntityId}</span>
                  ) : (
                    <span className="text-muted-foreground">{t("createOrder.customer.customerNotSelected")}</span>
                  )}
                </div>
              ) : (
                <CustomerEntityCombobox
                  value={customerEntityId}
                  onChange={(id) => form.setValue("customerEntityId", id, { shouldDirty: true })}
                />
              )}
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl border bg-background/70 p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold">
              <User className="h-4 w-4 text-muted-foreground" />
              {t("createOrder.customer.sender")}
            </h3>
            <span className="text-xs text-muted-foreground">{t("createOrder.customer.optional")}</span>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <Label>{t("createOrder.customer.name")}</Label>
              <IconField icon={<User className="h-4 w-4" />}>
                <Input
                  className="rounded-2xl border-0 bg-transparent pl-3 focus-visible:ring-0 focus-visible:ring-offset-0"
                  placeholder={t("createOrder.customer.senderPlaceholder")}
                  {...form.register("sender.name")}
                />
              </IconField>
            </div>

            <div>
              <Label>{t("createOrder.customer.phone")}</Label>
              <IconField icon={<Phone className="h-4 w-4" />}>
                <Input
                  className="rounded-2xl border-0 bg-transparent pl-3 focus-visible:ring-0 focus-visible:ring-offset-0"
                  placeholder="+49..."
                  {...form.register("sender.phone")}
                />
              </IconField>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border bg-linear-to-b from-emerald-500/10 to-background p-5">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold">
              <User className="h-4 w-4 text-muted-foreground" />
              {t("createOrder.customer.receiver")}
            </h3>
            <span className="text-xs text-muted-foreground">{t("createOrder.customer.mandatory")}</span>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <Label>{t("createOrder.customer.name")} *</Label>
              <IconField icon={<User className="h-4 w-4" />} error={!!receiverNameErr}>
                <Input
                  className="rounded-2xl border-0 bg-transparent pl-3 focus-visible:ring-0 focus-visible:ring-offset-0"
                  placeholder={t("createOrder.customer.receiverPlaceholder")}
                  {...form.register("receiver.name")}
                />
              </IconField>
              <FieldError msg={receiverNameErr} />
            </div>

            <div>
              <Label>{t("createOrder.customer.phone")} *</Label>
              <IconField icon={<Phone className="h-4 w-4" />} error={!!receiverPhoneErr}>
                <Input
                  className="rounded-2xl border-0 bg-transparent pl-3 focus-visible:ring-0 focus-visible:ring-offset-0"
                  placeholder="+49..."
                  {...form.register("receiver.phone")}
                />
              </IconField>
              <FieldError msg={receiverPhoneErr} />
            </div>
          </div>
        </Card>
      </div>

      <Card className="rounded-2xl border bg-linear-to-b from-violet-500/10 to-background p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          {t("createOrder.customer.routeTitle")}
        </h3>
        <p className="text-sm text-muted-foreground">{t("createOrder.customer.routeSubtitle")}</p>

        <Separator className="my-4" />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("createOrder.customer.pickupAddress")}</Label>
            <IconField icon={<MapPin className="h-4 w-4" />} error={!!pickupErr}>
              <Input
                className="rounded-2xl border-0 bg-transparent pl-3 focus-visible:ring-0 focus-visible:ring-offset-0"
                placeholder={t("createOrder.customer.addressPlaceholder")}
                value={pickupText}
                onChange={(event) => onTypePickup(event.target.value)}
              />
            </IconField>
            <FieldError msg={pickupErr} />

            <div className="space-y-2">
              <Label className="text-sm">{t("createOrder.customer.pickupBook")}</Label>
              <AddressCombobox
                value={pickupId}
                customerEntityId={addressBookCustomerEntityId}
                placeholder={t("createOrder.customer.savedAddressPlaceholder")}
                onChange={onSelectPickup}
              />

              {!pickupId ? (
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    disabled={!canSaveAddresses}
                    checked={savePickup}
                    onCheckedChange={(value) =>
                      form.setValue("addresses.savePickupToAddressBook", Boolean(value), {
                        shouldDirty: true,
                      })
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    {t("createOrder.customer.savePickup")}
                    {!canSaveAddresses ? t("createOrder.customer.requiresProfile") : ""}
                  </span>
                </div>
              ) : null}

              <div className="mt-3 rounded-2xl border border-border/60 bg-background/60 p-4">
                <p className="text-sm font-semibold">{t("createOrder.customer.structuredTitle")}</p>
                <p className="text-xs text-muted-foreground">{t("createOrder.customer.structuredHint")}</p>

                <div className="mt-3">
                  <StructuredAddressFields form={form} prefix="addresses.senderAddress" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("createOrder.customer.dropoffAddress")}</Label>
            <IconField icon={<Navigation className="h-4 w-4" />} error={!!dropoffErr}>
              <Input
                className="rounded-2xl border-0 bg-transparent pl-3 focus-visible:ring-0 focus-visible:ring-offset-0"
                placeholder={t("createOrder.customer.addressPlaceholder")}
                value={dropoffText}
                onChange={(event) => onTypeDropoff(event.target.value)}
              />
            </IconField>
            <FieldError msg={dropoffErr} />

            <div className="space-y-2">
              <Label className="text-sm">{t("createOrder.customer.dropoffBook")}</Label>
              <AddressCombobox
                value={dropoffId}
                customerEntityId={addressBookCustomerEntityId}
                placeholder={t("createOrder.customer.savedAddressPlaceholder")}
                onChange={onSelectDropoff}
              />

              {!dropoffId ? (
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    disabled={!canSaveAddresses}
                    checked={saveDropoff}
                    onCheckedChange={(value) =>
                      form.setValue("addresses.saveDropoffToAddressBook", Boolean(value), {
                        shouldDirty: true,
                      })
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    {t("createOrder.customer.saveDropoff")}
                    {!canSaveAddresses ? t("createOrder.customer.requiresProfile") : ""}
                  </span>
                </div>
              ) : null}

              <div className="mt-3 rounded-2xl border border-border/60 bg-background/60 p-4">
                <p className="text-sm font-semibold">{t("createOrder.customer.structuredTitle")}</p>
                <p className="text-xs text-muted-foreground">{t("createOrder.customer.structuredHint")}</p>

                <div className="mt-3">
                  <StructuredAddressFields form={form} prefix="addresses.receiverAddress" />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Label className="text-xs">{t("createOrder.customer.destinationCity")}</Label>
              <IconField icon={<Building2 className="h-4 w-4" />}>
                <Input
                  className="rounded-2xl border-0 bg-transparent pl-3 focus-visible:ring-0 focus-visible:ring-offset-0"
                  placeholder={t("createOrder.customer.destinationPlaceholder")}
                  {...form.register("addresses.destinationCity")}
                />
              </IconField>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
