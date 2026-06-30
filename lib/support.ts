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
  ownerOrgId: string | null;
  assignedOrgId: string | null;
  queueId: string | null;
  queueCode: string | null;
  queueName: string | null;
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
  companyId?: string | null;
};

export type SupportAssignee = {
  id: string;
  name: string;
  email: string;
  role: "manager";
};

export type SupportQueue = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description: string | null;
  defaultOrgId: string | null;
  defaultOrgName: string | null;
  defaultOwnerId: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type SupportAssignmentRule = {
  id: string;
  companyId: string;
  queueId: string | null;
  queueCode: string | null;
  queueName: string | null;
  name: string;
  code: string;
  source: SupportTicketSource | null;
  priority: SupportTicketPriority | null;
  routeContains: string | null;
  defaultOwnerId: string | null;
  conditionsJson: unknown;
  sortOrder: number;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export async function fetchSupportTickets(params: SupportTicketFilters = {}) {
  const res = await api.get<SupportTicketsResponse>("/api/support/tickets", {
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
  const res = await api.get<SupportTicket>(`/api/support/tickets/${id}`);
  return res.data;
}

export async function fetchSupportAssignees() {
  const res = await api.get<{ items: SupportAssignee[] }>("/api/support/assignees");
  return res.data.items;
}

export async function fetchSupportQueues(companyId?: string | null) {
  const res = await api.get<{ items: SupportQueue[] }>("/api/support/queues", {
    params: { companyId: companyId || undefined },
  });
  return res.data.items;
}

export async function createSupportQueue(payload: Partial<SupportQueue> & {
  companyId?: string | null;
  name: string;
}) {
  const res = await api.post<SupportQueue>("/api/support/queues", payload);
  return res.data;
}

export async function updateSupportQueue(id: string, payload: Partial<SupportQueue>) {
  const res = await api.patch<SupportQueue>(`/api/support/queues/${id}`, payload);
  return res.data;
}

export async function deleteSupportQueue(id: string) {
  const res = await api.delete<{ success: boolean }>(`/api/support/queues/${id}`);
  return res.data;
}

export async function fetchSupportAssignmentRules(companyId?: string | null) {
  const res = await api.get<{ items: SupportAssignmentRule[] }>("/api/support/assignment-rules", {
    params: { companyId: companyId || undefined },
  });
  return res.data.items;
}

export async function createSupportAssignmentRule(payload: Partial<SupportAssignmentRule> & {
  companyId?: string | null;
  name: string;
}) {
  const res = await api.post<SupportAssignmentRule>("/api/support/assignment-rules", payload);
  return res.data;
}

export async function updateSupportAssignmentRule(id: string, payload: Partial<SupportAssignmentRule>) {
  const res = await api.patch<SupportAssignmentRule>(`/api/support/assignment-rules/${id}`, payload);
  return res.data;
}

export async function deleteSupportAssignmentRule(id: string) {
  const res = await api.delete<{ success: boolean }>(`/api/support/assignment-rules/${id}`);
  return res.data;
}

export async function updateSupportTicketStatus(id: string, status: SupportTicketStatus) {
  const res = await api.patch<SupportTicket>(`/api/support/tickets/${id}/status`, { status });
  return res.data;
}

export async function createSupportTicket(payload: CreateSupportTicketPayload) {
  const res = await api.post<SupportTicket>("/api/support/tickets", payload);
  return res.data;
}

export async function assignSupportTicket(id: string, ownerId?: string | null) {
  const res = await api.patch<SupportTicket>(`/api/support/tickets/${id}/assign`, {
    ownerId: ownerId ?? null,
  });
  return res.data;
}

export async function addSupportTicketNote(id: string, body: string) {
  const res = await api.post<SupportTicket>(`/api/support/tickets/${id}/notes`, { body });
  return res.data;
}

export async function addSupportTicketMessage(id: string, body: string) {
  const res = await api.post<SupportTicket>(`/api/support/tickets/${id}/messages`, { body });
  return res.data;
}

export async function escalateSupportTicket(id: string) {
  const res = await api.post<SupportTicket>(`/api/support/tickets/${id}/escalate`);
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
    path: "/api/support/stream",
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

