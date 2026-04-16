"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useI18n } from "@/components/i18n/I18nProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useManagerSidebarStore } from "@/store/useManagerSidebarStore";

import {
  Building2,
  CircleDollarSign,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Package,
  Send,
  Settings,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";

type NavItem = {
  labelKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavGroup = {
  labelKey: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: "managerSidebar.group.overview",
    items: [
      {
        labelKey: "managerSidebar.item.dashboard",
        href: "/dashboard/manager",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    labelKey: "managerSidebar.group.orders",
    items: [
      {
        labelKey: "managerSidebar.item.manageOrders",
        href: "/dashboard/manager/orders",
        icon: Package,
      },
      {
        labelKey: "managerSidebar.item.dispatchCenter",
        href: "/dashboard/manager/dispatch",
        icon: Send,
      },
    ],
  },
  {
    labelKey: "managerSidebar.group.operations",
    items: [
      {
        labelKey: "managerSidebar.item.drivers",
        href: "/dashboard/manager/drivers",
        icon: Truck,
      },
      {
        labelKey: "managerSidebar.item.warehouses",
        href: "/dashboard/manager/warehouses",
        icon: Warehouse,
      },
    ],
  },
  {
    labelKey: "managerSidebar.group.admin",
    items: [
      {
        labelKey: "managerSidebar.item.customers",
        href: "/dashboard/manager/customers",
        icon: Building2,
      },
      {
        labelKey: "managerSidebar.item.pricing",
        href: "/dashboard/manager/pricing",
        icon: CircleDollarSign,
      },
      {
        labelKey: "managerSidebar.item.createUser",
        href: "/dashboard/manager/users",
        icon: Users,
      },
      {
        labelKey: "managerSidebar.item.settings",
        href: "/dashboard/manager/settings",
        icon: Settings,
      },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard/manager") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  collapsed,
  active,
  label,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
  label: string;
}) {
  const Icon = item.icon;

  const content = (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center rounded-xl transition-all",
        collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-2.5 py-2",
        active
          ? "bg-primary/12 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.18)]"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors",
          active
            ? "border-primary/30 bg-primary/10"
            : "border-border/70 bg-background group-hover:border-border",
        )}
      >
        <Icon
          className={cn(
            "h-4 w-4",
            active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
          )}
        />
      </span>

      {!collapsed ? <span className="truncate text-sm font-medium">{label}</span> : null}

      {active && !collapsed ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" /> : null}
    </Link>
  );

  if (!collapsed) return content;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="right" className="rounded-xl">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export default function ManagerSidebar() {
  const pathname = usePathname();
  const { isCollapsed, toggle } = useManagerSidebarStore();
  const { t } = useI18n();

  return (
    <TooltipProvider delayDuration={120}>
      <aside
        className={cn(
          "sticky top-0 flex h-dvh flex-col border-r bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70",
          isCollapsed ? "w-[84px]" : "w-[280px]",
        )}
      >
        <div className="px-3 pb-3 pt-4">
          <div
            className={cn(
              "rounded-2xl border border-border/70 bg-gradient-to-br from-background to-muted/30",
              isCollapsed ? "p-2.5" : "p-3",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <Link
                href="/dashboard/manager"
                className={cn(
                  "inline-flex items-center gap-2.5",
                  isCollapsed && "w-full justify-center",
                )}
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-xs font-semibold text-primary">
                  CP
                </span>
                {!isCollapsed ? (
                  <span className="space-y-0.5">
                    <span className="block text-sm font-semibold leading-none">
                      {t("common.role.manager")}
                    </span>
                    <span className="block text-[11px] leading-none text-muted-foreground">
                      {t("managerSidebar.consoleTitle")}
                    </span>
                  </span>
                ) : null}
              </Link>

              {!isCollapsed ? (
                <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px] uppercase">
                  {t("managerSidebar.adminBadge")}
                </Badge>
              ) : null}
            </div>

            {!isCollapsed ? <Separator className="my-3" /> : null}

            <div className={cn("flex", isCollapsed ? "justify-center" : "justify-end")}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggle}
                className="h-8 w-8 rounded-lg"
                aria-label={isCollapsed ? t("managerSidebar.expand") : t("managerSidebar.collapse")}
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.labelKey} className="space-y-1.5">
              {!isCollapsed ? (
                <div className="px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t(group.labelKey)}
                </div>
              ) : null}
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    collapsed={isCollapsed}
                    active={isActive(pathname, item.href)}
                    label={t(item.labelKey)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 pt-2">
          {!isCollapsed ? (
            <div className="rounded-2xl border border-border/70 bg-muted/25 px-3 py-3 text-xs text-muted-foreground">
              {t("managerSidebar.hint")}
            </div>
          ) : (
            <div className="flex justify-center">
              <Badge variant="outline" className="rounded-full text-[10px]">
                MGR
              </Badge>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
