// components/layout/DashboardShell.tsx
"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter, useSelectedLayoutSegment } from "next/navigation";

import AppTopbar from "@/components/layout/AppTopbar";
import ManagerSidebar from "@/components/manager/sidebar/ManagerSidebar";
import { clearAuth, hasActiveSession } from "@/lib/auth";
import { useManagerSidebarStore } from "@/store/useManagerSidebarStore"; // Zustand

export default function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const segment = useSelectedLayoutSegment();
  const isManager = segment === "manager";

  const isCollapsed = useManagerSidebarStore((s) => s.isCollapsed);
  const isMobileOpen = useManagerSidebarStore((s) => s.isMobileOpen);
  const setMobileOpen = useManagerSidebarStore((s) => s.setMobileOpen);

  useEffect(() => {
    if (!hasActiveSession()) {
      clearAuth();
      if (pathname !== "/login") {
        const next = encodeURIComponent(pathname || "/dashboard");
        router.replace(`/login?next=${next}`);
      }
    }
  }, [pathname, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  return (
    <div className="min-h-dvh bg-muted/30">
      <AppTopbar />

      <div className="w-full px-3 sm:px-6 lg:px-8">
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
              className="grid gap-6 xl:grid-cols-[var(--manager-sidebar-width)_minmax(0,1fr)]"
              style={
                {
                  "--manager-sidebar-width": isCollapsed ? "72px" : "16rem",
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
    </div>
  );
}
