"use client";

import { useEffect, useMemo, useState } from "react";

import {
  DEFAULT_USER_SETTINGS,
  USER_SETTINGS_CHANGED_EVENT,
  loadUserSettings,
  type UserSettings,
} from "@/lib/user-settings";

export function getRealtimeFallbackMs(
  autoRefreshSec: UserSettings["autoRefreshSec"],
) {
  if (autoRefreshSec === "off") return false;
  const seconds = Number(autoRefreshSec);
  if (!Number.isFinite(seconds) || seconds <= 0) return false;
  return seconds * 1000;
}

export function useUserSettingsSnapshot() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);

  useEffect(() => {
    const refresh = () => setSettings(loadUserSettings());
    refresh();

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === "cp.user-settings.v1") refresh();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(USER_SETTINGS_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(USER_SETTINGS_CHANGED_EVENT, refresh);
    };
  }, []);

  return settings;
}

export function useRealtimeFallbackInterval({
  isPageVisible,
  realtimeConnected,
}: {
  isPageVisible: boolean;
  realtimeConnected: boolean;
}) {
  const settings = useUserSettingsSnapshot();

  return useMemo(() => {
    if (!isPageVisible || realtimeConnected) return false;
    return getRealtimeFallbackMs(settings.autoRefreshSec);
  }, [isPageVisible, realtimeConnected, settings.autoRefreshSec]);
}
