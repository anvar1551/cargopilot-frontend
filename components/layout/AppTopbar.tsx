"use client";

import * as React from "react";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getUser } from "@/lib/auth";
import { useI18n } from "@/components/i18n/I18nProvider";

import UserMenu from "@/components/user/UserMenu";
import { cn } from "@/lib/utils";

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
  const user = useSyncExternalStore(
    () => () => {},
    () => getUser(),
    () => null,
  );

  const computedTitle = title ?? defaultTitleFromPath(pathname, t);

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
      <div className="mx-auto flex h-14  items-center justify-between px-4">
        {/* Left side */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Brand */}
          <Link
            href={`/dashboard/${user.role}`}
            className="font-semibold tracking-tight"
          >
            CargoPilot
          </Link>

          <div className="h-5 w-px bg-border" />

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
        <div className={cn("flex items-center gap-2", actions ? "gap-3" : "")}>
          {actions ? (
            <div className="hidden sm:flex items-center gap-2">{actions}</div>
          ) : null}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
