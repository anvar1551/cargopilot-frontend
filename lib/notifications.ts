import { api } from "@/lib/api";

export type NotificationType = "order" | "cash" | "support" | "system";

export type UserNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  orderId: string | null;
  data: unknown;
  createdAt: string;
  readAt: string | null;
};

export async function fetchUnreadNotificationCount(type?: NotificationType) {
  const res = await api.get<{ unreadCount: number }>("/api/notifications/unread-count", {
    params: { type },
  });
  return Number(res.data.unreadCount || 0);
}

export async function fetchUserNotifications(params: {
  type?: NotificationType;
  unread?: boolean;
  limit?: number;
  cursor?: string | null;
} = {}) {
  const res = await api.get<{
    items: UserNotification[];
    hasMore: boolean;
    nextCursor: string | null;
  }>("/api/notifications", {
    params: {
      ...params,
      unread: params.unread === undefined ? undefined : String(params.unread),
      cursor: params.cursor || undefined,
    },
  });
  return res.data;
}

export async function markNotificationRead(id: string) {
  const res = await api.post<{ success: boolean; id: string; readAt: string }>(
    `/api/notifications/${id}/read`,
  );
  return res.data;
}

export async function markAllNotificationsRead(type?: NotificationType) {
  const res = await api.post<{ success: boolean; updatedCount: number }>(
    "/api/notifications/read-all",
    { type },
  );
  return res.data;
}
