"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken, getUser, roleToDashboardPath } from "@/lib/auth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    const user = getUser();

    if (!token || !user) {
      router.replace("/login");
      return;
    }

    // Ensure user stays in correct role dashboard
    const expectedPath = roleToDashboardPath(user.role);
    if (!window.location.pathname.startsWith(expectedPath)) {
      router.replace(expectedPath);
    }
  }, [router]);

  return <div className="min-h-screen bg-muted">{children}</div>;
}
