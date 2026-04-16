"use client";

import {
  Building2,
  Flag,
  Hash,
  Home,
  Landmark,
  Layers,
  MapPin,
} from "lucide-react";

import type { CreateOrderFormApi } from "@/components/orders/create-order-form.types";

import { useI18n } from "@/components/i18n/I18nProvider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PricingRegion } from "@/lib/pricing";

function IconWrap({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-3 py-2 transition-shadow focus-within:ring-2 focus-within:ring-primary/25">
      <span className="text-muted-foreground">{icon}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

type Prefix = "addresses.senderAddress" | "addresses.receiverAddress";
type AddressTypeValue = "RESIDENTIAL" | "BUSINESS";

export function StructuredAddressFields({
  form,
  prefix,
  regionOptions = [],
}: {
  form: CreateOrderFormApi;
  prefix: Prefix;
  regionOptions?: PricingRegion[];
}) {
  const { t } = useI18n();
  const typePath = `${prefix}.addressType` as const;
  const cityOptionsId = `${prefix.replace(/\./g, "-")}-city-options`;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className="space-y-2">
        <Label>{t("createOrder.addressFields.country")}</Label>
        <IconWrap icon={<Flag className="h-4 w-4" />}>
          <Input
            placeholder={t("createOrder.addressFields.countryPlaceholder")}
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            {...form.register(`${prefix}.country` as const)}
          />
        </IconWrap>
      </div>

      <div className="space-y-2">
        <Label>{t("createOrder.addressFields.city")}</Label>
        <IconWrap icon={<MapPin className="h-4 w-4" />}>
          <Input
            list={regionOptions.length ? cityOptionsId : undefined}
            placeholder={t("createOrder.addressFields.cityPlaceholder")}
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            {...form.register(`${prefix}.city` as const)}
          />
        </IconWrap>
        {regionOptions.length ? (
          <datalist id={cityOptionsId}>
            {regionOptions.map((region) => (
              <option
                key={region.id}
                value={region.name}
                label={[region.code, ...region.aliases].filter(Boolean).join(" · ")}
              />
            ))}
          </datalist>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label>{t("createOrder.addressFields.neighborhood")}</Label>
        <IconWrap icon={<Layers className="h-4 w-4" />}>
          <Input
            placeholder={t("createOrder.addressFields.neighborhoodPlaceholder")}
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            {...form.register(`${prefix}.neighborhood` as const)}
          />
        </IconWrap>
      </div>

      <div className="space-y-2">
        <Label>{t("createOrder.addressFields.postalCode")}</Label>
        <IconWrap icon={<Hash className="h-4 w-4" />}>
          <Input
            placeholder={t("createOrder.addressFields.postalCodePlaceholder")}
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            {...form.register(`${prefix}.postalCode` as const)}
          />
        </IconWrap>
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label>{t("createOrder.addressFields.street")}</Label>
        <IconWrap icon={<MapPin className="h-4 w-4" />}>
          <Input
            placeholder={t("createOrder.addressFields.streetPlaceholder")}
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            {...form.register(`${prefix}.street` as const)}
          />
        </IconWrap>
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label>{t("createOrder.addressFields.addressLine1")}</Label>
        <IconWrap icon={<Home className="h-4 w-4" />}>
          <Input
            placeholder={t("createOrder.addressFields.addressLine1Placeholder")}
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            {...form.register(`${prefix}.addressLine1` as const)}
          />
        </IconWrap>
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label>{t("createOrder.addressFields.addressLine2")}</Label>
        <IconWrap icon={<Home className="h-4 w-4" />}>
          <Input
            placeholder={t("createOrder.addressFields.addressLine2Placeholder")}
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            {...form.register(`${prefix}.addressLine2` as const)}
          />
        </IconWrap>
      </div>

      <div className="space-y-2">
        <Label>{t("createOrder.addressFields.building")}</Label>
        <IconWrap icon={<Building2 className="h-4 w-4" />}>
          <Input
            placeholder={t("createOrder.addressFields.buildingPlaceholder")}
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            {...form.register(`${prefix}.building` as const)}
          />
        </IconWrap>
      </div>

      <div className="space-y-2">
        <Label>{t("createOrder.addressFields.apartment")}</Label>
        <IconWrap icon={<Home className="h-4 w-4" />}>
          <Input
            placeholder={t("createOrder.addressFields.apartmentPlaceholder")}
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            {...form.register(`${prefix}.apartment` as const)}
          />
        </IconWrap>
      </div>

      <div className="space-y-2">
        <Label>{t("createOrder.addressFields.floor")}</Label>
        <IconWrap icon={<Layers className="h-4 w-4" />}>
          <Input
            placeholder={t("createOrder.addressFields.floorPlaceholder")}
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            {...form.register(`${prefix}.floor` as const)}
          />
        </IconWrap>
      </div>

      <div className="space-y-2">
        <Label>{t("createOrder.addressFields.landmark")}</Label>
        <IconWrap icon={<Landmark className="h-4 w-4" />}>
          <Input
            placeholder={t("createOrder.addressFields.landmarkPlaceholder")}
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            {...form.register(`${prefix}.landmark` as const)}
          />
        </IconWrap>
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label>{t("createOrder.addressFields.addressType")}</Label>
        <Select
          value={(form.watch(typePath) as AddressTypeValue | null | undefined) ?? undefined}
          onValueChange={(value) =>
            form.setValue(typePath, value as AddressTypeValue, {
              shouldValidate: true,
            })
          }
        >
          <SelectTrigger className="rounded-2xl border-border/60 bg-background/60">
            <SelectValue placeholder={t("createOrder.addressFields.selectType")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="RESIDENTIAL">{t("createOrder.addressFields.enum.RESIDENTIAL")}</SelectItem>
            <SelectItem value="BUSINESS">{t("createOrder.addressFields.enum.BUSINESS")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
