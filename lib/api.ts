import axios from "axios";
import { clearAuth, getToken } from "./auth";

function resolveBaseUrl() {
  const envBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";
  if (envBaseUrl) return envBaseUrl.replace(/\/+$/, "");

  if (typeof window === "undefined") return "";

  const { protocol, hostname } = window.location;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

  if (isLocalhost) {
    return `${protocol}//${hostname}:4000`;
  }

  if (hostname.startsWith("api.")) {
    return `${protocol}//${hostname}`;
  }

  return `${protocol}//api.${hostname}`;
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
