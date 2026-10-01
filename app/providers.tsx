"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { useEffect, useSyncExternalStore } from "react";
import { authEpoch, subscribeAuth, observeAuthStorage } from "@/lib/auth";

export default function Providers({ children }: { children: React.ReactNode }) {
  const epoch = useSyncExternalStore(subscribeAuth, authEpoch, () => "server");
  useEffect(() => {
    const stop = subscribeAuth(() => { void queryClient.cancelQueries(); queryClient.clear(); });
    const storage = observeAuthStorage();
    return () => { stop(); storage(); };
  }, []);
  return (
    <QueryClientProvider key={epoch} client={queryClient}>
      <I18nProvider>{children}</I18nProvider>
    </QueryClientProvider>
  );
}
