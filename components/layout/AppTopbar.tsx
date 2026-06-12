"use client";

import * as React from "react";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, MessageSquare, Search } from "lucide-react";
import { dashboardPathForUser, getUser } from "@/lib/auth";
import { useI18n } from "@/components/i18n/I18nProvider";

import UserMenu from "@/components/user/UserMenu";
import { cn } from "@/lib/utils";
import { useManagerSidebarStore } from "@/store/useManagerSidebarStore";

type TopbarProps = {
  title?: string;
  subtitle?: string;
  backHref?: string;
  actions?: React.ReactNode;
};

function defaultTitleFromPath(pathname: string, t: (key: string) => string) {
  if (pathname.includes("/dashboard/manager")) return t("topbar.section.manager");
  if (pathname.includes("/dashboard/customer")) return t("topbar.section.customer");
  if (pathname.includes("/dashboard/warehouse")) return t("topbar.section.warehouse");
  if (pathname.includes("/dashboard/driver")) return t("topbar.section.driver");
  return t("topbar.section.default");
}

export default function AppTopbar({
  title,
  subtitle,
  backHref,
  actions,
}: TopbarProps) {
  const pathname = usePathname();
  const { t } = useI18n();
  const toggleMobileSidebar = useManagerSidebarStore((s) => s.toggleMobile);
  const user = useSyncExternalStore(
    () => () => {},
    () => getUser(),
    () => null,
  );

  const computedTitle = title ?? defaultTitleFromPath(pathname, t);
  const isManagerPath = pathname.includes("/dashboard/manager");

  if (isManagerPath) {
    return (
      <header className="sticky top-0 z-40 w-full border-b bg-white">
        <div className="grid h-[66px] grid-cols-[minmax(0,15rem)_minmax(18rem,36rem)_minmax(0,1fr)] items-center gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-white xl:hidden"
              onClick={toggleMobileSidebar}
              aria-label={t("managerSidebar.expand")}
            >
              <Menu className="h-4 w-4" />
            </button>
            <Link href="/dashboard/manager" className="inline-flex min-w-0 items-center gap-2.5">
              <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
                <span className="absolute left-1 top-2 h-2.5 w-2.5 rounded-full border-2 border-teal-600" />
                <span className="absolute right-2 top-1 h-2 w-2 rounded-full bg-teal-600" />
                <span className="absolute bottom-2 left-3 h-2 w-2 rounded-full bg-teal-500" />
                <span className="absolute left-[14px] top-[13px] h-0.5 w-4 -rotate-45 rounded-full bg-teal-500" />
                <span className="absolute left-[10px] top-[21px] h-0.5 w-4 rotate-45 rounded-full bg-teal-500" />
              </span>
              <span className="truncate text-xl font-semibold tracking-tight text-slate-950">
                CargoPilot
              </span>
            </Link>
          </div>

          <div className="relative hidden w-full justify-self-center md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search shipments, orders, customers, drivers, warehouses..."
              className="h-9 w-full rounded-md border bg-white pl-9 pr-10 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border px-1.5 py-0.5 text-[10px] text-slate-400">
              /
            </span>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-4">
            <button type="button" className="relative text-slate-600">
              <Bell className="h-5 w-5" />
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                6
              </span>
            </button>
            <button type="button" className="text-slate-600">
              <MessageSquare className="h-5 w-5" />
            </button>
            <div className="hidden h-8 w-px bg-border sm:block" />
            <UserMenu />
          </div>
        </div>
      </header>
    );
  }

  if (!user) {
    return (
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="font-semibold tracking-tight">
            CargoPilot
          </Link>
          <UserMenu />
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 items-center justify-between px-3 sm:px-4">
        {/* Left side */}
        <div className="flex items-center gap-3 min-w-0">
          {isManagerPath ? (
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background xl:hidden"
              onClick={toggleMobileSidebar}
              aria-label={t("managerSidebar.expand")}
            >
              <Menu className="h-4 w-4" />
            </button>
          ) : null}
          {/* Brand */}
          <Link
            href={dashboardPathForUser(user)}
            className="shrink-0 font-semibold tracking-tight"
          >
            CargoPilot
          </Link>

          <div className="hidden h-5 w-px bg-border sm:block" />

          {/* Context */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium truncate">{computedTitle}</h2>

              {backHref ? (
                <Link
                  href={backHref}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  {t("common.back")}
                </Link>
              ) : null}
            </div>

            {subtitle ? (
              <p className="text-xs text-muted-foreground truncate">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>

        {/* Right side */}
        <div className={cn("flex shrink-0 items-center gap-2", actions ? "gap-3" : "")}>
          {actions ? (
            <div className="hidden sm:flex items-center gap-2">{actions}</div>
          ) : null}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
