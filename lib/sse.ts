import { api, tryRefreshSession } from "@/lib/api";
import { getToken } from "@/lib/auth";

type SseFrame = {
  event: string;
  data: string;
  id: string | null;
};

type SubscribeAuthenticatedSseArgs = {
  path: string;
  lastEventIdKey: string;
  onReady?: (payload: unknown) => void;
  onEvent: (frame: SseFrame) => void;
  onError?: (error: Error) => void;
  retryBaseMs?: number;
  retryMaxMs?: number;
  pauseWhenHidden?: boolean;
};

export function buildApiUrl(path: string) {
  const base = String(api.defaults.baseURL ?? "").trim();
  if (!base) return path;

  const normalizedBase = base.replace(/\/+$/, "");
  if (normalizedBase.endsWith("/api") && path.startsWith("/api/")) {
    return `${normalizedBase}${path.slice(4)}`;
  }
  return `${normalizedBase}${path.startsWith("/") ? path : `/${path}`}`;
}

function readLastEventId(key: string) {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(key);
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

function writeLastEventId(key: string, value: string | null) {
  if (typeof window === "undefined" || !value) return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Session storage can be unavailable in hardened browser modes.
  }
}

function parseSseFrame(frameRaw: string): SseFrame {
  const lines = frameRaw.split(/\r?\n/);
  let event = "message";
  let id: string | null = null;
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      event = line.slice(6).trim() || "message";
      continue;
    }
    if (line.startsWith("id:")) {
      id = line.slice(3).trim() || null;
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  return {
    event,
    data: dataLines.length > 0 ? dataLines.join("\n") : "",
    id,
  };
}

function safeJsonParse(data: string) {
  if (!data) return {};
  try {
    return JSON.parse(data) as unknown;
  } catch {
    return {};
  }
}

function shouldReconnectForStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export function subscribeAuthenticatedSse(args: SubscribeAuthenticatedSseArgs) {
  if (typeof window === "undefined") return () => undefined;

  const endpoint = buildApiUrl(args.path);
  const abortController = new AbortController();
  const decoder = new TextDecoder();
  const retryBaseMs = args.retryBaseMs ?? 900;
  const retryMaxMs = args.retryMaxMs ?? 12_000;
  const pauseWhenHidden = args.pauseWhenHidden ?? true;

  let closed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;

  const scheduleReconnect = (delayMs?: number) => {
    if (closed || reconnectTimer) return;
    if (pauseWhenHidden && typeof document !== "undefined" && document.visibilityState === "hidden") {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, Math.max(delayMs ?? 5_000, 5_000));
      return;
    }
    const baseDelay = delayMs ?? Math.min(retryMaxMs, retryBaseMs + attempt * 700);
    const jitter = Math.floor(Math.random() * Math.max(50, Math.floor(baseDelay * 0.15)));
    const delay = Math.min(retryMaxMs, baseDelay + jitter);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connect();
    }, delay);
  };

  const connect = async () => {
    if (closed) return;

    try {
      let token = getToken();
      if (!token) {
        const refreshed = await tryRefreshSession();
        if (!refreshed) throw new Error("SSE_AUTH_MISSING");
        token = getToken();
      }
      if (!token) throw new Error("SSE_AUTH_MISSING");

      const lastEventId = readLastEventId(args.lastEventIdKey);
      const headers: Record<string, string> = {
        Accept: "text/event-stream",
        Authorization: `Bearer ${token}`,
        "Cache-Control": "no-cache",
      };
      if (lastEventId) headers["Last-Event-ID"] = lastEventId;

      const response = await fetch(endpoint, {
        method: "GET",
        headers,
        cache: "no-store",
        signal: abortController.signal,
      });

      if (response.status === 401) {
        const refreshed = await tryRefreshSession();
        if (refreshed) {
          throw new Error("SSE_RETRY_AUTH");
        }
        throw new Error("SSE_AUTH_EXPIRED");
      }

      if (!response.ok) {
        if (!shouldReconnectForStatus(response.status)) {
          args.onError?.(new Error(`SSE_NON_RETRYABLE_${response.status}`));
          return;
        }
        throw new Error(`SSE_UNAVAILABLE_${response.status}`);
      }
      if (!response.body) throw new Error("SSE_EMPTY_BODY");

      attempt = 0;
      const reader = response.body.getReader();
      let buffer = "";

      while (!closed) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let delimiterIndex = buffer.search(/\r?\n\r?\n/);

        while (delimiterIndex >= 0) {
          const frameRaw = buffer.slice(0, delimiterIndex);
          const consumedLength =
            buffer[delimiterIndex] === "\r" && buffer[delimiterIndex + 1] === "\n" ? 4 : 2;
          buffer = buffer.slice(delimiterIndex + consumedLength);

          const frame = parseSseFrame(frameRaw);
          if (frame.id) writeLastEventId(args.lastEventIdKey, frame.id);
          if (frame.event === "ready") {
            args.onReady?.(safeJsonParse(frame.data));
          } else {
            args.onEvent(frame);
          }

          delimiterIndex = buffer.search(/\r?\n\r?\n/);
        }
      }

      if (!closed) {
        attempt += 1;
        scheduleReconnect(Math.min(10_000, 800 + attempt * 500));
      }
    } catch (error) {
      if (closed) return;
      const err = error instanceof Error ? error : new Error("SSE connection failed");
      if (err.message === "SSE_RETRY_AUTH") {
        scheduleReconnect(300);
        return;
      }
      if (err.message === "SSE_AUTH_EXPIRED") {
        scheduleReconnect(30_000);
        return;
      }
      args.onError?.(err);
      attempt += 1;
      scheduleReconnect();
    }
  };

  void connect();

  return () => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    abortController.abort();
  };
}
