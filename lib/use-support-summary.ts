"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchSupportSummary, subscribeSupportStream } from "@/lib/support";
import { useRealtimeFallbackInterval } from "@/lib/use-realtime-fallback";

export const supportSummaryQueryKey = (userId?: string | null) => [
  "support",
  "summary",
  userId ?? "anonymous",
];

export function useSupportSummary({
  enabled,
  userId,
  realtime = false,
}: {
  enabled: boolean;
  userId?: string | null;
  realtime?: boolean;
}) {
  const queryClient = useQueryClient();
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const fallbackInterval = useRealtimeFallbackInterval({
    isPageVisible: true,
    realtimeConnected: realtime && realtimeConnected,
  });
  const query = useQuery({
    queryKey: supportSummaryQueryKey(userId),
    queryFn: fetchSupportSummary,
    enabled: enabled && Boolean(userId),
    staleTime: 15_000,
    refetchInterval: fallbackInterval,
    retry: false,
  });

  useEffect(() => {
    if (!enabled || !userId || !realtime) return;
    return subscribeSupportStream({
      onReady: () => setRealtimeConnected(true),
      onRefresh: () => {
        void queryClient.invalidateQueries({ queryKey: supportSummaryQueryKey(userId) });
      },
      onError: () => setRealtimeConnected(false),
    });
  }, [enabled, queryClient, realtime, userId]);

  return query;
}
