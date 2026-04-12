// components/layout/DashboardShell.tsx
"use client";

import type { ReactNode } from "react";
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

  useEffect(() => {
    if (!hasActiveSession()) {
      clearAuth();
      if (pathname !== "/login") {
        const next = encodeURIComponent(pathname || "/dashboard");
        router.replace(`/login?next=${next}`);
      }
    }
  }, [pathname, router]);

  return (
    <div className="min-h-dvh bg-muted/30">
      <AppTopbar />

      <div className="w-full px-4 sm:px-6 lg:px-8">
        {isManager ? (
          <div
            className="grid gap-6"
            style={{
              gridTemplateColumns: isCollapsed ? "72px 1fr" : "16rem 1fr",
            }}
          >
            <aside className="min-w-0">
              <ManagerSidebar />
            </aside>

            <main className="min-w-0">{children}</main>
          </div>
        ) : (
          <main className="min-w-0">{children}</main>
        )}
      </div>
    </div>
  );
}
