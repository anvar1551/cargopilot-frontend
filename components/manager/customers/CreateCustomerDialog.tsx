"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { createCustomer } from "@/lib/customerEntities";

import { useI18n } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FormValues = {
  type: "PERSON" | "COMPANY";
  name: string;
  email?: string;
  phone?: string;
  companyName?: string;
  taxId?: string;
};

const copy = {
  en: {
    trigger: "Create Customer",
    title: "Create Customer",
    type: "Type",
    person: "Person",
    company: "Company",
    contactName: "Contact Name",
    fullName: "Full Name",
    companyName: "Company Name",
    taxId: "Tax ID",
    email: "Email",
    phone: "Phone",
    create: "Create",
    creating: "Creating...",
    created: "Customer created",
    failed: "Failed to create customer",
  },
  ru: {
    trigger: "Создать клиента",
    title: "Создать клиента",
    type: "Тип",
    person: "Физлицо",
    company: "Компания",
    contactName: "Контактное лицо",
    fullName: "Полное имя",
    companyName: "Название компании",
    taxId: "ИНН",
    email: "Email",
    phone: "Телефон",
    create: "Создать",
    creating: "Создание...",
    created: "Клиент создан",
    failed: "Не удалось создать клиента",
  },
  uz: {
    trigger: "Mijoz yaratish",
    title: "Mijoz yaratish",
    type: "Turi",
    person: "Jismoniy shaxs",
    company: "Kompaniya",
    contactName: "Kontakt shaxs",
    fullName: "To'liq ism",
    companyName: "Kompaniya nomi",
    taxId: "STIR",
    email: "Email",
    phone: "Telefon",
    create: "Yaratish",
    creating: "Yaratilmoqda...",
    created: "Mijoz yaratildi",
    failed: "Mijozni yaratib bo'lmadi",
  },
} as const;

export default function CreateCustomerDialog() {
  const { locale } = useI18n();
  const text = copy[locale];

  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    defaultValues: {
      type: "PERSON",
      name: "",
    },
  });

  const mutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success(text.created);
      setOpen(false);
      form.reset();
    },
    onError: () => {
      toast.error(text.failed);
    },
  });

  const type = form.watch("type");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{text.trigger}</Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{text.title}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
        >
          <div>
            <Label>{text.type}</Label>
            <Select
              defaultValue="PERSON"
              onValueChange={(value) =>
                form.setValue("type", value as "PERSON" | "COMPANY")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PERSON">{text.person}</SelectItem>
                <SelectItem value="COMPANY">{text.company}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{type === "COMPANY" ? text.contactName : text.fullName}</Label>
            <Input {...form.register("name", { required: true })} />
          </div>

          {type === "COMPANY" ? (
            <>
              <div>
                <Label>{text.companyName}</Label>
                <Input {...form.register("companyName")} />
              </div>

              <div>
                <Label>{text.taxId}</Label>
                <Input {...form.register("taxId")} />
              </div>
            </>
          ) : null}

          <div>
            <Label>{text.email}</Label>
            <Input type="email" {...form.register("email")} />
          </div>

          <div>
            <Label>{text.phone}</Label>
            <Input {...form.register("phone")} />
          </div>

          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? text.creating : text.create}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
