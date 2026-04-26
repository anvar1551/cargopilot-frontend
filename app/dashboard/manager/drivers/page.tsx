"use client";

import Link from "next/link";
import * as React from "react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchDrivers, type DriverLite } from "@/lib/manager";
import { fetchDriverWorkloads, type DriverWorkload } from "@/lib/orders";
import { fetchWarehouses, type Warehouse } from "@/lib/warehouses";
import { usePageVisibility } from "@/lib/usePageVisibility";

import CreateUserDialog from "@/components/manager/users/CreateUserDialog";
import DriverManifestButton from "@/components/manager/drivers/DriverManifestButton";
import EditDriverProfileDialog from "@/components/manager/drivers/EditDriverProfileDialog";
import { useI18n } from "@/components/i18n/I18nProvider";
import PageShell from "@/components/layout/PageShell";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  ArrowRight,
  Search,
  Send,
  Truck,
  UserPlus,
  Users,
  Warehouse as WarehouseIcon,
} from "lucide-react";

type DriverRow = DriverLite & {
  workload: number;
  totalAssigned: number;
  warehouseName: string | null;
  warehouseNames: string[];
};

const copy = {
  en: {
    badge: "Fleet Control",
    title: "Manager Drivers",
    subtitle:
      "Monitor driver pool, assignment pressure, and warehouse coverage in one place.",
    openDispatch: "Open Dispatch",
    totalDrivers: "Total Drivers",
    totalDriversHint: "Registered in fleet",
    activeDrivers: "Active Drivers",
    activeDriversHint: "With assigned orders",
    withWarehouse: "With Warehouse",
    withWarehouseHint: "Attached to a hub",
    noWarehouse: "No Warehouse",
    noWarehouseHint: "Needs assignment",
    assignedLoad: "Assigned Load",
    assignedLoadHint: "Orders linked to drivers",
    roster: "Driver Roster",
    searchPlaceholder: "Search by name, email, or warehouse...",
    allCoverage: "All coverage",
    withWarehouseFilter: "With warehouse",
    withoutWarehouseFilter: "No warehouse",
    byWorkload: "By workload",
    byName: "By name",
    noDrivers: "No drivers found.",
    active: "Active",
    total: "Total",
    warehousePrefix: "Warehouse",
    warehouseAssigned: "Warehouse assigned",
    noWarehouseBadge: "No warehouse",
    topWorkload: "Top Workload",
    noWorkloadData: "No driver workload data yet.",
    quickActions: "Quick Actions",
    assignOrders: "Assign Orders In Dispatch",
    openOrdersTable: "Open Orders Table",
    manageUsers: "Manage Users",
  },
  ru: {
    badge: "Управление флотом",
    title: "Водители менеджера",
    subtitle:
      "Контролируйте пул водителей, нагрузку назначений и покрытие по складам в одном месте.",
    openDispatch: "Открыть диспетчерскую",
    totalDrivers: "Всего водителей",
    totalDriversHint: "Зарегистрированы в системе",
    activeDrivers: "Активные водители",
    activeDriversHint: "С назначенными заказами",
    withWarehouse: "Со складом",
    withWarehouseHint: "Привязаны к хабу",
    noWarehouse: "Без склада",
    noWarehouseHint: "Требует назначения",
    assignedLoad: "Назначенная нагрузка",
    assignedLoadHint: "Заказы, привязанные к водителям",
    roster: "Список водителей",
    searchPlaceholder: "Поиск по имени, email или складу...",
    allCoverage: "Все покрытия",
    withWarehouseFilter: "Со складом",
    withoutWarehouseFilter: "Без склада",
    byWorkload: "По нагрузке",
    byName: "По имени",
    noDrivers: "Водители не найдены.",
    active: "Активно",
    total: "Всего",
    warehousePrefix: "Склад",
    warehouseAssigned: "Склад назначен",
    noWarehouseBadge: "Без склада",
    topWorkload: "Максимальная нагрузка",
    noWorkloadData: "Данных по нагрузке водителей пока нет.",
    quickActions: "Быстрые действия",
    assignOrders: "Назначить заказы в диспетчерской",
    openOrdersTable: "Открыть таблицу заказов",
    manageUsers: "Управление пользователями",
  },
  uz: {
    badge: "Flotni boshqarish",
    title: "Menejer haydovchilari",
    subtitle:
      "Haydovchilar havzasini, yuklama bosimini va ombor qamrovini bir joyda kuzating.",
    openDispatch: "Dispatchni ochish",
    totalDrivers: "Jami haydovchilar",
    totalDriversHint: "Tizimda ro'yxatdan o'tgan",
    activeDrivers: "Faol haydovchilar",
    activeDriversHint: "Biriktirilgan buyurtmalari bor",
    withWarehouse: "Ombor bilan",
    withWarehouseHint: "Hub ga biriktirilgan",
    noWarehouse: "Omborsiz",
    noWarehouseHint: "Biriktirish kerak",
    assignedLoad: "Biriktirilgan yuklama",
    assignedLoadHint: "Haydovchilarga bog'langan buyurtmalar",
    roster: "Haydovchilar ro'yxati",
    searchPlaceholder: "Ism, email yoki ombor bo'yicha qidiring...",
    allCoverage: "Barcha qamrov",
    withWarehouseFilter: "Ombor bilan",
    withoutWarehouseFilter: "Omborsiz",
    byWorkload: "Yuklama bo'yicha",
    byName: "Ism bo'yicha",
    noDrivers: "Haydovchilar topilmadi.",
    active: "Faol",
    total: "Jami",
    warehousePrefix: "Ombor",
    warehouseAssigned: "Ombor biriktirilgan",
    noWarehouseBadge: "Omborsiz",
    topWorkload: "Eng yuqori yuklama",
    noWorkloadData: "Haydovchi yuklamasi bo'yicha ma'lumot yo'q.",
    quickActions: "Tezkor amallar",
    assignOrders: "Dispatchda buyurtma biriktirish",
    openOrdersTable: "Buyurtmalar jadvalini ochish",
    manageUsers: "Foydalanuvchilarni boshqarish",
  },
} as const;

