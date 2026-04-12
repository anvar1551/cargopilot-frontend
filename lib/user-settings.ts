import type { Role } from "@/lib/auth";

export type UserSettings = {
  uiDensity: "comfortable" | "compact";
  autoRefreshSec: "off" | "15" | "30" | "60";
  notifyExceptions: boolean;
  notifyDelivery: boolean;
  notifyPayments: boolean;
  playScanSound: boolean;
  confirmBulkApply: boolean;
};

const STORAGE_KEY = "cp.user-settings.v1";

export const DEFAULT_USER_SETTINGS: UserSettings = {
  uiDensity: "comfortable",
  autoRefreshSec: "30",
  notifyExceptions: true,
  notifyDelivery: true,
  notifyPayments: false,
  playScanSound: false,
  confirmBulkApply: false,
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function loadUserSettings(): UserSettings {
  if (typeof window === "undefined") return DEFAULT_USER_SETTINGS;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_USER_SETTINGS;
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed)) return DEFAULT_USER_SETTINGS;

    return {
      uiDensity:
        parsed.uiDensity === "compact" ? "compact" : DEFAULT_USER_SETTINGS.uiDensity,
      autoRefreshSec:
        parsed.autoRefreshSec === "off" ||
        parsed.autoRefreshSec === "15" ||
        parsed.autoRefreshSec === "30" ||
        parsed.autoRefreshSec === "60"
          ? parsed.autoRefreshSec
          : DEFAULT_USER_SETTINGS.autoRefreshSec,
      notifyExceptions:
        typeof parsed.notifyExceptions === "boolean"
          ? parsed.notifyExceptions
          : DEFAULT_USER_SETTINGS.notifyExceptions,
      notifyDelivery:
        typeof parsed.notifyDelivery === "boolean"
          ? parsed.notifyDelivery
          : DEFAULT_USER_SETTINGS.notifyDelivery,
      notifyPayments:
        typeof parsed.notifyPayments === "boolean"
          ? parsed.notifyPayments
          : DEFAULT_USER_SETTINGS.notifyPayments,
      playScanSound:
        typeof parsed.playScanSound === "boolean"
          ? parsed.playScanSound
          : DEFAULT_USER_SETTINGS.playScanSound,
      confirmBulkApply:
        typeof parsed.confirmBulkApply === "boolean"
          ? parsed.confirmBulkApply
          : DEFAULT_USER_SETTINGS.confirmBulkApply,
    };
  } catch {
    return DEFAULT_USER_SETTINGS;
  }
}

export function saveUserSettings(settings: UserSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function roleSettingsDescription(role: Role) {
  switch (role) {
    case "manager":
      return "Control dispatch defaults, alerts, and operations behavior.";
    case "warehouse":
      return "Tune scan workflow and warehouse execution preferences.";
    case "driver":
      return "Configure delivery workflow and route-related preferences.";
    default:
      return "Manage your dashboard and notification preferences.";
  }
}
