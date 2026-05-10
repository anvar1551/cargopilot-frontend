// components/layout/DashboardShell.tsx
"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams, useSelectedLayoutSegment } from "next/navigation";

import AppTopbar from "@/components/layout/AppTopbar";
import OrderDetailsView from "@/components/orders/OrderDetailsView";
import ManagerSidebar from "@/components/manager/sidebar/ManagerSidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { tryRefreshSession } from "@/lib/api";
import { clearAuth, hasActiveSession } from "@/lib/auth";
import { useManagerSidebarStore } from "@/store/useManagerSidebarStore"; // Zustand

export default function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const segment = useSelectedLayoutSegment();
  const isManager = segment === "manager";
  const orderModalId = searchParams.get("order");
  const [activeOrderModalId, setActiveOrderModalId] = useState<string | null>(orderModalId);
  const isDirectOrderDetailsPage = /^\/dashboard\/(manager|warehouse|customer)\/orders\/[^/]+$/i.test(
    pathname || "",
  );
  const showOrderModal = Boolean(activeOrderModalId) && !isDirectOrderDetailsPage;

  const isCollapsed = useManagerSidebarStore((s) => s.isCollapsed);
  const isMobileOpen = useManagerSidebarStore((s) => s.isMobileOpen);
  const setMobileOpen = useManagerSidebarStore((s) => s.setMobileOpen);

  const closeOrderModal = () => {
    setActiveOrderModalId(null);
    if (!pathname) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("order");
    const query = next.toString();
    const target = query ? `${pathname}?${query}` : pathname;

    // Avoid App Router navigation/refetch for modal-only query cleanup.
    if (typeof window !== "undefined") {
      const current = `${window.location.pathname}${window.location.search}`;
      if (current !== target) {
        window.history.replaceState(window.history.state, "", target);
      }
      return;
    }

    router.replace(target, { scroll: false });
  };

  const orderDetailsModalConfig =
    pathname?.startsWith("/dashboard/warehouse")
      ? {
          backHref: "/dashboard/warehouse",
          title: "Order Details (Warehouse)",
          showManagerActions: false,
        }
      : pathname?.startsWith("/dashboard/customer")
        ? {
            backHref: "/dashboard/customer/orders",
            title: "Order Details",
            showManagerActions: false,
          }
        : {
            backHref: "/dashboard/manager/orders",
            title: "Order Details (Manager)",
            showManagerActions: true,
          };

  useEffect(() => {
    let cancelled = false;
    const ensureSession = async () => {
      if (hasActiveSession()) return;
      const refreshed = await tryRefreshSession();
      if (cancelled || refreshed) return;
      clearAuth();
      if (pathname !== "/login") {
        const next = encodeURIComponent(pathname || "/dashboard");
        router.replace(`/login?next=${next}`);
      }
    };
    void ensureSession();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  useEffect(() => {
    setActiveOrderModalId(orderModalId);
  }, [orderModalId]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  return (
    <div className="min-h-dvh bg-muted/30">
      <AppTopbar />

      <div className="w-full">
        {isManager ? (
          <>
            {isMobileOpen ? (
              <div className="fixed inset-0 z-50 xl:hidden">
                <button
                  type="button"
                  className="absolute inset-0 bg-slate-950/20"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation"
                />
                <div className="absolute inset-y-0 left-0 w-[290px] max-w-[88vw]">
                  <ManagerSidebar />
                </div>
              </div>
            ) : null}

            <div
              className="grid gap-0 xl:grid-cols-[var(--manager-sidebar-width)_minmax(0,1fr)]"
              style={
                {
                  "--manager-sidebar-width": isCollapsed ? "72px" : "220px",
                } as CSSProperties
              }
            >
              <aside className="hidden min-w-0 xl:block">
                <ManagerSidebar />
              </aside>

              <main className="min-w-0">{children}</main>
            </div>
          </>
        ) : (
          <main className="min-w-0">{children}</main>
        )}
      </div>

      <Dialog open={showOrderModal} onOpenChange={(open) => (!open ? closeOrderModal() : null)}>
        <DialogContent className="h-[96dvh] w-[calc(100vw-0.75rem)] !max-w-none overflow-hidden rounded-2xl p-0 sm:w-[calc(100vw-1.5rem)] sm:!max-w-[96rem] xl:sm:!max-w-[106rem]">
          <DialogHeader className="sr-only">
            <DialogTitle>Order details</DialogTitle>
            <DialogDescription>
              Full order details modal with route, shipment, payment, and timeline tabs.
            </DialogDescription>
          </DialogHeader>
          {activeOrderModalId ? (
            <div className="h-full overflow-x-hidden overflow-y-auto">
              <OrderDetailsView
                orderId={activeOrderModalId}
                backHref={orderDetailsModalConfig.backHref}
                title={orderDetailsModalConfig.title}
                showManagerActions={orderDetailsModalConfig.showManagerActions}
                hideBackButton
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