function StatTile({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="rounded-2xl border-border/70">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {title}
            </div>
            <div className="mt-1 text-2xl font-semibold">{value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
          </div>
          <div className="rounded-xl border bg-muted/40 p-2">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ManagerDriversPage() {
  const { locale } = useI18n();
  const isPageVisible = usePageVisibility();
  const text = copy[locale];
  const [q, setQ] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState<
    "all" | "with" | "without"
  >("all");
  const [sortBy, setSortBy] = useState<"workload" | "name">("workload");

  const driversQuery = useQuery<DriverLite[]>({
    queryKey: ["manager-drivers-page"],
    queryFn: fetchDrivers,
    refetchInterval: isPageVisible ? 90_000 : false,
  });

  const workloadsQuery = useQuery<DriverWorkload[]>({
    queryKey: ["manager-drivers-workloads"],
    queryFn: fetchDriverWorkloads,
    refetchInterval: isPageVisible ? 90_000 : false,
  });

  const warehousesQuery = useQuery<Warehouse[]>({
    queryKey: ["manager-drivers-warehouses"],
    queryFn: fetchWarehouses,
    staleTime: 120000,
  });

  const drivers = useMemo(() => driversQuery.data ?? [], [driversQuery.data]);

  const warehouseNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const warehouse of warehousesQuery.data ?? []) {
      map.set(warehouse.id, warehouse.name);
    }
    return map;
  }, [warehousesQuery.data]);

  const workloadByDriverId = useMemo(() => {
    const map = new Map<string, DriverWorkload>();
    for (const row of workloadsQuery.data ?? []) {
      map.set(row.driverId, row);
    }
    return map;
  }, [workloadsQuery.data]);

  const rows = useMemo<DriverRow[]>(() => {
    const normalized = drivers.map((driver) => ({
      ...driver,
      workload: workloadByDriverId.get(driver.id)?.activeAssigned ?? 0,
      totalAssigned: workloadByDriverId.get(driver.id)?.totalAssigned ?? 0,
      warehouseName: driver.warehouseId
        ? warehouseNameById.get(driver.warehouseId) ?? null
        : null,
      warehouseNames: Array.from(
        new Set(
          (driver.warehouseIds ?? [])
            .map((warehouseId) => warehouseNameById.get(warehouseId))
            .filter((name): name is string => Boolean(name)),
        ),
      ),
    }));

    const qLower = q.trim().toLowerCase();

    const filtered = normalized.filter((driver) => {
      const hasWarehouse =
        Boolean(driver.warehouseId) || (driver.warehouseIds?.length ?? 0) > 0;
      if (warehouseFilter === "with" && !hasWarehouse) return false;
      if (warehouseFilter === "without" && hasWarehouse) return false;
      if (!qLower) return true;

      const haystack = `${driver.name} ${driver.email} ${driver.warehouseName ?? ""}`
        .toLowerCase()
        .trim();

      return haystack.includes(qLower);
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (b.workload !== a.workload) return b.workload - a.workload;
      return a.name.localeCompare(b.name);
    });
  }, [drivers, workloadByDriverId, warehouseNameById, q, warehouseFilter, sortBy]);

  const totalDrivers = drivers.length;
  const withWarehouse = drivers.filter(
    (driver) => Boolean(driver.warehouseId) || (driver.warehouseIds?.length ?? 0) > 0,
  ).length;
  const withoutWarehouse = totalDrivers - withWarehouse;
  const activeDrivers = rows.filter((driver) => driver.workload > 0).length;
  const totalAssignedAcrossDrivers = rows.reduce(
    (sum, driver) => sum + driver.totalAssigned,
    0,
  );

  const topDrivers = rows.slice(0, 5);

  const loading = driversQuery.isLoading || workloadsQuery.isLoading;

  return (
    <PageShell>
      <div className="space-y-6">
        <Card className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 text-white">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan-400/15 blur-2xl" />
          <div className="absolute -left-14 -bottom-14 h-52 w-52 rounded-full bg-blue-300/10 blur-2xl" />
          <CardContent className="relative p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs">
                  <Truck className="h-3.5 w-3.5" />
                  {text.badge}
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">{text.title}</h1>
                <p className="max-w-2xl text-sm text-slate-100/85">
                  {text.subtitle}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button asChild variant="secondary" className="gap-2">
                  <Link href="/dashboard/manager/dispatch">
                    <Send className="h-4 w-4" />
                    {text.openDispatch}
                  </Link>
                </Button>
                <CreateUserDialog />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {loading ? (
            Array.from({ length: 5 }).map((_, idx) => (
              <Card key={idx} className="rounded-2xl border-border/70">
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="mt-2 h-8 w-12" />
                  <Skeleton className="mt-2 h-3 w-28" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <StatTile
                title={text.totalDrivers}
                value={totalDrivers}
                hint={text.totalDriversHint}
                icon={Users}
              />
              <StatTile
                title={text.activeDrivers}
                value={activeDrivers}
                hint={text.activeDriversHint}
                icon={Truck}
              />
              <StatTile
                title={text.withWarehouse}
                value={withWarehouse}
                hint={text.withWarehouseHint}
                icon={WarehouseIcon}
              />
              <StatTile
                title={text.noWarehouse}
                value={withoutWarehouse}
                hint={text.noWarehouseHint}
                icon={UserPlus}
              />
              <StatTile
                title={text.assignedLoad}
                value={totalAssignedAcrossDrivers}
                hint={text.assignedLoadHint}
                icon={ArrowRight}
              />
            </>
          )}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Card className="rounded-2xl border-border/70">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <CardTitle className="text-base">{text.roster}</CardTitle>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative w-full sm:w-[280px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder={text.searchPlaceholder}
                      className="pl-9"
                    />
                  </div>

                  <Select
                    value={warehouseFilter}
                    onValueChange={(v: "all" | "with" | "without") =>
                      setWarehouseFilter(v)
                    }
                  >
                    <SelectTrigger className="w-[170px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{text.allCoverage}</SelectItem>
                      <SelectItem value="with">{text.withWarehouseFilter}</SelectItem>
                      <SelectItem value="without">{text.withoutWarehouseFilter}</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={sortBy}
                    onValueChange={(v: "workload" | "name") => setSortBy(v)}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="workload">{text.byWorkload}</SelectItem>
                      <SelectItem value="name">{text.byName}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : rows.length === 0 ? (
                <div className="text-sm text-muted-foreground">{text.noDrivers}</div>
              ) : (
                <div className="space-y-2">
                  {rows.map((driver) => (
                    <div
                      key={driver.id}
                      className="rounded-xl border border-border/70 bg-background px-3 py-3"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{driver.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {driver.email}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={driver.workload > 0 ? "secondary" : "outline"}>
                            {text.active}: {driver.workload}
                          </Badge>
                          <Badge variant="outline">
                            {text.total}: {driver.totalAssigned}
                          </Badge>
                          {driver.driverType === "linehaul" ? (
                            <Badge variant="secondary">Linehaul</Badge>
                          ) : null}
                          <Badge
                            variant={driver.warehouseId ? "outline" : "destructive"}
                            className="max-w-[220px] truncate"
                          >
                            {driver.warehouseId
                              ? driver.warehouseName
                                ? `${text.warehousePrefix}: ${driver.warehouseName}`
                                : text.warehouseAssigned
                              : text.noWarehouseBadge}
                          </Badge>
                          {driver.warehouseNames.length > 1 ? (
                            <Badge variant="outline" className="max-w-[220px] truncate">
                              +{driver.warehouseNames.length - 1} additional hubs
                            </Badge>
                          ) : null}
                          <DriverManifestButton
                            driverId={driver.id}
                            driverName={driver.name}
                            driverEmail={driver.email}
                            warehouseName={driver.warehouseName}
                            activeAssigned={driver.workload}
                          />
                          <EditDriverProfileDialog
                            driver={driver}
                            warehouses={warehousesQuery.data ?? []}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="rounded-2xl border-border/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{text.topWorkload}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {loading ? (
                  <>
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </>
                ) : topDrivers.length === 0 ? (
                  <div className="text-xs text-muted-foreground">
                    {text.noWorkloadData}
                  </div>
                ) : (
                  topDrivers.map((driver) => (
                    <div
                      key={driver.id}
                      className="flex items-center justify-between rounded-xl border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{driver.name}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {driver.email}
                        </div>
                      </div>
                      <Badge variant="secondary" className="rounded-full">
                        {driver.workload}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{text.quickActions}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button asChild className="w-full justify-start gap-2">
                  <Link href="/dashboard/manager/dispatch">
                    <Send className="h-4 w-4" />
                    {text.assignOrders}
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start gap-2">
                  <Link href="/dashboard/manager/orders">
                    <Truck className="h-4 w-4" />
                    {text.openOrdersTable}
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start gap-2">
                  <Link href="/dashboard/manager/users">
                    <Users className="h-4 w-4" />
                    {text.manageUsers}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
