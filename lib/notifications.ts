import { z } from "zod";
import { api } from "./api";
import { authContext, authEpoch } from "./auth";
export type NotificationType = "order" | "cash" | "support" | "system";
const notification = z.object({
  id: z.string().uuid(),
  type: z.enum(["order", "cash", "support", "system"]),
  title: z.string().max(500),
  body: z.string().max(10000),
  at: z.string().datetime(),
  unread: z.boolean(),
  orderId: z.string().uuid().nullable(),
});
export type UserNotification = z.infer<typeof notification>;
async function request<T>(
  method: "GET" | "POST",
  path: string,
  schema: z.ZodType<T>,
  options?: { params?: object; data?: object },
) {
  const context = authContext(),
    epoch = authEpoch();
  if (!context) throw Error("Bound login required");
  const response = await api.request({
    url: path,
    method,
    ...options,
    timeout: 15000,
    noReplay: method === "POST",
  } as Parameters<typeof api.request>[0]);
  if (context !== authContext() || epoch !== authEpoch())
    throw Error("Session changed; notification discarded");
  return schema.parse(response.data);
}
export async function fetchUnreadNotificationCount(type?: NotificationType) {
  return (
    await request(
      "GET",
      "/api/notifications/unread-count",
      z.object({ unreadCount: z.number().int().nonnegative() }),
      { params: { type } },
    )
  ).unreadCount;
}
export function fetchUserNotifications(
  params: {
    type?: NotificationType;
    unread?: boolean;
    limit?: number;
    cursor?: string | null;
  } = {},
) {
  return request(
    "GET",
    "/api/notifications",
    z.object({
      items: z.array(notification).max(50),
      hasMore: z.boolean(),
      nextCursor: z.string().max(1024).nullable(),
    }),
    {
      params: {
        ...params,
        limit: Math.min(Math.max(params.limit ?? 20, 1), 50),
        cursor: params.cursor || undefined,
      },
    },
  );
}
export function fetchNotification(id: string) {
  return request(
    "GET",
    `/api/notifications/${z.string().uuid().parse(id)}`,
    notification,
  );
}
export function markNotificationRead(id: string) {
  return request(
    "POST",
    `/api/notifications/${z.string().uuid().parse(id)}/read`,
    z.object({
      success: z.literal(true),
      id: z.string().uuid(),
      readAt: z.string().datetime(),
    }),
  );
}
export function markAllNotificationsRead(type?: NotificationType) {
  return request(
    "POST",
    "/api/notifications/read-all",
    z.object({
      success: z.literal(true),
      updatedCount: z.number().int().nonnegative(),
    }),
    { data: { type } },
  );
}
