import axios from "axios";
import { clearAuth, getToken } from "./auth";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

api.interceptors.request.use((config) => {
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
