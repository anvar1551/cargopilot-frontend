export type Role = "customer" | "manager" | "warehouse" | "driver";
export type ScopeType =
  | "company"
  | "branch"
  | "warehouse"
  | "agent"
  | "pickup_point"
  | "carrier"
  | "client";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  membershipId?: string | null;
  companyId?: string | null;
  branchId?: string | null;
  roleCodes?: string[];
  permissionCodes?: string[];
  scopes?: Array<{
    scopeType: ScopeType;
    scopeRefId: string;
  }>;
  warehouseId?: string | null;
  customerEntityId?: string | null;
};

const TOKEN_KEY = "token";
const USER_KEY = "user";
const REFRESH_TOKEN_KEY = "refreshToken";

let cachedUserRaw: string | null | undefined = undefined;
let cachedUser: AuthUser | null = null;

function normalizeRole(role: unknown): Role {
  const value = String(role ?? "")
    .trim()
    .toLowerCase();
  switch (value) {
    case "manager":
    case "admin":
    case "super_admin":
    case "superadmin":
    case "owner":
      return "manager";
    case "warehouse":
    case "pickup_point":
    case "pickpoint":
      return "warehouse";
    case "driver":
    case "courier":
      return "driver";
    case "customer":
      return "customer";
    default:
      return "customer";
  }
}

function deriveRoleFromCodes(input: unknown): Role {
  if (!Array.isArray(input)) return "customer";
  const codes = input
    .map((item) =>
      String(item ?? "")
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);
  if (codes.some(isErpWorkspaceRoleCode)) {
    return "manager";
  }
  if (codes.some(isWarehouseWorkspaceRoleCode)) {
    return "warehouse";
  }
  if (
    codes.some(
      (code) =>
        code === "driver" ||
        code.includes("driver") ||
        code.includes("courier"),
    )
  ) {
    return "driver";
  }
  if (codes.includes("customer") || codes.includes("client")) {
    return "customer";
  }
  return "customer";
}

function isErpWorkspaceRoleCode(code: string) {
  return (
    code === "admin" ||
    code === "super_admin" ||
    code === "superadmin" ||
    code === "owner" ||
    code === "manager" ||
    code === "branch_manager" ||
    code === "accountant" ||
    code === "dispatcher" ||
    code === "support_agent"
  );
}

function isWarehouseWorkspaceRoleCode(code: string) {
  return (
    code === "warehouse" ||
    code.includes("warehouse") ||
    code === "pickup_point" ||
    code.includes("pickup_point") ||
    code.includes("pickpoint")
  );
}

function normalizeAuthUser(user: unknown): AuthUser {
  const raw = (user ?? {}) as Record<string, unknown>;
  const permissionCodes = Array.isArray(raw.permissionCodes)
    ? raw.permissionCodes
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
    : Array.isArray(raw.permissions)
      ? raw.permissions
          .map((item) =>
            typeof item === "string"
              ? item
              : String((item as Record<string, unknown> | null)?.code ?? ""),
          )
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
  const roleCodes = Array.isArray(raw.roleCodes)
    ? raw.roleCodes
        .map((item) =>
          String(item ?? "")
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean)
    : Array.isArray(raw.roles)
      ? raw.roles
          .map((item) =>
            typeof item === "string"
              ? item
              : String((item as Record<string, unknown> | null)?.code ?? ""),
          )
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean)
      : [];
  const scopes = Array.isArray(raw.scopes)
    ? raw.scopes
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const typed = item as Record<string, unknown>;
          const scopeType = String(typed.scopeType ?? "")
            .trim()
            .toLowerCase();
          const scopeRefId = String(typed.scopeRefId ?? "").trim();
          if (!scopeType || !scopeRefId) return null;
          return {
            scopeType: scopeType as ScopeType,
            scopeRefId,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];
  const rawRole =
    (roleCodes.length > 0 ? deriveRoleFromCodes(roleCodes) : null) ??
    raw.role ??
    "customer";

  return {
    id: String(raw.id ?? raw.userId ?? ""),
    name: String(raw.name ?? ""),
    email: String(raw.email ?? ""),
    role: normalizeRole(rawRole),
    membershipId: raw.membershipId == null ? null : String(raw.membershipId),
    companyId: raw.companyId == null ? null : String(raw.companyId),
    branchId: raw.branchId == null ? null : String(raw.branchId),
    roleCodes,
    permissionCodes,
    scopes,
    warehouseId:
      raw.warehouseId === undefined ? null : (raw.warehouseId as string | null),
    customerEntityId:
      raw.customerEntityId === undefined
        ? null
        : (raw.customerEntityId as string | null),
  };
}

