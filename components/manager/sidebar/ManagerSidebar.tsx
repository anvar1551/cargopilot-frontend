"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useI18n } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useManagerSidebarStore } from "@/store/useManagerSidebarStore";

import {
  Activity,
  Building2,
  CircleDollarSign,
  ChevronDown,
  CircleHelp,
  Headset,
  LayoutDashboard,
  Map,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
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
      {
        labelKey: "managerSidebar.item.analytics",
        href: "/dashboard/manager/analytics",
        icon: Activity,
      },
      {
        labelKey: "managerSidebar.item.liveMap",
        href: "/dashboard/manager/live-map",
        icon: Map,
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
      {
        labelKey: "managerSidebar.item.support",
        href: "/dashboard/manager/support",
        icon: Headset,
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
        "group relative flex items-center rounded-md transition-all",
        collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
        active
          ? "bg-teal-50 text-teal-700 shadow-[inset_3px_0_0_0_rgb(13_148_136)]"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors",
          active
            ? "text-teal-700"
            : "text-slate-500 group-hover:text-slate-950",
        )}
      >
        <Icon
          className={cn(
            "h-4 w-4",
            active ? "text-teal-700" : "text-slate-500 group-hover:text-slate-950",
          )}
        />
      </span>

      {!collapsed ? <span className="truncate text-sm font-medium">{label}</span> : null}

      {!collapsed && item.href.endsWith("/support") ? (
        <span className="ml-auto rounded-md bg-teal-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
          4
        </span>
      ) : null}
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
          "sticky top-0 flex h-dvh flex-col border-r bg-white",
          isCollapsed ? "w-[72px]" : "w-[220px]",
        )}
      >
        <div className={cn("border-b px-2 py-3", isCollapsed ? "flex justify-center" : "flex justify-end")}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggle}
                className="h-8 w-8 rounded-md text-slate-500 hover:bg-slate-50 hover:text-slate-950"
                aria-label={isCollapsed ? t("managerSidebar.expand") : t("managerSidebar.collapse")}
              >
                {isCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {isCollapsed ? t("managerSidebar.expand") : t("managerSidebar.collapse")}
            </TooltipContent>
          </Tooltip>
        </div>

        <nav className="flex-1 space-y-3 overflow-y-auto px-2 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.labelKey} className="space-y-1 border-b pb-3 last:border-b-0">
              {!isCollapsed ? null : null}
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

        <div className="mt-auto border-t p-3">
          {!isCollapsed ? (
            <div className="flex items-center gap-3 rounded-md px-2 py-2 text-sm text-slate-600">
              <CircleHelp className="h-5 w-5 text-slate-500" />
              <span className="min-w-0 flex-1 truncate">Help & Resources</span>
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </div>
          ) : (
            <div className="flex justify-center">
              <CircleHelp className="h-5 w-5 text-slate-500" />
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
