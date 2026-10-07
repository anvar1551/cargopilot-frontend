/** Websocket-only Engine.IO v4 / Socket.IO default namespace; invalidation only. */
export function notificationFrame(
  frame: string,
): "open" | "ping" | "connected" | "invalidate" | "reject" | null {
  if (frame.length > 16384) return "reject";
  if (frame.startsWith("0")) {
    try {
      const v = JSON.parse(frame.slice(1));
      return typeof v.sid === "string" && Number.isFinite(v.pingInterval)
        ? "open"
        : "reject";
    } catch {
      return "reject";
    }
  }
  if (frame === "2") return "ping";
  if (frame.startsWith("40")) return "connected";
  if (frame.startsWith("44") || frame === "41") return "reject";
  if (frame.startsWith("42")) {
    try {
      const v = JSON.parse(frame.slice(2));
      return Array.isArray(v) &&
        ["driver:notification", "driver:notifications:unread-count"].includes(
          v[0],
        )
        ? "invalidate"
        : null;
    } catch {
      return "reject";
    }
  }
  return null;
}
export function connectNotificationFeed(args: {
  url: string;
  token: () => string | null;
  current: () => boolean;
  invalidate: () => void;
  socket?: (url: string) => WebSocket;
}) {
  let stopped = false,
    socket: WebSocket | null = null,
    timer: ReturnType<typeof setTimeout> | null = null,
    deadline: ReturnType<typeof setTimeout> | null = null,
    attempt = 0;
  const current = () => !stopped && args.current();
  const connect = () => {
    if (!current()) return;
    const token = args.token();
    if (!token) return;
    socket = (args.socket ?? ((url) => new WebSocket(url)))(args.url);
    const own = socket;
    deadline = setTimeout(() => own.close(), 10000);
    own.onmessage = (e) => {
      if (!current()) {
        own.close();
        return;
      }
      if (typeof e.data !== "string") {
        own.close();
        return;
      }
      const kind = notificationFrame(e.data);
      if (kind === "open") own.send(`40${JSON.stringify({ token })}`);
      if (kind === "ping") own.send("3");
      if (kind === "connected") {
        if (deadline) clearTimeout(deadline);
        deadline = null;
        attempt = 0;
        args.invalidate();
      }
      if (kind === "invalidate") args.invalidate();
      if (kind === "reject") {
        stopped = true;
        own.close();
      }
    };
    own.onerror = () => own.close();
    own.onclose = () => {
      if (deadline) clearTimeout(deadline);
      deadline = null;
      if (current())
        timer = setTimeout(
          connect,
          Math.min(30000, 2000 * 2 ** Math.min(attempt++, 4)),
        );
    };
  };
  connect();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    if (deadline) clearTimeout(deadline);
    socket?.close();
  };
}
