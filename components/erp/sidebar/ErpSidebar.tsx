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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useErpSidebarStore } from "@/store/useErpSidebarStore";

import {
  Activity,
  Building2,
  CreditCard,
  ChevronDown,
  CircleHelp,
  Headset,
  LayoutDashboard,
  Map,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  PlugZap,
  Send,
  Settings,
  Truck,
  Users,
  Warehouse,
  Building,
} from "lucide-react";

type NavItem = {
  labelKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
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

const BILLING_ITEMS: NavItem[] = [
  { labelKey: "managerSidebar.billing.pricing", href: "/dashboard/manager/pricing", icon: CreditCard },
  { labelKey: "managerSidebar.billing.providers", href: "/dashboard/manager/payment-providers", icon: CreditCard },
  { labelKey: "managerSidebar.billing.integrations", href: "/dashboard/manager/integrations", icon: PlugZap },
];

const BUSINESS_ITEMS: NavItem[] = [
  { labelKey: "managerSidebar.business.overview", href: "/dashboard/manager/business", icon: Building2 },
  { labelKey: "managerSidebar.business.customers", href: "/dashboard/manager/business/customers", icon: Building2 },
  { labelKey: "managerSidebar.business.companies", href: "/dashboard/manager/business/companies", icon: Building },
  { labelKey: "managerSidebar.business.branches", href: "/dashboard/manager/business/branches", icon: Building2 },
  { labelKey: "managerSidebar.business.agents", href: "/dashboard/manager/business/agents", icon: Users },
  { labelKey: "managerSidebar.business.pickupPoints", href: "/dashboard/manager/business/pickup-points", icon: Building2 },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard/manager" || href === "/dashboard/manager/business") return pathname === href;
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
          ? "bg-gradient-to-r from-slate-900/80 via-slate-800/80 to-cyan-900/70 text-white shadow-[inset_3px_0_0_0_rgb(45_212_191),0_8px_20px_rgba(7,20,44,0.4)]"
          : "text-slate-200 hover:bg-white/10 hover:text-white",
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors",
          active ? "text-cyan-300" : "text-slate-300 group-hover:text-white",
        )}
      >
        <Icon className={cn("h-4 w-4", active ? "text-cyan-300" : "text-slate-300 group-hover:text-white")} />
      </span>

      {!collapsed ? <span className="truncate text-sm font-medium">{label}</span> : null}

      {!collapsed && item.href.endsWith("/support") ? (
        <span className="ml-auto rounded-md bg-cyan-400 px-1.5 py-0.5 text-[11px] font-semibold text-slate-950">
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

export default function ErpSidebar() {
  const pathname = usePathname();
  const { isCollapsed, toggle } = useErpSidebarStore();
  const { t } = useI18n();

  return (
    <TooltipProvider delayDuration={120}>
      <aside
        className={cn(
          "sticky top-0 flex h-dvh flex-col overflow-hidden rounded-br-[2rem] border-r border-slate-700/60 bg-[radial-gradient(circle_at_80%_0%,rgba(20,184,166,0.26),transparent_34%),linear-gradient(180deg,#071326_0%,#102038_55%,#0a3440_100%)] shadow-[18px_0_38px_rgba(7,19,38,0.18)]",
          isCollapsed ? "w-[76px]" : "w-[250px]",
        )}
      >
        <div
          className={cn(
            "relative px-4 pb-4 pt-6",
            isCollapsed ? "flex flex-col items-center gap-4" : "space-y-5",
          )}
        >
          <Link
            href="/dashboard/manager"
            className={cn(
              "flex min-w-0 items-center text-white",
              isCollapsed ? "justify-center" : "gap-3",
            )}
          >
            <img
              src="/cargopilot-logo-transparent.png"
              alt=""
              className={cn("shrink-0 object-contain drop-shadow-[0_10px_16px_rgba(20,184,166,0.25)]", isCollapsed ? "h-10 w-10" : "h-11 w-11")}
            />
            {!isCollapsed ? (
              <span className="truncate text-[25px] font-extrabold tracking-[-0.045em]">
                CargoPilot
              </span>
            ) : null}
          </Link>

          <div
            className={cn(
              "rounded-xl border border-white/10 bg-white/[0.055]",
              isCollapsed ? "flex h-10 w-10 items-center justify-center" : "flex h-10 items-center justify-end px-2",
            )}
          >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggle}
                className="h-8 w-8 rounded-md text-slate-300 hover:bg-white/10 hover:text-white"
                aria-label={isCollapsed ? t("managerSidebar.expand") : t("managerSidebar.collapse")}
              >
                {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {isCollapsed ? t("managerSidebar.expand") : t("managerSidebar.collapse")}
            </TooltipContent>
          </Tooltip>
          </div>
        </div>

        <nav className="flex-1 space-y-3 overflow-y-auto px-2 pb-4 pt-1">
          {!isCollapsed ? (
            <div className="space-y-1 border-b border-slate-700/50 pb-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="group flex w-full items-center gap-3 rounded-md bg-white/8 px-3 py-2.5 text-left text-slate-100 transition-all hover:bg-white/12"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-md text-cyan-300">
                      <Building2 className="h-4 w-4" />
                    </span>
                    <span className="flex-1 truncate text-sm font-medium">{t("managerSidebar.business.group")}</span>
                    <ChevronDown className="h-4 w-4 text-slate-300" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  side="right"
                  className="w-72 rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-2 text-slate-100 shadow-2xl"
                >
                  {BUSINESS_ITEMS.map((item) => {
                    const active = !item.disabled && isActive(pathname, item.href);
                    const Icon = item.icon;

                    if (item.disabled) {
                      return (
                        <DropdownMenuItem
                          key={item.labelKey}
                          className="cursor-not-allowed rounded-xl px-2 py-2 opacity-60 focus:bg-white/10"
                        >
                          <div className="flex w-full items-start gap-2.5">
                            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-200">{t(item.labelKey)}</p>
                              <p className="truncate text-xs text-slate-400">
                                {t(`managerSidebar.businessDesc.${item.labelKey.split(".").pop()}`)} - coming soon
                              </p>
                            </div>
                          </div>
                        </DropdownMenuItem>
                      );
                    }

                    return (
                      <DropdownMenuItem
                        key={item.href}
                        asChild
                        className={cn(
                          "rounded-xl px-2 py-2 focus:bg-white/10",
                          active ? "bg-cyan-500/15 text-cyan-200" : "text-slate-100",
                        )}
                      >
                        <Link href={item.href} className="flex w-full items-start gap-2.5">
                          <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", active ? "text-cyan-300" : "text-slate-300")} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{t(item.labelKey)}</p>
                            <p className="truncate text-xs text-slate-400">{t(`managerSidebar.businessDesc.${item.labelKey.split(".").pop()}`)}</p>
                          </div>
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}

          {!isCollapsed ? (
            <div className="space-y-1 border-b border-slate-700/50 pb-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="group flex w-full items-center gap-3 rounded-md bg-white/8 px-3 py-2.5 text-left text-slate-100 transition-all hover:bg-white/12"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-md text-cyan-300">
                      <CreditCard className="h-4 w-4" />
                    </span>
                    <span className="flex-1 truncate text-sm font-medium">{t("managerSidebar.billing.group")}</span>
                    <ChevronDown className="h-4 w-4 text-slate-300" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  side="right"
                  className="w-72 rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-2 text-slate-100 shadow-2xl"
                >
                  {BILLING_ITEMS.map((item) => {
                    const active = isActive(pathname, item.href);
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem
                        key={item.href}
                        asChild
                        className={cn(
                          "rounded-xl px-2 py-2 focus:bg-white/10",
                          active ? "bg-cyan-500/15 text-cyan-200" : "text-slate-100",
                        )}
                      >
                        <Link href={item.href} className="flex w-full items-start gap-2.5">
                          <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", active ? "text-cyan-300" : "text-slate-300")} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{t(item.labelKey)}</p>
                            <p className="truncate text-xs text-slate-400">{t(`managerSidebar.billingDesc.${item.labelKey.split(".").pop()}`)}</p>
                          </div>
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}

          {NAV_GROUPS.map((group) => (
            <div key={group.labelKey} className="space-y-1 border-b border-slate-700/50 pb-3 last:border-b-0">
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

        <div className="mt-auto border-t border-slate-700/50 p-3">
          {!isCollapsed ? (
            <div className="flex items-center gap-3 rounded-md px-2 py-2 text-sm text-slate-200">
              <CircleHelp className="h-5 w-5 text-slate-300" />
              <span className="min-w-0 flex-1 truncate">Help & Resources</span>
              <ChevronDown className="h-4 w-4 text-slate-300" />
            </div>
          ) : (
            <div className="flex justify-center">
              <CircleHelp className="h-5 w-5 text-slate-300" />
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
