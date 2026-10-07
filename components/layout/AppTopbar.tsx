"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Menu, MessageSquare } from "lucide-react";
import NotificationInbox from "@/components/workspace/NotificationInbox";
import { dashboardPathForUser, hasPermission } from "@/lib/auth";
import { useWorkspaceSession } from "@/lib/workspace";
import { useI18n } from "@/components/i18n/I18nProvider";

import UserMenu from "@/components/user/UserMenu";
import { fetchUnreadNotificationCount } from "@/lib/notifications";
import { useRealtimeFallbackInterval } from "@/lib/use-realtime-fallback";
import { cn } from "@/lib/utils";
import { useErpSidebarStore } from "@/store/useErpSidebarStore";
import { useSupportSummary } from "@/lib/use-support-summary";

type TopbarProps = {
  title?: string;
  subtitle?: string;
  backHref?: string;
  actions?: React.ReactNode;
};

function defaultTitleFromPath(pathname: string, t: (key: string) => string) {
  if (pathname.includes("/dashboard/manager"))
    return t("topbar.section.manager");
  if (pathname.includes("/dashboard/customer"))
    return t("topbar.section.customer");
  if (pathname.includes("/dashboard/warehouse"))
    return t("topbar.section.warehouse");
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
  const toggleMobileSidebar = useErpSidebarStore((s) => s.toggleMobile);
  const { user, context } = useWorkspaceSession();

  const computedTitle = title ?? defaultTitleFromPath(pathname, t);
  const isErpWorkspacePath = pathname.includes("/dashboard/manager");
  const notificationFallbackInterval = useRealtimeFallbackInterval({
    isPageVisible: true,
    realtimeConnected: false,
  });
  const unreadNotificationsQuery = useQuery({
    queryKey: ["notifications", "unread-count", context],
    queryFn: () => fetchUnreadNotificationCount(),
    enabled: Boolean(context) && hasPermission(user, "notifications.read"),
    staleTime: 30_000,
    refetchInterval: notificationFallbackInterval,
    retry: false,
  });
  const unreadCount = unreadNotificationsQuery.data ?? 0;
  const supportSummaryQuery = useSupportSummary({
    enabled: isErpWorkspacePath && hasPermission(user, "support.view"),
    userId: user?.id,
  });
  const supportOpenCount = supportSummaryQuery.data?.open ?? 0;

  if (isErpWorkspacePath) {
    return (
      <header className="sticky top-0 z-40 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="flex h-[72px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3 xl:hidden">
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-white xl:hidden"
              onClick={toggleMobileSidebar}
              aria-label={t("managerSidebar.expand")}
            >
              <Menu className="h-4 w-4" />
            </button>
            <Link
              href="/dashboard/manager"
              className="inline-flex min-w-0 items-center gap-2.5"
            >
              <Image
                src="/cargopilot-logo-transparent.png"
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 shrink-0 object-contain"
              />
              <span className="truncate text-xl font-semibold tracking-tight text-slate-950">
                CargoPilot
                <span className="block text-[11px] font-normal tracking-normal text-muted-foreground">
                  Company {user?.companyId?.slice(-8) ?? "unselected"}
                </span>
              </span>
            </Link>
          </div>

          <div
            className="hidden min-w-0 xl:block"
            title={`Company ${user?.companyId ?? "unselected"} · Tenant ${user?.tenantId ?? "unselected"}`}
          >
            <p className="text-xs text-muted-foreground">Selected company</p>
            <p className="mt-1 text-sm font-semibold">
              {user?.companyId?.slice(-8) ?? "Sign in to select"}{" "}
              <span className="ml-2 font-normal text-muted-foreground">
                Tenant {user?.tenantId?.slice(-8) ?? "—"}
              </span>
            </p>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-4">
            {hasPermission(user, "notifications.read") && <NotificationInbox unreadCount={unreadCount} />}
            <Link
              href="/dashboard/manager/support"
              className="relative text-slate-600 transition hover:text-slate-950"
              aria-label="Open support desk"
            >
              <MessageSquare className="h-5 w-5" />
              {supportOpenCount > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-500 px-1 text-[10px] font-semibold text-slate-950">
                  {supportOpenCount > 99 ? "99+" : supportOpenCount}
                </span>
              ) : null}
            </Link>
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
          {isErpWorkspacePath ? (
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
        <div
          className={cn(
            "flex shrink-0 items-center gap-2",
            actions ? "gap-3" : "",
          )}
        >
          {actions ? (
            <div className="hidden sm:flex items-center gap-2">{actions}</div>
          ) : null}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