function isBrowser() {
  return typeof window !== "undefined";
}

export function saveAuth(
  token: string,
  user: unknown,
  options?: { refreshToken?: string | null },
) {
  if (!isBrowser()) return;
  const normalizedUser = normalizeAuthUser(user);
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
  if (
    typeof options?.refreshToken === "string" &&
    options.refreshToken.trim()
  ) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, options.refreshToken.trim());
  }
  cachedUserRaw = JSON.stringify(normalizedUser);
  cachedUser = normalizedUser;
}

export function getToken(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  if (!isBrowser()) return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function getRefreshToken(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(refreshToken: string) {
  if (!isBrowser()) return;
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
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
    const parsed = JSON.parse(raw) as unknown;
    cachedUser = normalizeAuthUser(parsed);
    cachedUserRaw = JSON.stringify(cachedUser);
    window.localStorage.setItem(USER_KEY, cachedUserRaw);
  } catch {
    cachedUser = null;
  }

  return cachedUser;
}

export function clearAuth() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
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

export function hasPermission(
  user: AuthUser | null | undefined,
  permission: string,
): boolean {
  if (!user || !permission) return false;
  const set = new Set((user.permissionCodes ?? []).map((item) => item.trim()));
  return set.has(permission);
}

function firstScopeRef(
  user: AuthUser | null | undefined,
  scopeTypes: ScopeType[],
) {
  if (!user?.scopes?.length) return null;
  const accepted = new Set(scopeTypes);
  return (
    user.scopes.find((scope) => accepted.has(scope.scopeType))?.scopeRefId ??
    null
  );
}

export function getPrimaryWarehouseId(user: AuthUser | null | undefined) {
  return (
    user?.warehouseId ?? firstScopeRef(user, ["warehouse", "pickup_point"])
  );
}

export function getPrimaryCustomerEntityId(user: AuthUser | null | undefined) {
  return user?.customerEntityId ?? firstScopeRef(user, ["client"]);
}

export function dashboardPathForUser(
  user: AuthUser | null | undefined,
): string {
  if (!user) return "/dashboard/customer";
  const roleCodes = user.roleCodes ?? [];
  const hasErpWorkspaceRole = roleCodes.some(isErpWorkspaceRoleCode);
  const hasWarehouseWorkspaceRole = roleCodes.some(
    isWarehouseWorkspaceRoleCode,
  );

  if (hasWarehouseWorkspaceRole && !hasErpWorkspaceRole) {
    return "/dashboard/warehouse";
  }
  if (hasErpWorkspaceRole) {
    return "/dashboard/manager";
  }
  if (
    user.role !== "manager" &&
    (getPrimaryWarehouseId(user) ||
      hasPermission(user, "warehouse.scanIn") ||
      hasPermission(user, "warehouse.scanOut"))
  ) {
    return "/dashboard/warehouse";
  }
  if (
    hasPermission(user, "drivers.manage") ||
    hasPermission(user, "shipment.assignCourier") ||
    hasPermission(user, "support.assign") ||
    hasPermission(user, "finance.viewLedger")
  ) {
    return "/dashboard/manager";
  }
  if (getPrimaryWarehouseId(user) || hasPermission(user, "warehouse.scanIn")) {
    return "/dashboard/warehouse";
  }
  if (
    hasPermission(user, "drivers.telemetry") ||
    (user.roleCodes ?? []).includes("driver")
  ) {
    return "/dashboard/driver";
  }
  return roleToDashboardPath(user.role);
}
