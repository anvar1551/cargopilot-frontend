"use client";

import * as React from "react";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Bell, Menu, MessageSquare } from "lucide-react";
import { dashboardPathForUser, getUser } from "@/lib/auth";
import { useI18n } from "@/components/i18n/I18nProvider";

import UserMenu from "@/components/user/UserMenu";
import { fetchUnreadNotificationCount } from "@/lib/notifications";
import { useRealtimeFallbackInterval } from "@/lib/use-realtime-fallback";
import { cn } from "@/lib/utils";
import { useErpSidebarStore } from "@/store/useErpSidebarStore";

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
  const user = useSyncExternalStore(
    () => () => {},
    () => getUser(),
    () => null,
  );

  const computedTitle = title ?? defaultTitleFromPath(pathname, t);
  const isErpWorkspacePath = pathname.includes("/dashboard/manager");
  const notificationFallbackInterval = useRealtimeFallbackInterval({
    isPageVisible: true,
    realtimeConnected: false,
  });
  const unreadNotificationsQuery = useQuery({
    queryKey: ["notifications", "unread-count", user?.id],
    queryFn: () => fetchUnreadNotificationCount(),
    enabled: Boolean(user?.id),
    staleTime: 30_000,
    refetchInterval: notificationFallbackInterval,
    retry: false,
  });
  const unreadCount = unreadNotificationsQuery.data ?? 0;

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
              <img
                src="/cargopilot-logo-transparent.png"
                alt=""
                className="h-9 w-9 shrink-0 object-contain"
              />
              <span className="truncate text-xl font-semibold tracking-tight text-slate-950">
                CargoPilot
              </span>
            </Link>
          </div>

          <div className="hidden min-w-0 xl:block" />

          <div className="flex shrink-0 items-center justify-end gap-4">
            <button type="button" className="relative text-slate-600">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
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
