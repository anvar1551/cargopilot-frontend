import { api } from "@/lib/api";
import { subscribeAuthenticatedSse } from "@/lib/sse";

export type SupportTicketPriority = "urgent" | "high" | "normal";
export type SupportTicketStatus = "open" | "waiting_customer" | "waiting_driver" | "escalated" | "resolved";
export type SupportTicketSource = "customer_chat" | "driver_app" | "system_alert" | "manager";
export type SupportTicketAuthorType = "customer" | "driver" | "support" | "system";
export type SupportTicketOwnerScope = "mine" | "unassigned" | "all";

export type SupportTicket = {
  id: string;
  ticketNumber: string;
  sourceKey: string | null;
  orderId: string | null;
  orderNumber: string | null;
  title: string;
  summary: string | null;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  source: SupportTicketSource;
  customerName: string | null;
  companyName: string | null;
  route: string | null;
  driverName: string | null;
  driverPhone: string | null;
  warehouseLabel: string | null;
  ownerId: string | null;
  ownerName: string | null;
  lastMessage: string | null;
  lastReplyBy: SupportTicketAuthorType | null;
  slaPercent: number;
  slaDueAt: string | null;
  lastActivityAt: string | null;
  resolvedAt: string | null;
  archivedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  messages?: Array<{
    id: string;
    authorType: SupportTicketAuthorType;
    authorId: string | null;
    authorName: string | null;
    body: string;
    createdAt: string | null;
  }>;
  notes?: Array<{
    id: string;
    actorId: string | null;
    actorName: string | null;
    body: string;
    createdAt: string | null;
  }>;
  events?: Array<{
    id: string;
    eventType: string;
    actorId: string | null;
    actorName: string | null;
    body: string | null;
    metadata: unknown;
    createdAt: string | null;
  }>;
};

export type SupportSummary = {
  open: number;
  escalated: number;
  waitingCustomer: number;
  waitingDriver: number;
  waiting: number;
  resolvedToday: number;
  slaRisk: number;
};

export type SupportTicketsResponse = {
  items: SupportTicket[];
  hasMore: boolean;
  nextCursor: string | null;
  summary: SupportSummary;
  isPartial?: boolean;
};

export type SupportTicketFilters = {
  status?: "all" | SupportTicketStatus;
  priority?: "all" | SupportTicketPriority;
  source?: "all" | SupportTicketSource;
  owner?: SupportTicketOwnerScope;
  q?: string;
  cursor?: string | null;
  limit?: number;
  includeArchived?: boolean;
};

export type CreateSupportTicketPayload = {
  orderId?: string | null;
  orderNumber?: string | null;
  title: string;
  summary?: string | null;
  priority?: SupportTicketPriority;
  source?: SupportTicketSource;
  status?: SupportTicketStatus;
  ownerId?: string | null;
  sourceKey?: string | null;
};

export type SupportAssignee = {
  id: string;
  name: string;
  email: string;
  role: "manager";
};

export async function fetchSupportTickets(params: SupportTicketFilters = {}) {
  const res = await api.get<SupportTicketsResponse>("/api/manager/support/tickets", {
    params: {
      ...params,
      status: params.status && params.status !== "all" ? params.status : undefined,
      priority: params.priority && params.priority !== "all" ? params.priority : undefined,
      source: params.source && params.source !== "all" ? params.source : undefined,
      cursor: params.cursor || undefined,
      includeArchived: params.includeArchived ? "true" : undefined,
    },
  });
  return res.data;
}

export async function fetchSupportTicket(id: string) {
  const res = await api.get<SupportTicket>(`/api/manager/support/tickets/${id}`);
  return res.data;
}

export async function fetchSupportAssignees() {
  const res = await api.get<{ items: SupportAssignee[] }>("/api/manager/support/assignees");
  return res.data.items;
}

export async function updateSupportTicketStatus(id: string, status: SupportTicketStatus) {
  const res = await api.patch<SupportTicket>(`/api/manager/support/tickets/${id}/status`, { status });
  return res.data;
}

export async function createSupportTicket(payload: CreateSupportTicketPayload) {
  const res = await api.post<SupportTicket>("/api/manager/support/tickets", payload);
  return res.data;
}

export async function assignSupportTicket(id: string, ownerId?: string | null) {
  const res = await api.patch<SupportTicket>(`/api/manager/support/tickets/${id}/assign`, {
    ownerId: ownerId ?? null,
  });
  return res.data;
}

export async function addSupportTicketNote(id: string, body: string) {
  const res = await api.post<SupportTicket>(`/api/manager/support/tickets/${id}/notes`, { body });
  return res.data;
}

export async function addSupportTicketMessage(id: string, body: string) {
  const res = await api.post<SupportTicket>(`/api/manager/support/tickets/${id}/messages`, { body });
  return res.data;
}

export async function escalateSupportTicket(id: string) {
  const res = await api.post<SupportTicket>(`/api/manager/support/tickets/${id}/escalate`);
  return res.data;
}

export function subscribeSupportStream(args: {
  onReady?: (payload: { connectedAt?: string }) => void;
  onRefresh: (payload: {
    at?: string;
    reason?: string;
    ticketId?: string | null;
    keys?: Array<"list" | "detail" | "summary">;
  }) => void;
  onError?: (error: Error) => void;
}) {
  return subscribeAuthenticatedSse({
    path: "/api/manager/support/stream",
    lastEventIdKey: "cp:sse:manager-support:last-id",
    onReady: (payload) => args.onReady?.((payload ?? {}) as { connectedAt?: string }),
    onEvent: (frame) => {
      if (frame.event !== "support-refresh") return;
      try {
        args.onRefresh(
          frame.data
            ? (JSON.parse(frame.data) as {
                at?: string;
                reason?: string;
                ticketId?: string | null;
                keys?: Array<"list" | "detail" | "summary">;
              })
            : {},
        );
      } catch {
        args.onRefresh({});
      }
    },
    onError: args.onError,
  });
}
