"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Mail,
  MapPin,
  Package,
  Phone,
  Users,
} from "lucide-react";

import { formatAddress } from "@/lib/addresses";
import { getCustomerById } from "@/lib/customers";

import { useI18n } from "@/components/i18n/I18nProvider";
import PageShell from "@/components/layout/PageShell";
import BulkOrderImportDialog from "@/components/orders/BulkOrderImportDialog";
import CreateOrderDialog from "@/components/orders/CreateOrderDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

const copy = {
  en: {
    backToCustomers: "Back to customers",
    notAvailableTitle: "Customer not available",
    notAvailableSubtitle:
      "We could not load this customer record. Check the customer ID or refresh the page.",
    profileBadge: "Customer profile",
    heroSubtitle:
      "Single-shipment creation and controlled CSV imports are locked to this customer entity so manager-side operations stay consistent with the customer profile and address book.",
    stat: {
      orders: "Orders",
      users: "Users",
      savedAddresses: "Saved addresses",
      since: "Since",
    },
    field: {
      email: "Email",
      primaryPhone: "Primary phone",
      company: "Company",
      created: "Created",
      legalName: "Legal name",
      taxId: "Tax ID",
      alternatePhone1: "Alternate phone 1",
      alternatePhone2: "Alternate phone 2",
      defaultAddress: "Default address",
    },
    notSet: "Not set",
    noSavedAddressYet: "No saved address yet",
    profileTitle: "Customer profile",
    savedAddressesTitle: "Saved addresses",
    emptySavedAddresses:
      "No saved addresses yet. Managers can create a shipment from this page and store pickup or dropoff addresses in the customer address book.",
    addressFallback: "ADDRESS",
    importHint:
      "CSV import is intentionally limited to the controlled v1 template. This keeps bulk creation safe and avoids mismatches with the live order form.",
    bulkImport: "Bulk Import",
    createShipment: "Create shipment",
  },
  ru: {
    backToCustomers: "Назад к клиентам",
    notAvailableTitle: "Клиент недоступен",
    notAvailableSubtitle:
      "Не удалось загрузить карточку клиента. Проверьте ID клиента или обновите страницу.",
    profileBadge: "Профиль клиента",
    heroSubtitle:
      "Создание одиночных отправок и контролируемый CSV-импорт привязаны к этой сущности клиента, чтобы операции менеджера оставались согласованными с профилем клиента и адресной книгой.",
    stat: {
      orders: "Заказы",
      users: "Пользователи",
      savedAddresses: "Сохраненные адреса",
      since: "С нами с",
    },
    field: {
      email: "Email",
      primaryPhone: "Основной телефон",
      company: "Компания",
      created: "Создан",
      legalName: "Юридическое имя",
      taxId: "ИНН",
      alternatePhone1: "Дополнительный телефон 1",
      alternatePhone2: "Дополнительный телефон 2",
      defaultAddress: "Адрес по умолчанию",
    },
    notSet: "Не указано",
    noSavedAddressYet: "Сохраненных адресов пока нет",
    profileTitle: "Профиль клиента",
    savedAddressesTitle: "Сохраненные адреса",
    emptySavedAddresses:
      "Сохраненных адресов пока нет. Менеджеры могут создать отправку с этой страницы и сохранить адреса забора или доставки в адресную книгу клиента.",
    addressFallback: "АДРЕС",
    importHint:
      "CSV-импорт намеренно ограничен контролируемым шаблоном v1. Это делает массовое создание безопасным и исключает расхождения с живой формой заказа.",
    bulkImport: "Массовый импорт",
    createShipment: "Создать отправку",
  },
  uz: {
    backToCustomers: "Mijozlarga qaytish",
    notAvailableTitle: "Mijoz mavjud emas",
    notAvailableSubtitle:
      "Bu mijoz kartasini yuklab bo'lmadi. Mijoz ID sini tekshiring yoki sahifani yangilang.",
    profileBadge: "Mijoz profili",
    heroSubtitle:
      "Yakka jo'natma yaratish va nazoratli CSV import shu mijoz entity siga bog'langan, shunda menejer tomondagi amallar mijoz profili va manzil kitobi bilan mos qoladi.",
    stat: {
      orders: "Buyurtmalar",
      users: "Foydalanuvchilar",
      savedAddresses: "Saqlangan manzillar",
      since: "Biz bilan",
    },
    field: {
      email: "Email",
      primaryPhone: "Asosiy telefon",
      company: "Kompaniya",
      created: "Yaratilgan",
      legalName: "Yuridik nom",
      taxId: "STIR",
      alternatePhone1: "Qo'shimcha telefon 1",
      alternatePhone2: "Qo'shimcha telefon 2",
      defaultAddress: "Asosiy manzil",
    },
    notSet: "Ko'rsatilmagan",
    noSavedAddressYet: "Hali saqlangan manzil yo'q",
    profileTitle: "Mijoz profili",
    savedAddressesTitle: "Saqlangan manzillar",
    emptySavedAddresses:
      "Hali saqlangan manzillar yo'q. Menejerlar shu sahifadan jo'natma yaratib, pickup yoki dropoff manzillarini mijoz manzil kitobiga saqlashi mumkin.",
    addressFallback: "MANZIL",
    importHint:
      "CSV import ataylab nazorat qilinadigan v1 shablon bilan cheklangan. Bu ommaviy yaratishni xavfsiz qiladi va jonli buyurtma formasi bilan nomuvofiqlikni oldini oladi.",
    bulkImport: "Ommaviy import",
    createShipment: "Jo'natma yaratish",
  },
} as const;

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getCustomerLabel(customer: {
  name: string;
  companyName?: string | null;
}) {
  return customer.companyName || customer.name;
}

