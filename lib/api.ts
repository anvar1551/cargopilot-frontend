import axios from "axios";
import { clearAuth, getToken } from "./auth";

function isLocalhostHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function isIpv4Host(hostname: string) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
}

function deriveApiHost(protocol: string, hostname: string) {
  if (isLocalhostHost(hostname)) {
    return `${protocol}//${hostname}:4000`;
  }

  if (hostname.startsWith("api.")) {
    return `${protocol}//${hostname}`;
  }

  return `${protocol}//api.${hostname}`;
}

function resolveBaseUrl() {
  if (typeof window === "undefined") return "";

  const envBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";
  const { protocol, hostname } = window.location;
  const isLocalhost = isLocalhostHost(hostname);
  const normalizedEnvBaseUrl = envBaseUrl.replace(/\/+$/, "");
  const derivedApiHost = deriveApiHost(protocol, hostname);

  if (normalizedEnvBaseUrl) {
    const isRelativeEnvBaseUrl = normalizedEnvBaseUrl.startsWith("/");

    // Production uses a dedicated API subdomain. If an old relative `/api`
    // value is still baked into the build, route directly to the API host.
    if (!isLocalhost && isRelativeEnvBaseUrl && normalizedEnvBaseUrl === "/api") {
      return derivedApiHost;
    }

    // Guardrail: if someone accidentally sets a raw IP in production env,
    // force routing back to the domain-based API host.
    try {
      const parsed = new URL(normalizedEnvBaseUrl);
      const parsedIsIpv4 = isIpv4Host(parsed.hostname);
      const windowIsDomain = !isLocalhost && !isIpv4Host(hostname);

      if (windowIsDomain && parsedIsIpv4) {
        return derivedApiHost;
      }

      if (
        !isLocalhost &&
        protocol === "https:" &&
        parsed.protocol === "http:" &&
        !isLocalhostHost(parsed.hostname)
      ) {
        return `${derivedApiHost}${parsed.pathname === "/" ? "" : parsed.pathname}`;
      }

      return `${parsed.origin}${parsed.pathname === "/" ? "" : parsed.pathname}`;
    } catch {
      return normalizedEnvBaseUrl;
    }
  }

  return derivedApiHost;
}

const normalizedBaseUrl = resolveBaseUrl();

export const api = axios.create({
  baseURL: normalizedBaseUrl || undefined,
});

api.interceptors.request.use((config) => {
  const requestUrl = String(config.url ?? "");

  // Avoid `/api/api/...` when the base URL is already `/api` and callers use `/api/...`.
  if (normalizedBaseUrl.endsWith("/api") && requestUrl.startsWith("/api/")) {
    config.url = requestUrl.slice(4);
  }

  const token = typeof window !== "undefined" ? getToken() : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const reqUrl = String(error?.config?.url ?? "");
    const isLoginCall = reqUrl.includes("/api/auth/login");

    if (typeof window !== "undefined" && status === 401 && !isLoginCall) {
      clearAuth();
      if (window.location.pathname !== "/login") {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.replace(`/login?next=${next}`);
      }
    }

    return Promise.reject(error);
  },
);
