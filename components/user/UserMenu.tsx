"use client";

import * as React from "react";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { clearAuth, getUser, roleToDashboardPath } from "@/lib/auth";
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
  const dashboardHref = roleToDashboardPath(user?.role ?? "customer");
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
          className="h-10 rounded-xl px-2 hover:bg-muted/50"
          aria-label={t("userMenu.open")}
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">
              {user?.name ? initials(user.name) : <UserIcon className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>

          <div className="ml-2 hidden flex-col items-start leading-tight sm:flex">
            <span className="text-sm font-medium">{user?.name ?? t("common.user")}</span>
            <span className="text-xs text-muted-foreground">{user?.email ?? "-"}</span>
          </div>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                {user?.name ?? t("common.user")}
              </div>
              <div className="truncate text-xs text-muted-foreground">
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
