"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Building2, Loader2, UserPlus } from "lucide-react";

import { useI18n } from "@/components/i18n/I18nProvider";
import { createUser, type AppRole, type CreateUserAsManagerInput } from "@/lib/users";
import { fetchWarehouses, type Warehouse } from "@/lib/warehouses";
import { CustomerEntityCombobox } from "@/components/combobox/CustomerEntityCombobox";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  name: string;
  email: string;
  password: string;
  role: AppRole;
  phone?: string | null;
  warehouseId?: string | null;
  customerEntityId?: string | null;
};

function createFormSchema(t: (key: string) => string) {
  return z
    .object({
      name: z.string().min(2, t("createUserDialog.validation.nameShort")),
      email: z.string().email(t("createUserDialog.validation.invalidEmail")),
      password: z.string().min(6, t("createUserDialog.validation.passwordMin")),
      role: z.enum(["customer", "manager", "warehouse", "driver"]),
      phone: z.string().optional().nullable(),
      warehouseId: z.string().uuid().optional().nullable(),
      customerEntityId: z.string().uuid().optional().nullable(),
    })
    .superRefine((value, ctx) => {
      const supportsWarehouse = value.role === "warehouse" || value.role === "driver";

      if (!supportsWarehouse && value.warehouseId) {
        ctx.addIssue({
          code: "custom",
          path: ["warehouseId"],
          message: t("createUserDialog.validation.warehouseRoleOnly"),
        });
      }

      if (value.role === "warehouse" && !value.warehouseId) {
        ctx.addIssue({
          code: "custom",
          path: ["warehouseId"],
          message: t("createUserDialog.validation.warehouseRequired"),
        });
      }

      if (value.role !== "customer" && value.customerEntityId) {
        ctx.addIssue({
          code: "custom",
          path: ["customerEntityId"],
          message: t("createUserDialog.validation.customerRoleOnly"),
        });
      }
    });
}

function generatePassword(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  let output = "";
  for (let index = 0; index < len; index += 1) {
    output += chars[Math.floor(Math.random() * chars.length)];
  }
  return output;
}

function roleNeedsWarehouse(role: FormValues["role"]) {
  return role === "warehouse";
}

function roleCanHaveWarehouse(role: FormValues["role"]) {
  return role === "warehouse" || role === "driver";
}

