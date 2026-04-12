"use client";

import CustomersTable from "@/components/manager/customers/CustomersTable";
import CreateCustomerDialog from "@/components/manager/customers/CreateCustomerDialog";
import { useI18n } from "@/components/i18n/I18nProvider";
import PageShell from "@/components/layout/PageShell";

const copy = {
  en: {
    title: "Customers",
    subtitle: "Manage customer entities for both persons and companies.",
  },
  ru: {
    title: "Клиенты",
    subtitle: "Управляйте карточками клиентов для физических лиц и компаний.",
  },
  uz: {
    title: "Mijozlar",
    subtitle: "Jismoniy shaxslar va kompaniyalar uchun mijoz kartalarini boshqaring.",
  },
} as const;

export default function ManagerCustomersPage() {
  const { locale } = useI18n();
  const text = copy[locale];

  return (
    <PageShell>
      <div className="space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{text.title}</h1>
            <p className="text-sm text-muted-foreground">{text.subtitle}</p>
          </div>

          <CreateCustomerDialog />
        </div>

        <CustomersTable />
      </div>
    </PageShell>
  );
}
