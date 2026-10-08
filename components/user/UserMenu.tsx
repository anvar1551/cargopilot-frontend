"use client";

import * as React from "react";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { clearAuth, dashboardPathForUser, getUser } from "@/lib/auth";
import { useI18n } from "@/components/i18n/I18nProvider";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  LayoutDashboard,
  LogOut,
  Settings,
  User as UserIcon,
} from "lucide-react";

function initials(name?: string) {
  const value = String(name || "").trim();
  if (!value) return "U";
  const parts = value.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join("");
}

export default function UserMenu() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const user = useSyncExternalStore(
    () => () => {},
    () => getUser(),
    () => null,
  );
  const dashboardHref = dashboardPathForUser(user);
  const settingsHref = `${dashboardHref}/settings`;

  const onLogout = async () => {
    clearAuth();
    queryClient.clear();
    router.replace("/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto min-h-10 min-w-0 max-w-full whitespace-normal rounded-xl px-2 py-2 hover:bg-muted/50"
          aria-label={t("userMenu.open")}
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="text-xs">
              {user?.name ? initials(user.name) : <UserIcon className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>

          <div className="ml-2 hidden min-w-0 max-w-64 flex-col items-start text-left leading-tight [overflow-wrap:anywhere] sm:flex">
            <span className="text-sm font-medium">{user?.name ?? t("common.user")}</span>
            <span className="text-xs text-muted-foreground">{user?.email ?? "-"}</span>
          </div>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="max-h-[calc(100dvh-2rem)] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto">
        <DropdownMenuLabel className="space-y-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold [overflow-wrap:anywhere]">
                {user?.name ?? t("common.user")}
              </div>
              <div className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                {user?.email ?? "-"}
              </div>
            </div>

            {user?.role ? (
              <Badge variant="secondary" className="capitalize">
                {t(`common.role.${user.role}`)}
              </Badge>
            ) : null}
          </div>

          {user?.warehouseId ? (
            <div className="pt-2 text-xs text-muted-foreground">
              {t("userMenu.warehouseLinked")}
            </div>
          ) : null}
        </DropdownMenuLabel>

        <Separator />

        <div className="px-2 py-2">
          <LanguageSwitcher showLabel compact />
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href={dashboardHref} className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            {t("common.dashboard")}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem disabled className="flex items-center gap-2">
          <UserIcon className="h-4 w-4" />
          {t("userMenu.profileSoon")}
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href={settingsHref} className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {t("common.settings")}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={onLogout} className="flex items-center gap-2">
          <LogOut className="h-4 w-4" />
          {t("common.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