export default function CreateUserDialog() {
  const [open, setOpen] = React.useState(false);
  const qc = useQueryClient();
  const { t } = useI18n();
  const formSchema = React.useMemo(() => createFormSchema(t), [t]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "customer",
      phone: null,
      warehouseId: null,
      customerEntityId: null,
    },
    mode: "onTouched",
  });

  const role = useWatch({ control: form.control, name: "role" });
  const selectedWarehouseId = useWatch({ control: form.control, name: "warehouseId" });
  const selectedCustomerEntityId = useWatch({ control: form.control, name: "customerEntityId" });

  const warehousesQuery = useQuery<Warehouse[]>({
    queryKey: ["warehouses", "create-user"],
    queryFn: fetchWarehouses,
    enabled: open && roleCanHaveWarehouse(role),
  });

  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: async (data) => {
      toast.success(t("createUserDialog.successTitle"), {
        description: t("createUserDialog.successDescription", {
          email: data?.user?.email ?? t("common.user"),
        }),
      });

      await qc.invalidateQueries({ queryKey: ["users"] });
      form.reset({
        name: "",
        email: "",
        password: "",
        role: "customer",
        phone: null,
        warehouseId: null,
        customerEntityId: null,
      });
      setOpen(false);
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

      toast.error(t("createUserDialog.errorTitle"), {
        description: message ?? t("createUserDialog.unknownError"),
      });
    },
  });

  const onSubmit = (values: FormValues) => {
    const payload: CreateUserAsManagerInput = {
      name: values.name,
      email: values.email,
      password: values.password,
      role: values.role,
    };

    if (values.role === "customer") {
      payload.phone = values.phone ?? null;
      payload.customerEntityId = values.customerEntityId ?? null;
    }

    if (values.role === "warehouse" || values.role === "driver") {
      payload.warehouseId = values.warehouseId ?? null;
    }

    mutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" />
          {t("createUserDialog.trigger")}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{t("createUserDialog.title")}</DialogTitle>
          <DialogDescription>{t("createUserDialog.description")}</DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">{t("createUserDialog.name")}</Label>
              <Input id="name" placeholder={t("createUserDialog.namePlaceholder")} {...form.register("name")} />
              {form.formState.errors.name ? (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t("createUserDialog.email")}</Label>
              <Input
                id="email"
                placeholder={t("createUserDialog.emailPlaceholder")}
                type="email"
                {...form.register("email")}
              />
              {form.formState.errors.email ? (
                <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("createUserDialog.role")}</Label>
              <Select
                value={role}
                onValueChange={(value) => {
                  form.setValue("role", value as AppRole, { shouldValidate: true });
                  form.setValue("warehouseId", null);
                  form.setValue("customerEntityId", null);
                  form.setValue("phone", null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("createUserDialog.selectRole")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">{t("common.role.customer")}</SelectItem>
                  <SelectItem value="driver">{t("common.role.driver")}</SelectItem>
                  <SelectItem value="warehouse">{t("common.role.warehouse")}</SelectItem>
                  <SelectItem value="manager">{t("common.role.manager")}</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.role ? (
                <p className="text-sm text-destructive">{form.formState.errors.role.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("createUserDialog.password")}</Label>
              <div className="flex gap-2">
                <Input
                  id="password"
                  type="text"
                  placeholder={t("createUserDialog.passwordPlaceholder")}
                  {...form.register("password")}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    form.setValue("password", generatePassword(), {
                      shouldValidate: true,
                    })
                  }
                >
                  {t("createUserDialog.generate")}
                </Button>
              </div>
              {form.formState.errors.password ? (
                <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
              ) : null}
            </div>
          </div>

          {role === "customer" ? (
            <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="space-y-2">
                <Label>{t("createUserDialog.phoneOptional")}</Label>
                <Input placeholder={t("createUserDialog.phonePlaceholder")} {...form.register("phone")} />
              </div>

              <div className="space-y-2">
                <Label>{t("createUserDialog.customerCompanyOptional")}</Label>
                <CustomerEntityCombobox
                  value={selectedCustomerEntityId}
                  onChange={(id) => form.setValue("customerEntityId", id, { shouldDirty: true })}
                  placeholder={t("createUserDialog.customerPlaceholder")}
                />
                <p className="text-xs text-muted-foreground">{t("createUserDialog.customerHint")}</p>
              </div>
            </div>
          ) : null}

          {role === "warehouse" || role === "driver" ? (
            <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {t("createUserDialog.warehouseAssignment")} ({roleNeedsWarehouse(role) ? t("createUserDialog.required") : t("createUserDialog.optional")})
                </p>
              </div>

              <p className="text-xs text-muted-foreground">
                {roleNeedsWarehouse(role)
                  ? t("createUserDialog.warehouseRequiredHint")
                  : t("createUserDialog.warehouseOptionalHint")}
              </p>

              <Select
                value={selectedWarehouseId ?? undefined}
                onValueChange={(value) =>
                  form.setValue("warehouseId", value || null, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("createUserDialog.selectWarehouse")} />
                </SelectTrigger>
                <SelectContent>
                  {(warehousesQuery.data ?? []).map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                      {warehouse.location ? ` - ${warehouse.location}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {warehousesQuery.isLoading ? (
                <p className="text-xs text-muted-foreground">{t("createUserDialog.loadingWarehouses")}</p>
              ) : null}
              {warehousesQuery.isError ? (
                <p className="text-xs text-destructive">{t("createUserDialog.warehousesLoadFailed")}</p>
              ) : null}
              {!warehousesQuery.isLoading && !warehousesQuery.isError && (warehousesQuery.data?.length ?? 0) === 0 ? (
                <p className="text-xs text-muted-foreground">{t("createUserDialog.noWarehouses")}</p>
              ) : null}

              {!roleNeedsWarehouse(role) && selectedWarehouseId ? (
                <button
                  type="button"
                  className="w-fit text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  onClick={() =>
                    form.setValue("warehouseId", null, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                >
                  {t("createUserDialog.clearWarehouse")}
                </button>
              ) : null}

              {form.formState.errors.warehouseId ? (
                <p className="text-sm text-destructive">{form.formState.errors.warehouseId.message}</p>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>
              {t("createUserDialog.cancel")}
            </Button>

            <Button
              type="submit"
              disabled={
                mutation.isPending ||
                (roleNeedsWarehouse(role) &&
                  ((!warehousesQuery.isLoading && (warehousesQuery.data?.length ?? 0) === 0) || !selectedWarehouseId))
              }
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("createUserDialog.creating")}
                </>
              ) : (
                t("createUserDialog.createUser")
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