function renderAddress(
  address: Parameters<typeof formatAddress>[0] | null | undefined,
  emptyLabel: string,
) {
  if (!address) return emptyLabel;
  const formatted = formatAddress(address);
  return formatted || emptyLabel;
}

function LoadingState() {
  return (
    <PageShell>
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full rounded-3xl" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-full rounded-3xl" />
          ))}
        </div>
      </div>
    </PageShell>
  );
}

export default function CustomerDetailPage() {
  const { locale } = useI18n();
  const params = useParams();
  const id = params?.id as string;
  const text = copy[locale] ?? copy.en;

  const query = useQuery({
    queryKey: ["customer", id],
    queryFn: () => getCustomerById(id),
    enabled: Boolean(id),
  });

  if (query.isLoading) {
    return <LoadingState />;
  }

  if (query.isError || !query.data) {
    return (
      <PageShell>
        <Card className="rounded-3xl border-destructive/30">
          <CardContent className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
            <p className="text-lg font-semibold">{text.notAvailableTitle}</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {text.notAvailableSubtitle}
            </p>
            <Button asChild variant="outline">
              <Link href="/dashboard/manager/customers">{text.backToCustomers}</Link>
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const customer = query.data;
  const customerLabel = getCustomerLabel(customer);
  const savedAddresses = customer.addresses ?? [];
  const statCards = [
    {
      label: text.stat.orders,
      value: customer._count?.orders ?? 0,
      icon: Package,
      accent: "from-sky-500/12 to-sky-500/0",
    },
    {
      label: text.stat.users,
      value: customer._count?.users ?? 0,
      icon: Users,
      accent: "from-emerald-500/12 to-emerald-500/0",
    },
    {
      label: text.stat.savedAddresses,
      value: customer._count?.addresses ?? 0,
      icon: MapPin,
      accent: "from-amber-500/12 to-amber-500/0",
    },
    {
      label: text.stat.since,
      value: formatDate(customer.createdAt, locale),
      icon: CalendarDays,
      accent: "from-violet-500/12 to-violet-500/0",
    },
  ];

  return (
    <PageShell>
      <div className="space-y-6">
        <Button asChild variant="ghost" className="w-fit rounded-2xl px-0 hover:bg-transparent">
          <Link href="/dashboard/manager/customers">
            <ArrowLeft className="h-4 w-4" />
            {text.backToCustomers}
          </Link>
        </Button>

        <section className="overflow-hidden rounded-[2rem] border border-border/60 bg-[linear-gradient(135deg,rgba(17,24,39,0.02),rgba(59,130,246,0.08),rgba(255,255,255,0.96))]">
          <div className="grid gap-6 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:p-8">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em]">
                  {customer.type}
                </Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                  {text.profileBadge}
                </Badge>
              </div>

              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight">{customerLabel}</h1>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  {text.heroSubtitle}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                <div className="rounded-3xl border border-border/60 bg-background/85 p-4 backdrop-blur">
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {text.field.email}
                      </p>
                      <p className="mt-1 text-sm font-medium">{customer.email || text.notSet}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-3xl border border-border/60 bg-background/85 p-4 backdrop-blur">
                  <div className="flex items-start gap-3">
                    <Phone className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {text.field.primaryPhone}
                      </p>
                      <p className="mt-1 text-sm font-medium">{customer.phone || text.notSet}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-3xl border border-border/60 bg-background/85 p-4 backdrop-blur">
                  <div className="flex items-start gap-3">
                    <Building2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {text.field.company}
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {customer.companyName || customer.name}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-3xl border border-border/60 bg-background/85 p-4 backdrop-blur">
                  <div className="flex items-start gap-3">
                    <CalendarDays className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {text.field.created}
                      </p>
                      <p className="mt-1 text-sm font-medium">{formatDate(customer.createdAt, locale)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex w-full max-w-sm flex-col gap-3 xl:w-[260px]">
              <CreateOrderDialog
                mode="manager"
                presetCustomerEntityId={customer.id}
                presetCustomerEntityLabel={customerLabel}
                lockCustomerEntitySelection
                triggerLabel={text.createShipment}
              />
              <BulkOrderImportDialog
                customerEntityId={customer.id}
                customerLabel={customerLabel}
                trigger={
                  <Button variant="outline" className="rounded-2xl">
                    {text.bulkImport}
                  </Button>
                }
              />
              <div className="rounded-3xl border border-border/60 bg-background/80 p-4 text-sm text-muted-foreground backdrop-blur">
                {text.importHint}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((item) => (
            <Card key={item.label} className={`overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br ${item.accent}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <p className="mt-3 text-3xl font-semibold tracking-tight">{item.value}</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/80 p-2.5">
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <Card className="rounded-3xl border border-border/60">
            <CardHeader>
              <CardTitle className="text-xl">{text.profileTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 text-sm">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {text.field.legalName}
                  </p>
                  <p className="mt-2 font-medium">{customer.name}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {text.field.taxId}
                  </p>
                  <p className="mt-2 font-medium">{customer.taxId || text.notSet}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {text.field.alternatePhone1}
                  </p>
                  <p className="mt-2 font-medium">{customer.altPhone1 || text.notSet}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {text.field.alternatePhone2}
                  </p>
                  <p className="mt-2 font-medium">{customer.altPhone2 || text.notSet}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {text.field.defaultAddress}
                </p>
                <p className="text-sm leading-6 text-foreground">
                  {renderAddress(customer.defaultAddress, text.noSavedAddressYet)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-border/60">
            <CardHeader>
              <CardTitle className="text-xl">{text.savedAddressesTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              {savedAddresses.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
                  {text.emptySavedAddresses}
                </div>
              ) : (
                <div className="space-y-3">
                  {savedAddresses.map((address) => (
                    <div
                      key={address.id}
                      className="rounded-3xl border border-border/60 bg-muted/15 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <Badge variant="outline" className="rounded-full">
                          {address.addressType || text.addressFallback}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(address.createdAt, locale)}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-foreground">
                        {renderAddress(address, text.noSavedAddressYet)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
