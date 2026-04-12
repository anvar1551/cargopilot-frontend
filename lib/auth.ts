export type Role = "customer" | "manager" | "warehouse" | "driver";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  warehouseId?: string | null;
  customerEntityId?: string | null;
};

const TOKEN_KEY = "token";
const USER_KEY = "user";

let cachedUserRaw: string | null | undefined = undefined;
let cachedUser: AuthUser | null = null;

function isBrowser() {
  return typeof window !== "undefined";
}

export function saveAuth(token: string, user: AuthUser) {
  if (!isBrowser()) return;
  console.log(user);
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  cachedUserRaw = JSON.stringify(user);
  cachedUser = user;
}

export function getToken(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const payload = window.atob(padded);
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Returns true when JWT has an exp claim and it is already expired. */
export function isTokenExpired(token: string | null | undefined): boolean {
  if (!token) return true;
  if (!isBrowser()) return false;
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  if (typeof exp !== "number") return false;
  return exp * 1000 <= Date.now();
}

export function getUser(): AuthUser | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(USER_KEY);

  // Keep snapshot reference stable when storage value is unchanged.
  if (raw === cachedUserRaw) return cachedUser;

  cachedUserRaw = raw;
  if (!raw) {
    cachedUser = null;
    return null;
  }

  try {
    cachedUser = JSON.parse(raw) as AuthUser;
  } catch {
    cachedUser = null;
  }

  return cachedUser;
}

export function clearAuth() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  cachedUserRaw = null;
  cachedUser = null;
}

/** Basic client-side session check (presence + non-expired JWT). */
export function hasActiveSession() {
  const token = getToken();
  const user = getUser();
  return Boolean(token && user && !isTokenExpired(token));
}

export function roleToDashboardPath(role: Role): string {
  switch (role) {
    case "manager":
      return "/dashboard/manager";
    case "warehouse":
      return "/dashboard/warehouse";
    case "driver":
      return "/dashboard/driver";
    default:
      return "/dashboard/customer";
  }
}
