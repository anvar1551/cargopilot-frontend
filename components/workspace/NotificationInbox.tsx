"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";
import { authContext, authEpoch, getToken } from "@/lib/auth";
import { useWorkspaceSession, workspaceError } from "@/lib/workspace";
import {
  fetchNotification,
  fetchUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationType,
} from "@/lib/notifications";
import { connectNotificationFeed } from "@/lib/notification-feed";
import WorkspaceState from "./WorkspaceState";
export default function NotificationInbox({
  unreadCount,
}: {
  unreadCount: number;
}) {
  const { context, epoch } = useWorkspaceSession();
  const [open, setOpen] = useState(false);
  const cache = useQueryClient();
  useEffect(() => {
    if (!context) return;
    const originalEpoch = authEpoch();
    const url = new URL(
      String(api.defaults.baseURL ?? window.location.origin),
      window.location.origin,
    );
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/socket.io/";
    url.search = "EIO=4&transport=websocket";
    const refresh = () => {
      void cache.invalidateQueries({ queryKey: ["notifications"] });
    };
    return connectNotificationFeed({
      url: url.toString(),
      token: getToken,
      current: () => authContext() === context && authEpoch() === originalEpoch,
      invalidate: refresh,
    });
  }, [context, epoch, cache]);
  if (!context) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notifications, ${unreadCount} unread`}
          className="relative"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1 text-[10px] text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DialogTrigger>
      {open && <Inbox key={epoch} context={context} />}
    </Dialog>
  );
}
function Inbox({ context }: { context: string }) {
  const pathname = usePathname();
  const detailBase = pathname.startsWith("/dashboard/customer")
    ? "/dashboard/customer/orders"
    : pathname.startsWith("/dashboard/warehouse")
      ? "/dashboard/warehouse/orders"
      : "/dashboard/manager/orders";
  const cache = useQueryClient();
  const [type, setType] = useState<NotificationType | "">(""),
    [unread, setUnread] = useState(false),
    [cursors, setCursors] = useState<Array<string | null>>([null]),
    [selected, setSelected] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const list = useQuery({
    queryKey: ["notifications", context, "list", type, unread, cursors.at(-1)],
    queryFn: () =>
      fetchUserNotifications({
        type: type || undefined,
        unread: unread || undefined,
        cursor: cursors.at(-1),
        limit: 20,
      }),
    retry: false,
    refetchInterval: 30000,
    refetchOnReconnect: true,
  });
  const detail = useQuery({
    queryKey: ["notifications", context, "detail", selected],
    queryFn: () => fetchNotification(selected!),
    enabled: Boolean(selected),
    retry: false,
  });
  async function mark(all = false) {
    const epoch = authEpoch();
    setBusy(true);
    setError("");
    try {
      if (all) await markAllNotificationsRead(type || undefined);
      else await markNotificationRead(selected!);
      if (authContext() === context && authEpoch() === epoch && mounted.current)
        await cache.invalidateQueries({ queryKey: ["notifications"] });
    } catch (e) {
      if (authContext() === context && authEpoch() === epoch && mounted.current)
        setError(workspaceError(e));
    } finally {
      if (authContext() === context && authEpoch() === epoch && mounted.current)
        setBusy(false);
    }
  }
  return (
    <DialogContent className="max-h-[90dvh] overflow-y-auto bg-white sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Notifications</DialogTitle>
        <DialogDescription>
          Persisted messages for your selected recipient membership. Realtime
          signals refresh this inbox; delivery is not guaranteed.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Notification type"
          className="h-10 rounded-md border px-3"
          value={type}
          onChange={(e) => {
            setType(e.target.value as typeof type);
            setCursors([null]);
            setSelected(null);
          }}
        >
          <option value="">All types</option>
          {["order", "cash", "support", "system"].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <label className="text-sm">
          <input
            type="checkbox"
            checked={unread}
            onChange={(e) => {
              setUnread(e.target.checked);
              setCursors([null]);
            }}
          />{" "}
          Unread only
        </label>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void mark(true)}
        >
          Mark all in this filter read
        </Button>
        <Button variant="ghost" onClick={() => void list.refetch()}>
          Refresh
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {list.isLoading ? (
        <WorkspaceState kind="loading" title="Loading inbox" />
      ) : list.error ? (
        <WorkspaceState
          kind="error"
          title="Inbox unavailable"
          description={workspaceError(list.error)}
          onRetry={() => void list.refetch()}
        />
      ) : !list.data?.items.length ? (
        <WorkspaceState
          kind="empty"
          title="No notifications"
          description="No persisted messages match this selected context and filter."
        />
      ) : (
        <ul className="divide-y rounded-lg border">
          {list.data.items.map((item) => (
            <li key={item.id}>
              <button
                className="w-full p-4 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
                onClick={() => setSelected(item.id)}
              >
                <span className="flex justify-between gap-2">
                  <span className="font-semibold">{item.title}</span>
                  {item.unread && (
                    <span className="text-xs text-blue-700">Unread</span>
                  )}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {item.type} · {new Date(item.at).toLocaleString()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-between">
        <Button
          variant="outline"
          disabled={cursors.length === 1}
          onClick={() => setCursors(cursors.slice(0, -1))}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          disabled={!list.data?.hasMore || !list.data.nextCursor}
          onClick={() => setCursors([...cursors, list.data!.nextCursor])}
        >
          Next
        </Button>
      </div>
      {selected && (
        <section className="rounded-lg border p-4" aria-live="polite">
          {detail.isLoading ? (
            <p>Loading message…</p>
          ) : detail.error ? (
            <p>{workspaceError(detail.error)}</p>
          ) : (
            detail.data && (
              <>
                <h3 className="font-semibold">{detail.data.title}</h3>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                  {detail.data.body}
                </p>
                <div className="mt-3 flex gap-2">
                  {detail.data.orderId && (
                    <Link
                      className="text-sm text-blue-700 underline"
                      href={`${detailBase}/${detail.data.orderId}`}
                    >
                      View authorized order
                    </Link>
                  )}
                  {detail.data.unread && (
                    <Button
                      disabled={busy}
                      variant="outline"
                      onClick={() => void mark()}
                    >
                      Mark this message read
                    </Button>
                  )}
                </div>
              </>
            )
          )}
        </section>
      )}
    </DialogContent>
  );
}
