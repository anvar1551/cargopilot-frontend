"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock3,
  FileText,
  Headphones,
  Inbox,
  MapPin,
  MessageSquareText,
  PackageCheck,
  Paperclip,
  Phone,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Truck,
  UserRound,
  Warehouse,
} from "lucide-react";

import PageShell from "@/components/layout/PageShell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  addSupportTicketNote,
  addSupportTicketMessage,
  assignSupportTicket,
  createSupportAssignmentRule,
  createSupportQueue,
  createSupportTicket,
  deleteSupportAssignmentRule,
  deleteSupportQueue,
  escalateSupportTicket,
  fetchSupportAssignmentRules,
  fetchSupportAssignees,
  fetchSupportQueues,
  fetchSupportTicket,
  fetchSupportTickets,
  subscribeSupportStream,
  updateSupportAssignmentRule,
  updateSupportQueue,
  updateSupportTicketStatus,
  type SupportAssignmentRule,
  type SupportQueue,
  type SupportTicket as ApiSupportTicket,
  type SupportTicketPriority,
  type SupportTicketSource,
} from "@/lib/support";
import { getUser, hasPermission } from "@/lib/auth";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Priority = "urgent" | "high" | "normal";
type TicketStatus = "open" | "waiting_customer" | "waiting_driver" | "escalated" | "resolved";
type TicketSource = "customer_chat" | "driver_app" | "system_alert" | "manager";
type LastReplyBy = "customer" | "driver" | "support" | "system";
type ScopeFilter = "mine" | "unassigned" | "all";
type TicketOwner = "mine" | "unassigned" | "team";
type SupportView = "tickets" | "queues" | "rules";
type SlaFilter = "all" | "risk" | "overdue" | "healthy";

type QueueForm = {
  id?: string;
  name: string;
  code: string;
  description: string;
  defaultOwnerId: string;
  isDefault: boolean;
  isActive: boolean;
};

type RuleForm = {
  id?: string;
  name: string;
  code: string;
  queueId: string;
  source: "any" | SupportTicketSource;
  priority: "any" | SupportTicketPriority;
  routeContains: string;
  defaultOwnerId: string;
  sortOrder: string;
  isActive: boolean;
};

type Ticket = {
  id: string;
  orderId: string | null;
  orderNumber: string | null;
  shipment: string;
  customer: string;
  company: string;
  issue: string;
  priority: Priority;
  status: TicketStatus;
  source: TicketSource;
  owner: TicketOwner;
  ownerId: string | null;
  ownerName: string;
  queueName: string;
  lastReplyBy: LastReplyBy;
  age: string;
  sla: number;
  slaDueAt: string | null;
  route: string;
  driver: string;
  driverPhone: string;
  warehouse: string;
  lastMessage: string;
  orderFacts: Array<{ label: string; value: string }>;
  timeline: Array<{ time: string; title: string; tone?: "good" | "warn" | "bad"; pending?: boolean }>;
  checkpoints: Array<{ label: string; state: "done" | "active" | "blocked" | "idle" }>;
  notes: string[];
};

const statusFilters: Array<"all" | TicketStatus> = [
  "all",
  "open",
  "waiting_customer",
  "waiting_driver",
  "escalated",
  "resolved",
];

const scopeFilters: Array<{ value: ScopeFilter; label: string }> = [
  { value: "mine", label: "Assigned to me" },
  { value: "unassigned", label: "Unassigned" },
  { value: "all", label: "All tickets" },
];

const priorityFilters: Array<{ value: "all" | Priority; label: string }> = [
  { value: "all", label: "All priority" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "normal", label: "Normal" },
];

const sourceFilters: Array<{ value: "all" | TicketSource; label: string }> = [
  { value: "all", label: "All sources" },
  { value: "system_alert", label: "System" },
  { value: "customer_chat", label: "Customer" },
  { value: "driver_app", label: "Driver" },
  { value: "manager", label: "Manager" },
];

const slaFilters: Array<{ value: SlaFilter; label: string }> = [
  { value: "all", label: "All SLA" },
  { value: "risk", label: "At risk" },
  { value: "overdue", label: "Overdue" },
  { value: "healthy", label: "Healthy" },
];

const statusLabels: Record<"all" | TicketStatus, string> = {
  all: "All",
  open: "Open",
  waiting_customer: "Waiting customer",
  waiting_driver: "Waiting driver",
  escalated: "Escalated",
  resolved: "Resolved",
};

const sourceLabels: Record<TicketSource, string> = {
  customer_chat: "Customer chat",
  driver_app: "Driver app",
  system_alert: "System alert",
  manager: "Manager",
};

const emptyQueueForm: QueueForm = {
  name: "",
  code: "",
  description: "",
  defaultOwnerId: "__none",
  isDefault: false,
  isActive: true,
};

const emptyRuleForm: RuleForm = {
  name: "",
  code: "",
  queueId: "__none",
  source: "any",
  priority: "any",
  routeContains: "",
  defaultOwnerId: "__none",
  sortOrder: "100",
  isActive: true,
};

const lastReplyLabels: Record<LastReplyBy, string> = {
  customer: "Customer",
  driver: "Driver",
  support: "Support",
  system: "System",
};

function formatAge(value?: string | null) {
  if (!value) return "now";
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return "now";
  const diffMin = Math.max(0, Math.floor((Date.now() - ts) / 60_000));
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  if (hours < 24) return mins ? `${hours}h ${mins}m` : `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDurationFromMinutes(minutes: number) {
  const abs = Math.abs(Math.round(minutes));
  if (abs < 60) return `${abs}m`;
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  if (hours < 24) return mins ? `${hours}h ${mins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days}d ${restHours}h` : `${days}d`;
}

function resolveSlaView(ticket: Pick<Ticket, "sla" | "slaDueAt" | "status">) {
  if (ticket.status === "resolved") {
    return {
      label: "Completed",
      detail: ticket.slaDueAt ? `Due ${formatDateTime(ticket.slaDueAt)}` : "SLA closed",
      tone: "good" as const,
    };
  }

  if (!ticket.slaDueAt) {
    return {
      label: "No SLA",
      detail: "No due date assigned",
      tone: "muted" as const,
    };
  }

  const dueAt = new Date(ticket.slaDueAt).getTime();
  if (!Number.isFinite(dueAt)) {
    return {
      label: "No SLA",
      detail: "Invalid due date",
      tone: "muted" as const,
    };
  }

  const remainingMinutes = Math.ceil((dueAt - Date.now()) / 60_000);
  if (remainingMinutes <= 0 || ticket.sla <= 0) {
    return {
      label: "Overdue",
      detail: `Overdue by ${formatDurationFromMinutes(remainingMinutes)}`,
      tone: "bad" as const,
    };
  }

  if (ticket.sla < 25 || remainingMinutes <= 60) {
    return {
      label: "Due soon",
      detail: `${formatDurationFromMinutes(remainingMinutes)} remaining`,
      tone: "bad" as const,
    };
  }

  if (ticket.sla < 55) {
    return {
      label: "Watch",
      detail: `${formatDurationFromMinutes(remainingMinutes)} remaining`,
      tone: "warn" as const,
    };
  }

  return {
    label: "Healthy",
    detail: `${formatDurationFromMinutes(remainingMinutes)} remaining`,
    tone: "good" as const,
  };
}

function mapApiTicket(ticket: ApiSupportTicket): Ticket {
  const slaPercent = Math.max(0, Math.min(100, Number(ticket.slaPercent || 0)));
  const slaDueLabel = ticket.slaDueAt ? formatDateTime(ticket.slaDueAt) : "-";
  return {
    id: ticket.id,
    orderId: ticket.orderId,
    orderNumber: ticket.orderNumber,
    shipment: ticket.orderNumber ? `#${ticket.orderNumber}` : ticket.ticketNumber,
    customer: ticket.customerName || "Unknown customer",
    company: ticket.companyName || "Customer account",
    issue: ticket.title,
    priority: ticket.priority,
    status: ticket.status,
    source: ticket.source,
    owner: ticket.ownerId ? "mine" : "unassigned",
    ownerId: ticket.ownerId,
    ownerName: ticket.ownerName || "Unassigned",
    queueName: ticket.queueName || "General queue",
    lastReplyBy: ticket.lastReplyBy || "system",
    age: formatAge(ticket.lastActivityAt || ticket.createdAt),
    sla: slaPercent,
    slaDueAt: ticket.slaDueAt,
    route: ticket.route || "-",
    driver: ticket.driverName || "Not assigned",
    driverPhone: ticket.driverPhone || "-",
    warehouse: ticket.warehouseLabel || "-",
    lastMessage: ticket.lastMessage || ticket.summary || ticket.title,
    orderFacts: [
      { label: "Ticket", value: ticket.ticketNumber },
      { label: "Order", value: ticket.orderNumber || "-" },
      { label: "Source", value: sourceLabels[ticket.source] },
      { label: "Queue", value: ticket.queueName || "General queue" },
      { label: "SLA", value: `${slaPercent}% left` },
      { label: "SLA due", value: slaDueLabel },
    ],
    timeline: (ticket.events?.length ? ticket.events : []).map((event) => ({
      time: event.createdAt
        ? new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(new Date(event.createdAt))
        : "-",
      title: event.body || event.eventType,
      tone:
        event.eventType === "escalated"
          ? "bad"
          : event.eventType === "resolved"
            ? "good"
            : event.eventType === "status_changed"
              ? "warn"
              : undefined,
    })),
    checkpoints: [
      { label: "Opened", state: "done" },
      { label: "Assigned", state: ticket.ownerId ? "done" : "idle" },
      { label: "Action", state: ticket.status === "escalated" ? "blocked" : "active" },
      { label: "Waiting", state: ticket.status.startsWith("waiting") ? "active" : "idle" },
      { label: "Resolved", state: ticket.status === "resolved" ? "done" : "idle" },
    ],
    notes: ticket.notes?.map((note) => note.body) ?? [],
  };
}

function priorityClasses(priority: Priority) {
  if (priority === "urgent") return "border-red-200 bg-red-50 text-red-700";
  if (priority === "high") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function statusClasses(status: TicketStatus) {
  if (status === "escalated") return "border-red-200 bg-red-50 text-red-700";
  if (status === "waiting_customer" || status === "waiting_driver") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "resolved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function sourceClasses(source: TicketSource) {
  if (source === "customer_chat") return "border-teal-200 bg-teal-50 text-teal-700";
  if (source === "driver_app") return "border-blue-200 bg-blue-50 text-blue-700";
  if (source === "system_alert") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function slaViewClasses(tone: ReturnType<typeof resolveSlaView>["tone"]) {
  if (tone === "bad") return "border-red-200 bg-red-50 text-red-700";
  if (tone === "warn") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "muted") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function checkpointClasses(state: Ticket["checkpoints"][number]["state"]) {
  if (state === "done") return "border-emerald-500 bg-emerald-500";
  if (state === "active") return "border-blue-500 bg-blue-500";
  if (state === "blocked") return "border-red-500 bg-red-500";
  return "border-slate-300 bg-white";
}

function SupportChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-medium", className)}>
      {children}
    </span>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "warn" | "bad" | "good";
}) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <Icon
          className={cn(
            "h-4 w-4",
            tone === "bad" && "text-red-500",
            tone === "warn" && "text-amber-500",
            tone === "good" && "text-emerald-500",
            tone === "default" && "text-slate-400",
          )}
        />
      </div>
      <div className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{value}</div>
    </div>
  );
}

export default function SupportDashboard() {
  const queryClient = useQueryClient();
  const currentUser = useMemo(() => getUser(), []);
  const canConfigureSupport = hasPermission(currentUser, "support.configure");
  const companyId = currentUser?.companyId ?? null;
  const [supportView, setSupportView] = useState<SupportView>("tickets");
  const [activeId, setActiveId] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilters)[number]>("all");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("mine");
  const [priorityFilter, setPriorityFilter] = useState<"all" | Priority>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | TicketSource>("all");
  const [slaFilter, setSlaFilter] = useState<SlaFilter>("all");
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [reply, setReply] = useState("");
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [newTicket, setNewTicket] = useState({
    orderNumber: "",
    title: "",
    summary: "",
    priority: "normal" as SupportTicketPriority,
    ownerId: "",
  });
  const [queueForm, setQueueForm] = useState<QueueForm>(emptyQueueForm);
  const [ruleForm, setRuleForm] = useState<RuleForm>(emptyRuleForm);
  const [localNotes, setLocalNotes] = useState<Record<string, string[]>>({});
  const [localStatuses, setLocalStatuses] = useState<Partial<Record<string, TicketStatus>>>({});
  const [localAssignees, setLocalAssignees] = useState<Record<string, { ownerId: string | null; ownerName: string }>>({});
  const [localTimeline, setLocalTimeline] = useState<Record<string, Ticket["timeline"]>>({});
  const [optimisticTickets, setOptimisticTickets] = useState<Ticket[]>([]);
  const debouncedQuery = useDebounce(query, 350);

  const assigneesQuery = useQuery({
    queryKey: ["manager-support-assignees"],
    queryFn: fetchSupportAssignees,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const queuesQuery = useQuery({
    queryKey: ["manager-support-queues", companyId],
    queryFn: () => fetchSupportQueues(companyId),
    enabled: canConfigureSupport && Boolean(companyId),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
  });

  const rulesQuery = useQuery({
    queryKey: ["manager-support-assignment-rules", companyId],
    queryFn: () => fetchSupportAssignmentRules(companyId),
    enabled: canConfigureSupport && Boolean(companyId),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
  });

  const supportTicketsQuery = useInfiniteQuery({
    queryKey: ["manager-support-tickets", statusFilter, scopeFilter, priorityFilter, sourceFilter, debouncedQuery],
    queryFn: ({ pageParam }) =>
      fetchSupportTickets({
        status: statusFilter,
        priority: priorityFilter,
        source: sourceFilter,
        owner: scopeFilter,
        q: debouncedQuery,
        cursor: pageParam,
        limit: 30,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 10_000,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const apiTickets = useMemo(() => {
    const serverTickets = supportTicketsQuery.data?.pages.flatMap((page) => page.items.map(mapApiTicket)) ?? [];
    const serverIds = new Set(serverTickets.map((ticket) => ticket.id));
    return [...optimisticTickets.filter((ticket) => !serverIds.has(ticket.id)), ...serverTickets];
  }, [optimisticTickets, supportTicketsQuery.data]);

  const filteredTickets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return apiTickets.filter((ticket) => {
      const currentStatus = localStatuses[ticket.id] ?? ticket.status;
      const assignment = localAssignees[ticket.id];
      const ownerId = assignment?.ownerId ?? ticket.ownerId;
      const ownerScope: TicketOwner = ownerId
        ? ownerId === currentUser?.id
          ? "mine"
          : "team"
        : "unassigned";
      const matchesStatus = statusFilter === "all" || currentStatus === statusFilter;
      const matchesScope = scopeFilter === "all" || ownerScope === scopeFilter;
      const slaView = resolveSlaView({ ...ticket, status: currentStatus });
      const matchesSla =
        slaFilter === "all" ||
        (slaFilter === "risk" && (slaView.tone === "bad" || slaView.tone === "warn")) ||
        (slaFilter === "overdue" && slaView.label === "Overdue") ||
        (slaFilter === "healthy" && slaView.tone === "good");
      const matchesQuery =
        !normalized ||
        [
          ticket.id,
          ticket.shipment,
          ticket.customer,
          ticket.company,
          ticket.issue,
          ticket.route,
          ticket.driver,
          ticket.driverPhone,
          sourceLabels[ticket.source],
          assignment?.ownerName ?? ticket.ownerName,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      return matchesStatus && matchesScope && matchesSla && matchesQuery;
    });
  }, [apiTickets, currentUser?.id, localAssignees, localStatuses, query, scopeFilter, slaFilter, statusFilter]);

  useEffect(() => {
    if (!activeId && filteredTickets[0]?.id) {
      setActiveId(filteredTickets[0].id);
    }
  }, [activeId, filteredTickets]);

  const activeTicketId = activeId || filteredTickets[0]?.id || "";
  const detailQuery = useQuery({
    queryKey: ["manager-support-ticket", activeTicketId],
    queryFn: () => fetchSupportTicket(activeTicketId),
    enabled: Boolean(activeTicketId) && !activeTicketId.startsWith("temp-"),
    staleTime: 10_000,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const detailTicket = detailQuery.data ? mapApiTicket(detailQuery.data) : null;

  const emptyTicket: Ticket = {
    id: "",
    orderId: null,
    orderNumber: null,
    shipment: "No ticket selected",
    customer: "-",
    company: "-",
    issue: "No active support ticket",
    priority: "normal",
    status: "open",
    source: "system_alert",
    owner: "unassigned",
    ownerId: null,
    ownerName: "Unassigned",
    queueName: "General queue",
    lastReplyBy: "system",
    age: "-",
    sla: 100,
    slaDueAt: null,
    route: "-",
    driver: "-",
    driverPhone: "-",
    warehouse: "-",
    lastMessage: "No support tickets match the current filters yet.",
    orderFacts: [],
    timeline: [],
    checkpoints: [
      { label: "Opened", state: "idle" },
      { label: "Assigned", state: "idle" },
      { label: "Action", state: "idle" },
      { label: "Waiting", state: "idle" },
      { label: "Resolved", state: "idle" },
    ],
    notes: [],
  };
  const activeTicketBase =
    detailTicket ?? apiTickets.find((ticket) => ticket.id === activeTicketId) ?? filteredTickets[0] ?? emptyTicket;
  const activeTicket: Ticket = {
    ...activeTicketBase,
    status: localStatuses[activeTicketBase.id] ?? activeTicketBase.status,
    ownerId: localAssignees[activeTicketBase.id]?.ownerId ?? activeTicketBase.ownerId,
    ownerName: localAssignees[activeTicketBase.id]?.ownerName ?? activeTicketBase.ownerName,
    timeline: [...(localTimeline[activeTicketBase.id] ?? []), ...activeTicketBase.timeline],
  };
  const activeSla = resolveSlaView(activeTicket);
  const summary = supportTicketsQuery.data?.pages[0]?.summary;
  const apiOpenCount = summary?.open ?? 0;
  const apiSlaRiskCount = summary?.slaRisk ?? 0;
  const apiWaitingCount = summary?.waiting ?? 0;
  const apiResolvedTodayCount = summary?.resolvedToday ?? 0;

  const visibleNotes = useMemo(() => {
    const serverNotes = activeTicket.notes ?? [];
    const seenServerNotes = new Set(serverNotes.map((note) => note.trim()).filter(Boolean));
    const pendingNotes = (localNotes[activeTicket.id] ?? []).filter(
      (note) => !seenServerNotes.has(note.trim()),
    );
    return [...serverNotes, ...pendingNotes];
  }, [activeTicket.id, activeTicket.notes, localNotes]);
  const pushOptimisticTimeline = (ticketId: string, title: string, tone: "good" | "warn" | "bad" = "warn") => {
    setLocalTimeline((current) => ({
      ...current,
      [ticketId]: [
        {
          time: "now",
          title,
          tone,
          pending: true,
        },
        ...(current[ticketId] ?? []),
      ],
    }));
  };
  const statusMutation = useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: string; status: TicketStatus }) =>
      updateSupportTicketStatus(ticketId, status),
    onSuccess: (ticket) => {
      setLocalTimeline((current) => {
        const next = { ...current };
        delete next[ticket.id];
        return next;
      });
      queryClient.setQueryData(["manager-support-ticket", ticket.id], ticket);
      void queryClient.invalidateQueries({ queryKey: ["manager-support-tickets"] });
    },
    onError: (_err, variables) => {
      setLocalStatuses((current) => {
        const next = { ...current };
        delete next[variables.ticketId];
        return next;
      });
      setLocalTimeline((current) => {
        const next = { ...current };
        delete next[variables.ticketId];
        return next;
      });
    },
  });
  const noteMutation = useMutation({
    mutationFn: ({ ticketId, body }: { ticketId: string; body: string }) => addSupportTicketNote(ticketId, body),
    onSuccess: (ticket, variables) => {
      setLocalNotes((current) => {
        const pending = current[ticket.id] ?? [];
        const matchIndex = pending.findIndex((item) => item === variables.body);
        if (matchIndex === -1) return current;
        const nextPending = pending.filter((_, index) => index !== matchIndex);
        const next = { ...current };
        if (nextPending.length) next[ticket.id] = nextPending;
        else delete next[ticket.id];
        return next;
      });
      queryClient.setQueryData(["manager-support-ticket", ticket.id], ticket);
      void queryClient.invalidateQueries({ queryKey: ["manager-support-tickets"] });
    },
    onError: (_err, variables) => {
      setLocalNotes((current) => {
        const pending = current[variables.ticketId] ?? [];
        const matchIndex = pending.findIndex((item) => item === variables.body);
        if (matchIndex === -1) return current;
        const nextPending = pending.filter((_, index) => index !== matchIndex);
        const next = { ...current };
        if (nextPending.length) next[variables.ticketId] = nextPending;
        else delete next[variables.ticketId];
        return next;
      });
    },
  });
  const messageMutation = useMutation({
    mutationFn: ({ ticketId, body }: { ticketId: string; body: string }) => addSupportTicketMessage(ticketId, body),
    onSuccess: (ticket) => {
      setLocalTimeline((current) => {
        const next = { ...current };
        delete next[ticket.id];
        return next;
      });
      queryClient.setQueryData(["manager-support-ticket", ticket.id], ticket);
      void queryClient.invalidateQueries({ queryKey: ["manager-support-tickets"] });
    },
  });
  const escalateMutation = useMutation({
    mutationFn: (ticketId: string) => escalateSupportTicket(ticketId),
    onSuccess: (ticket) => {
      setLocalTimeline((current) => {
        const next = { ...current };
        delete next[ticket.id];
        return next;
      });
      setLocalStatuses((current) => ({ ...current, [ticket.id]: ticket.status }));
      queryClient.setQueryData(["manager-support-ticket", ticket.id], ticket);
      void queryClient.invalidateQueries({ queryKey: ["manager-support-tickets"] });
    },
  });
  const assignMutation = useMutation({
    mutationFn: ({ ticketId, ownerId }: { ticketId: string; ownerId: string | null }) =>
      assignSupportTicket(ticketId, ownerId),
    onSuccess: (ticket) => {
      setLocalTimeline((current) => {
        const next = { ...current };
        delete next[ticket.id];
        return next;
      });
      queryClient.setQueryData(["manager-support-ticket", ticket.id], ticket);
      void queryClient.invalidateQueries({ queryKey: ["manager-support-tickets"] });
    },
  });
  const createMutation = useMutation({
    mutationFn: (payload: typeof newTicket & { tempId: string }) =>
      createSupportTicket({
        orderNumber: payload.orderNumber.trim() || null,
        title: payload.title.trim(),
        summary: payload.summary.trim() || null,
        priority: payload.priority,
        source: "manager",
        ownerId: payload.ownerId === "__unassigned" ? null : payload.ownerId || currentUser?.id || null,
      }),
    onSuccess: (ticket, variables) => {
      setOptimisticTickets((current) => current.filter((item) => item.id !== variables.tempId));
      setActiveId(ticket.id);
      setNewTicketOpen(false);
      setNewTicket({ orderNumber: "", title: "", summary: "", priority: "normal", ownerId: "" });
      queryClient.setQueryData(["manager-support-ticket", ticket.id], ticket);
      void queryClient.invalidateQueries({ queryKey: ["manager-support-tickets"] });
    },
    onError: (_err, variables) => {
      setOptimisticTickets((current) => current.filter((item) => item.id !== variables.tempId));
      if (activeId === variables.tempId) setActiveId("");
    },
  });

  const queueMutation = useMutation({
    mutationFn: (form: QueueForm) => {
      const payload = {
        companyId: companyId || undefined,
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        description: form.description.trim() || null,
        defaultOwnerId: form.defaultOwnerId === "__none" ? null : form.defaultOwnerId,
        isDefault: form.isDefault,
        isActive: form.isActive,
      };
      return form.id ? updateSupportQueue(form.id, payload) : createSupportQueue(payload);
    },
    onSuccess: () => {
      setQueueForm(emptyQueueForm);
      void queryClient.invalidateQueries({ queryKey: ["manager-support-queues"] });
    },
  });

  const deleteQueueMutation = useMutation({
    mutationFn: (id: string) => deleteSupportQueue(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["manager-support-queues"] });
      void queryClient.invalidateQueries({ queryKey: ["manager-support-assignment-rules"] });
    },
  });

  const ruleMutation = useMutation({
    mutationFn: (form: RuleForm) => {
      const payload = {
        companyId: companyId || undefined,
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        queueId: form.queueId === "__none" ? null : form.queueId,
        source: form.source === "any" ? null : form.source,
        priority: form.priority === "any" ? null : form.priority,
        routeContains: form.routeContains.trim() || null,
        defaultOwnerId: form.defaultOwnerId === "__none" ? null : form.defaultOwnerId,
        sortOrder: Number(form.sortOrder) || 100,
        isActive: form.isActive,
      };
      return form.id ? updateSupportAssignmentRule(form.id, payload) : createSupportAssignmentRule(payload);
    },
    onSuccess: () => {
      setRuleForm(emptyRuleForm);
      void queryClient.invalidateQueries({ queryKey: ["manager-support-assignment-rules"] });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id: string) => deleteSupportAssignmentRule(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["manager-support-assignment-rules"] });
    },
  });

  useEffect(() => {
    return subscribeSupportStream({
      onRefresh: (event) => {
        void queryClient.invalidateQueries({ queryKey: ["manager-support-tickets"] });
        if (event.ticketId) {
          void queryClient.invalidateQueries({ queryKey: ["manager-support-ticket", event.ticketId] });
        }
      },
    });
  }, [queryClient]);

  const openCount = String(apiOpenCount);
  const slaRiskCount = String(apiSlaRiskCount);
  const waitingCount = String(apiWaitingCount);
  const resolvedTodayCount = String(apiResolvedTodayCount);
  const hasActiveQueueFilters =
    statusFilter !== "all" ||
    scopeFilter !== "mine" ||
    priorityFilter !== "all" ||
    sourceFilter !== "all" ||
    slaFilter !== "all" ||
    Boolean(query.trim());

  const submitNote = () => {
    const trimmed = note.trim();
    if (!trimmed || !activeTicket.id || noteMutation.isPending) return;
    setLocalNotes((current) => ({
      ...current,
      [activeTicket.id]: [...(current[activeTicket.id] ?? []), trimmed],
    }));
    noteMutation.mutate({ ticketId: activeTicket.id, body: trimmed });
    setNote("");
  };

  const submitReply = () => {
    const trimmed = reply.trim();
    if (!trimmed || !activeTicket.id) return;
    pushOptimisticTimeline(activeTicket.id, "Message queued from support", "good");
    messageMutation.mutate({ ticketId: activeTicket.id, body: trimmed });
    setReply("");
  };

  const submitNewTicket = () => {
    if (!newTicket.title.trim() || createMutation.isPending) return;
    const tempId = `temp-${Date.now()}`;
    const ownerId = newTicket.ownerId === "__unassigned" ? null : newTicket.ownerId || currentUser?.id || null;
    const owner = ownerId
      ? assigneesQuery.data?.find((item) => item.id === ownerId)
      : null;
    const optimisticTicket: Ticket = {
      id: tempId,
      orderId: null,
      orderNumber: newTicket.orderNumber.trim() || null,
      shipment: newTicket.orderNumber.trim() ? `#${newTicket.orderNumber.trim().replace(/^#/, "")}` : "Creating...",
      customer: "Resolving order context",
      company: "Support desk",
      issue: newTicket.title.trim(),
      priority: newTicket.priority,
      status: "open",
      source: "manager",
      owner: ownerId ? (ownerId === currentUser?.id ? "mine" : "team") : "unassigned",
      ownerId,
      ownerName: owner?.name || owner?.email || (ownerId === currentUser?.id ? currentUser?.name || currentUser.email : "Unassigned"),
      queueName: "Routing queue",
      lastReplyBy: "support",
      age: "now",
      sla: 100,
      slaDueAt: null,
      route: "Loading linked order...",
      driver: "Not assigned",
      driverPhone: "-",
      warehouse: "-",
      lastMessage: newTicket.summary.trim() || newTicket.title.trim(),
      orderFacts: [
        { label: "Ticket", value: "Creating..." },
        { label: "Order", value: newTicket.orderNumber.trim() || "-" },
        { label: "Source", value: "Manager" },
        { label: "Queue", value: "Routing queue" },
        { label: "SLA", value: "100% left" },
      ],
      timeline: [{ time: "now", title: "Ticket is being created", tone: "good", pending: true }],
      checkpoints: [
        { label: "Opened", state: "active" },
        { label: "Assigned", state: ownerId ? "active" : "idle" },
        { label: "Action", state: "idle" },
        { label: "Waiting", state: "idle" },
        { label: "Resolved", state: "idle" },
      ],
      notes: [],
    };
    setOptimisticTickets((current) => [optimisticTicket, ...current]);
    setActiveId(tempId);
    createMutation.mutate({ ...newTicket, tempId });
  };

  const assignActiveTicket = (ownerIdRaw: string) => {
    if (!activeTicket.id || activeTicket.id.startsWith("temp-")) return;
    const ownerId = ownerIdRaw === "__unassigned" ? null : ownerIdRaw;
    const owner = ownerId ? assigneesQuery.data?.find((item) => item.id === ownerId) : null;
    const ownerName = owner?.name || owner?.email || (ownerId === currentUser?.id ? currentUser?.name || currentUser.email : "Unassigned");
    setLocalAssignees((current) => ({
      ...current,
      [activeTicket.id]: { ownerId, ownerName },
    }));
    pushOptimisticTimeline(activeTicket.id, ownerId ? `Assigned to ${ownerName}` : "Moved to unassigned queue", "warn");
    assignMutation.mutate({ ticketId: activeTicket.id, ownerId });
  };

  return (
    <PageShell className="pb-8">
      <div className="min-h-[calc(100dvh-7rem)] overflow-hidden rounded-lg border bg-slate-50 text-slate-950 shadow-sm">
        <header className="border-b bg-white px-4 py-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-teal-200 bg-teal-50 text-teal-700">
                <Headphones className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold tracking-tight">Support Dashboard</h1>
                <p className="truncate text-sm text-slate-500">
                  Resolve shipment exceptions with order, driver, customer, and SLA context in one view.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-lg gap-2"
                onClick={() => {
                  setStatusFilter("all");
                  setScopeFilter("all");
                  setSlaFilter("risk");
                }}
              >
                <Bot className="h-4 w-4" />
                SLA risk
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-9 rounded-lg gap-2 bg-slate-950 hover:bg-slate-800"
                onClick={() => setNewTicketOpen((value) => !value)}
              >
                <MessageSquareText className="h-4 w-4" />
                New ticket
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-lg gap-2"
                disabled={supportTicketsQuery.isFetching}
                onClick={() => {
                  void supportTicketsQuery.refetch();
                  if (activeTicketId) void queryClient.invalidateQueries({ queryKey: ["manager-support-ticket", activeTicketId] });
                }}
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Avatar className="h-9 w-9 rounded-lg">
                <AvatarFallback className="rounded-lg bg-slate-900 text-xs text-white">SA</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        <nav className="border-b bg-white px-3 py-2">
          <div className="grid gap-2 rounded-lg border bg-slate-50 p-1 md:grid-cols-3">
            {[
              { value: "tickets", label: "Tickets", hint: "Live support desk" },
              { value: "queues", label: "Queues", hint: "Team inboxes" },
              { value: "rules", label: "Assignment rules", hint: "Auto routing" },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                disabled={item.value !== "tickets" && !canConfigureSupport}
                onClick={() => setSupportView(item.value as SupportView)}
                className={cn(
                  "rounded-md px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
                  supportView === item.value
                    ? "bg-slate-950 text-white shadow-sm"
                    : "bg-white text-slate-600 hover:bg-slate-100",
                )}
              >
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className={cn("block text-xs", supportView === item.value ? "text-white/70" : "text-slate-400")}>
                  {item.value !== "tickets" && !canConfigureSupport ? "Requires support.configure" : item.hint}
                </span>
              </button>
            ))}
          </div>
        </nav>

        {supportView === "tickets" ? (
          <>
        {newTicketOpen ? (
          <section className="border-b bg-white px-4 py-3">
            <div className="rounded-xl border border-teal-100 bg-gradient-to-br from-teal-50 via-white to-sky-50 p-4 shadow-sm">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_10rem]">
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    value={newTicket.title}
                    onChange={(event) => setNewTicket((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Issue title, e.g. late pickup or COD dispute"
                    className="h-10 rounded-lg bg-white"
                  />
                  <Input
                    value={newTicket.orderNumber}
                    onChange={(event) => setNewTicket((current) => ({ ...current, orderNumber: event.target.value }))}
                    placeholder="Optional order number, e.g. 990000000006"
                    className="h-10 rounded-lg bg-white"
                  />
                  <Textarea
                    value={newTicket.summary}
                    onChange={(event) => setNewTicket((current) => ({ ...current, summary: event.target.value }))}
                    placeholder="Short internal context for support operators..."
                    className="min-h-20 rounded-lg bg-white md:col-span-2"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Select
                    value={newTicket.priority}
                    onValueChange={(value) =>
                      setNewTicket((current) => ({ ...current, priority: value as SupportTicketPriority }))
                    }
                  >
                    <SelectTrigger className="h-10 w-full rounded-lg bg-white">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={newTicket.ownerId || currentUser?.id || "__unassigned"}
                    onValueChange={(value) =>
                      setNewTicket((current) => ({ ...current, ownerId: value }))
                    }
                  >
                    <SelectTrigger className="h-10 w-full rounded-lg bg-white">
                      <SelectValue placeholder="Assign to" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unassigned">Unassigned</SelectItem>
                      {currentUser ? <SelectItem value={currentUser.id}>Assign to me</SelectItem> : null}
                      {assigneesQuery.data
                        ?.filter((assignee) => assignee.id !== currentUser?.id)
                        .map((assignee) => (
                          <SelectItem key={assignee.id} value={assignee.id}>
                            {assignee.name || assignee.email}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    className="h-10 rounded-lg bg-slate-950 hover:bg-slate-800"
                    disabled={!newTicket.title.trim() || createMutation.isPending}
                    onClick={submitNewTicket}
                  >
                    {createMutation.isPending ? "Creating..." : "Create ticket"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 rounded-lg"
                    onClick={() => setNewTicketOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid gap-3 border-b bg-white p-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Open tickets" value={openCount} icon={MessageSquareText} />
          <Metric label="SLA risk" value={slaRiskCount} icon={ShieldAlert} tone="bad" />
          <Metric label="Waiting response" value={waitingCount} icon={Clock3} tone="warn" />
          <Metric label="Resolved today" value={resolvedTodayCount} icon={CheckCircle2} tone="good" />
        </section>

        <main className="grid min-h-[760px] grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)] 2xl:grid-cols-[21rem_minmax(0,1fr)_22rem]">
          <aside className="border-b bg-white xl:border-b-0 xl:border-r">
            <div className="border-b p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Ticket queue</p>
                  <p className="mt-1 text-xs text-slate-500">{filteredTickets.length} visible cases</p>
                </div>
                <SupportChip className={slaViewClasses(activeSla.tone)}>
                  {activeSla.label} · {activeTicket.sla}%
                </SupportChip>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg border bg-slate-50 p-1">
                {scopeFilters.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setScopeFilter(filter.value)}
                    className={cn(
                      "rounded-md px-2 py-1.5 text-[11px] font-semibold transition",
                      scopeFilter === filter.value
                        ? "bg-slate-950 text-white shadow-sm"
                        : "text-slate-500 hover:bg-white hover:text-slate-900",
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ticket, order, customer, phone..."
                  className="h-9 rounded-lg bg-white pl-8 text-sm"
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {statusFilters.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setStatusFilter(filter)}
                    className={cn(
                      "rounded-md border px-2.5 py-1.5 text-xs font-medium capitalize transition",
                      statusFilter === filter
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    {statusLabels[filter]}
                  </button>
                ))}
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 2xl:grid-cols-3">
                <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as typeof priorityFilter)}>
                  <SelectTrigger className="h-9 rounded-lg bg-white text-xs">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityFilters.map((filter) => (
                      <SelectItem key={filter.value} value={filter.value}>
                        {filter.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sourceFilter} onValueChange={(value) => setSourceFilter(value as typeof sourceFilter)}>
                  <SelectTrigger className="h-9 rounded-lg bg-white text-xs">
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceFilters.map((filter) => (
                      <SelectItem key={filter.value} value={filter.value}>
                        {filter.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={slaFilter} onValueChange={(value) => setSlaFilter(value as SlaFilter)}>
                  <SelectTrigger className="h-9 rounded-lg bg-white text-xs">
                    <SelectValue placeholder="SLA" />
                  </SelectTrigger>
                  <SelectContent>
                    {slaFilters.map((filter) => (
                      <SelectItem key={filter.value} value={filter.value}>
                        {filter.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {hasActiveQueueFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-8 w-full rounded-lg text-xs text-slate-500 hover:text-slate-950"
                  onClick={() => {
                    setStatusFilter("all");
                    setScopeFilter("mine");
                    setPriorityFilter("all");
                    setSourceFilter("all");
                    setSlaFilter("all");
                    setQuery("");
                  }}
                >
                  Clear filters
                </Button>
              ) : null}
            </div>

            <div className="max-h-[34rem] overflow-y-auto xl:max-h-none">
              {filteredTickets.length === 0 ? (
                <div className="m-3 rounded-xl border border-dashed bg-slate-50 p-5 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-400 shadow-sm">
                    <Inbox className="h-5 w-5" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-900">No matching tickets</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Adjust scope, status, or search. Backend data will use this same empty state.
                  </p>
                </div>
              ) : (
                filteredTickets.map((ticket) => {
                  const visibleStatus = localStatuses[ticket.id] ?? ticket.status;
                  const slaView = resolveSlaView({ ...ticket, status: visibleStatus });
                  return (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setActiveId(ticket.id)}
                  className={cn(
                    "block w-full border-b px-3 py-3 text-left transition hover:bg-slate-50",
                    activeTicket.id === ticket.id && "bg-gradient-to-r from-teal-50 via-white to-sky-50",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-950">{ticket.shipment}</span>
                        <SupportChip className={priorityClasses(ticket.priority)}>{ticket.priority}</SupportChip>
                      </div>
                      <div className="mt-1 truncate text-sm font-medium">{ticket.issue}</div>
                      <div className="mt-1 truncate text-xs text-slate-500">
                        {ticket.customer} - {ticket.company}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-slate-500">{ticket.age}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <SupportChip className={statusClasses(visibleStatus)}>{statusLabels[visibleStatus]}</SupportChip>
                    <SupportChip className={sourceClasses(ticket.source)}>{sourceLabels[ticket.source]}</SupportChip>
                    <SupportChip className={slaViewClasses(slaView.tone)}>{slaView.label}</SupportChip>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                    <span className="truncate">Owner: {ticket.ownerName}</span>
                    <span className="truncate text-right">Last: {lastReplyLabels[ticket.lastReplyBy]}</span>
                    <span className="col-span-2 truncate">SLA: {slaView.detail}</span>
                    <span className="col-span-2 truncate">{ticket.route}</span>
                  </div>
                </button>
                  );
                })
              )}
              {supportTicketsQuery.hasNextPage ? (
                <div className="border-b p-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 w-full rounded-lg"
                    disabled={supportTicketsQuery.isFetchingNextPage}
                    onClick={() => supportTicketsQuery.fetchNextPage()}
                  >
                    {supportTicketsQuery.isFetchingNextPage ? "Loading..." : "Load more tickets"}
                  </Button>
                </div>
              ) : null}
            </div>
          </aside>

          <section className="min-w-0 bg-slate-50">
            <div className="border-b bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold tracking-tight">{activeTicket.shipment}</h2>
                    <SupportChip className={priorityClasses(activeTicket.priority)}>
                      {activeTicket.priority} priority
                    </SupportChip>
                    <SupportChip className={statusClasses(activeTicket.status)}>{statusLabels[activeTicket.status]}</SupportChip>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {activeTicket.issue} on {activeTicket.route}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <SupportChip className={sourceClasses(activeTicket.source)}>{sourceLabels[activeTicket.source]}</SupportChip>
                    <SupportChip className="border-slate-200 bg-slate-50 text-slate-700">
                      Owner: {activeTicket.ownerName}
                    </SupportChip>
                    <SupportChip className="border-slate-200 bg-slate-50 text-slate-700">
                      Last reply: {lastReplyLabels[activeTicket.lastReplyBy]}
                    </SupportChip>
                    <SupportChip className={slaViewClasses(activeSla.tone)}>
                      {activeSla.label}: {activeTicket.sla}% left
                    </SupportChip>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Select
                    value={activeTicket.ownerId || "__unassigned"}
                    onValueChange={assignActiveTicket}
                    disabled={!activeTicket.id || activeTicket.id.startsWith("temp-") || assignMutation.isPending}
                  >
                    <SelectTrigger className="h-9 w-[11rem] rounded-lg bg-white">
                      <SelectValue placeholder="Assign" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unassigned">Unassigned</SelectItem>
                      {currentUser ? <SelectItem value={currentUser.id}>Assign to me</SelectItem> : null}
                      {assigneesQuery.data
                        ?.filter((assignee) => assignee.id !== currentUser?.id)
                        .map((assignee) => (
                          <SelectItem key={assignee.id} value={assignee.id}>
                            {assignee.name || assignee.email}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 rounded-lg gap-2 bg-teal-700 hover:bg-teal-800"
                    disabled={!activeTicket.id || activeTicket.driverPhone === "-"}
                    onClick={() => {
                      if (activeTicket.driverPhone !== "-") window.location.href = `tel:${activeTicket.driverPhone}`;
                    }}
                  >
                    <Phone className="h-4 w-4" />
                    Call
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 rounded-lg gap-2"
                    disabled={!activeTicket.id}
                    onClick={() => setReply((current) => current || `Hi, we are checking ${activeTicket.shipment}. `)}
                  >
                    <Send className="h-4 w-4" />
                    Message
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 rounded-lg gap-2"
                    disabled={!activeTicket.id || activeTicket.status === "escalated" || escalateMutation.isPending}
                    onClick={() => {
                      if (!activeTicket.id) return;
                      setLocalStatuses((current) => ({ ...current, [activeTicket.id]: "escalated" }));
                      pushOptimisticTimeline(activeTicket.id, "Ticket escalated", "bad");
                      escalateMutation.mutate(activeTicket.id);
                    }}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                    Escalate
                  </Button>
                </div>
              </div>

              <div className="mt-4 rounded-xl border bg-slate-50 p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Workflow
                  </span>
                  {statusFilters
                    .filter((filter): filter is TicketStatus => filter !== "all")
                    .map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() =>
                          activeTicket.id
                            ? (setLocalStatuses((current) => ({
                                ...current,
                                [activeTicket.id]: status,
                              })),
                              pushOptimisticTimeline(
                                activeTicket.id,
                                `Status changed to ${statusLabels[status]}`,
                                status === "resolved" ? "good" : status === "escalated" ? "bad" : "warn",
                              ),
                              statusMutation.mutate({ ticketId: activeTicket.id, status }))
                            : undefined
                        }
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                          activeTicket.status === status
                            ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950",
                        )}
                      >
                        {statusLabels[status]}
                      </button>
                    ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 p-4 2xl:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="space-y-4">
                <div className="rounded-lg border bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">Customer message</h3>
                    <Badge variant="outline" className="rounded-md">
                      {activeTicket.age} open
                    </Badge>
                  </div>
                  <p className="mt-3 rounded-lg border bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                    {activeTicket.lastMessage}
                  </p>
                  <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_9rem]">
                    <Input
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      placeholder="Write a customer/driver-visible update..."
                      className="h-10 rounded-lg bg-white"
                      disabled={!activeTicket.id}
                    />
                    <Button
                      type="button"
                      className="h-10 rounded-lg bg-slate-950 hover:bg-slate-800"
                      disabled={!activeTicket.id || !reply.trim() || messageMutation.isPending}
                      onClick={submitReply}
                    >
                      {messageMutation.isPending ? "Sending..." : "Send update"}
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border bg-white p-4">
                  <h3 className="text-sm font-semibold">Route checkpoints</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-5">
                    {activeTicket.checkpoints.map((checkpoint, index) => (
                      <div key={checkpoint.label} className="relative">
                        {index < activeTicket.checkpoints.length - 1 ? (
                          <div className="absolute left-5 top-5 hidden h-px w-full bg-slate-200 sm:block" />
                        ) : null}
                        <div className="relative flex flex-col items-start gap-2">
                          <span
                            className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-full border-2",
                              checkpointClasses(checkpoint.state),
                              checkpoint.state !== "idle" && "text-white",
                            )}
                          >
                            {checkpoint.state === "done" ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : checkpoint.state === "blocked" ? (
                              <AlertCircle className="h-4 w-4" />
                            ) : (
                              <span className="h-2 w-2 rounded-full bg-current" />
                            )}
                          </span>
                          <span className="text-xs font-medium text-slate-700">{checkpoint.label}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border bg-white p-4">
                  <h3 className="text-sm font-semibold">Case timeline</h3>
                  <div className="mt-4 space-y-3">
                    {activeTicket.timeline.map((event) => (
                      <div key={`${event.time}-${event.title}`} className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3">
                        <span className="font-mono text-xs text-slate-500">{event.time}</span>
                        <div className="flex gap-3">
                          <span
                            className={cn(
                              "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                              event.tone === "bad" && "bg-red-500",
                              event.tone === "warn" && "bg-amber-500",
                              event.tone === "good" && "bg-emerald-500",
                              !event.tone && "bg-slate-300",
                            )}
                          />
                          <p className="text-sm text-slate-700">
                            {event.title}
                            {event.pending ? <span className="ml-2 text-xs text-slate-400">syncing...</span> : null}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-lg border bg-white p-4">
                  <h3 className="text-sm font-semibold">Order facts</h3>
                  <dl className="mt-3 space-y-3">
                    {activeTicket.orderFacts.map((fact) => (
                      <div key={fact.label} className="flex justify-between gap-3 border-b pb-2 last:border-0 last:pb-0">
                        <dt className="text-xs text-slate-500">{fact.label}</dt>
                        <dd className="text-right text-xs font-medium text-slate-900">{fact.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm" className="h-8 rounded-lg gap-2">
                      <Link href={activeTicket.orderId ? `/dashboard/manager/orders/${activeTicket.orderId}` : "/dashboard/manager/orders"}>
                        <PackageCheck className="h-3.5 w-3.5" />
                        Open order
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 rounded-lg gap-2">
                      <FileText className="h-3.5 w-3.5" />
                      Invoice
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 rounded-lg gap-2">
                      <Paperclip className="h-3.5 w-3.5" />
                      Label
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">SLA risk</h3>
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        activeSla.tone === "bad" && "text-red-600",
                        activeSla.tone === "warn" && "text-amber-600",
                        activeSla.tone === "good" && "text-emerald-600",
                        activeSla.tone === "muted" && "text-slate-500",
                      )}
                    >
                      {activeSla.label}
                    </span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-slate-100">
                    <div
                      className={cn(
                        "h-2 rounded-full",
                        activeTicket.sla < 25 ? "bg-red-500" : activeTicket.sla < 55 ? "bg-amber-500" : "bg-emerald-500",
                      )}
                      style={{ width: `${activeTicket.sla}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {activeSla.detail}. The SLA monitor escalates overdue open tickets automatically.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <aside className="border-t bg-white lg:col-span-2 2xl:col-span-1 2xl:border-l 2xl:border-t-0">
            <div className="space-y-4 p-4">
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">Customer</h3>
                  <SupportChip className={sourceClasses(activeTicket.source)}>{sourceLabels[activeTicket.source]}</SupportChip>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <Avatar className="h-10 w-10 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-blue-50 text-blue-700">
                      {activeTicket.customer
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{activeTicket.customer}</div>
                    <div className="truncate text-xs text-slate-500">{activeTicket.company}</div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border bg-slate-50 p-2">
                    <div className="text-slate-500">Last reply</div>
                    <div className="mt-1 font-semibold text-slate-900">{lastReplyLabels[activeTicket.lastReplyBy]}</div>
                  </div>
                  <div className="rounded-lg border bg-slate-50 p-2">
                    <div className="text-slate-500">Case owner</div>
                    <div className="mt-1 truncate font-semibold text-slate-900">{activeTicket.ownerName}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-semibold">Driver and location</h3>
                <div className="mt-3 space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-slate-400" />
                    <span>{activeTicket.driver}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <span>{activeTicket.driverPhone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Warehouse className="h-4 w-4 text-slate-400" />
                    <span>{activeTicket.warehouse}</span>
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-lg border bg-slate-100 p-3">
                  <div className="relative h-36">
                    <div className="absolute inset-x-4 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-300" />
                    <div className="absolute left-4 top-1/2 h-1 w-[58%] -translate-y-1/2 rounded-full bg-teal-600" />
                    <div className="absolute left-3 top-[calc(50%-0.65rem)] flex h-6 w-6 items-center justify-center rounded-full bg-teal-700 text-white">
                      <MapPin className="h-3.5 w-3.5" />
                    </div>
                    <div className="absolute left-[58%] top-[calc(50%-0.75rem)] flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-amber-500 text-white shadow-sm">
                      <Truck className="h-3.5 w-3.5" />
                    </div>
                    <div className="absolute right-4 top-[calc(50%-0.65rem)] flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-white">
                      <Warehouse className="h-3.5 w-3.5" />
                    </div>
                    <div className="absolute bottom-1 left-1 text-xs font-medium text-slate-600">Live route preview</div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-semibold">Internal notes</h3>
                <div className="mt-3 space-y-2">
                  {visibleNotes.map((item, index) => (
                    <div key={`${item}-${index}`} className="rounded-lg bg-slate-50 p-2 text-xs leading-5 text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Add an internal note..."
                    className="min-h-24 rounded-lg text-sm"
                  />
                  <Button
                    type="button"
                    onClick={submitNote}
                    size="sm"
                    disabled={!note.trim() || noteMutation.isPending}
                    className="h-9 w-full rounded-lg gap-2"
                  >
                    <UserRound className="h-4 w-4" />
                    Save note
                  </Button>
                </div>
              </div>
            </div>
          </aside>
        </main>
          </>
        ) : supportView === "queues" ? (
          <section className="grid gap-4 bg-slate-50 p-4 xl:grid-cols-[24rem_minmax(0,1fr)]">
            <div className="rounded-lg border bg-white p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Support queue
                </p>
                <h2 className="mt-1 text-lg font-semibold">
                  {queueForm.id ? "Edit queue" : "Create queue"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Queues are the operational inboxes tickets route into before an operator owns them.
                </p>
              </div>
              <div className="mt-4 space-y-3">
                <Input
                  value={queueForm.name}
                  onChange={(event) => setQueueForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="General Support"
                  className="h-10 rounded-lg"
                />
                <Input
                  value={queueForm.code}
                  onChange={(event) => setQueueForm((current) => ({ ...current, code: event.target.value }))}
                  placeholder="general_support"
                  className="h-10 rounded-lg"
                />
                <Textarea
                  value={queueForm.description}
                  onChange={(event) => setQueueForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="What kind of tickets should land here?"
                  className="min-h-20 rounded-lg"
                />
                <Select
                  value={queueForm.defaultOwnerId}
                  onValueChange={(value) => setQueueForm((current) => ({ ...current, defaultOwnerId: value }))}
                >
                  <SelectTrigger className="h-10 rounded-lg">
                    <SelectValue placeholder="Default owner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">No default owner</SelectItem>
                    {assigneesQuery.data?.map((assignee) => (
                      <SelectItem key={assignee.id} value={assignee.id}>
                        {assignee.name || assignee.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2 text-sm">
                  <span>Default fallback queue</span>
                  <input
                    type="checkbox"
                    checked={queueForm.isDefault}
                    onChange={(event) => setQueueForm((current) => ({ ...current, isDefault: event.target.checked }))}
                  />
                </label>
                <label className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2 text-sm">
                  <span>Active</span>
                  <input
                    type="checkbox"
                    checked={queueForm.isActive}
                    onChange={(event) => setQueueForm((current) => ({ ...current, isActive: event.target.checked }))}
                  />
                </label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    className="h-10 flex-1 rounded-lg bg-slate-950 hover:bg-slate-800"
                    disabled={!queueForm.name.trim() || queueMutation.isPending}
                    onClick={() => queueMutation.mutate(queueForm)}
                  >
                    {queueMutation.isPending ? "Saving..." : queueForm.id ? "Update queue" : "Create queue"}
                  </Button>
                  {queueForm.id ? (
                    <Button type="button" variant="outline" className="h-10 rounded-lg" onClick={() => setQueueForm(emptyQueueForm)}>
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Configured queues</h2>
                  <p className="text-sm text-slate-500">Loaded {queuesQuery.data?.length ?? 0} support queues.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-lg"
                  onClick={() => void queuesQuery.refetch()}
                  disabled={queuesQuery.isFetching}
                >
                  Refresh
                </Button>
              </div>
              <div className="mt-4 overflow-hidden rounded-xl border">
                <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_8rem_9rem] bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <span>Queue</span>
                  <span>Owner</span>
                  <span>Status</span>
                  <span className="text-right">Actions</span>
                </div>
                <div className="max-h-[30rem] overflow-y-auto">
                  {(queuesQuery.data ?? []).length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-500">No queues configured yet.</div>
                  ) : (
                    (queuesQuery.data ?? []).map((queue: SupportQueue) => (
                      <div key={queue.id} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_8rem_9rem] items-center gap-3 border-t px-3 py-3 text-sm">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{queue.name}</div>
                          <div className="truncate text-xs text-slate-500">{queue.code}</div>
                        </div>
                        <div className="truncate text-slate-600">{queue.defaultOwnerId || "No default owner"}</div>
                        <div className="flex flex-wrap gap-1">
                          <SupportChip className={queue.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}>
                            {queue.isActive ? "Active" : "Paused"}
                          </SupportChip>
                          {queue.isDefault ? <SupportChip className="border-blue-200 bg-blue-50 text-blue-700">Default</SupportChip> : null}
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg"
                            onClick={() =>
                              setQueueForm({
                                id: queue.id,
                                name: queue.name,
                                code: queue.code,
                                description: queue.description ?? "",
                                defaultOwnerId: queue.defaultOwnerId ?? "__none",
                                isDefault: queue.isDefault,
                                isActive: queue.isActive,
                              })
                            }
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg border-red-200 text-red-600 hover:bg-red-50"
                            disabled={deleteQueueMutation.isPending}
                            onClick={() => deleteQueueMutation.mutate(queue.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="grid gap-4 bg-slate-50 p-4 xl:grid-cols-[24rem_minmax(0,1fr)]">
            <div className="rounded-lg border bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Assignment rule
              </p>
              <h2 className="mt-1 text-lg font-semibold">{ruleForm.id ? "Edit rule" : "Create rule"}</h2>
              <p className="mt-1 text-sm text-slate-500">
                Rules are evaluated in sort order. First match routes the ticket to its queue and optional owner.
              </p>
              <div className="mt-4 space-y-3">
                <Input
                  value={ruleForm.name}
                  onChange={(event) => setRuleForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="System alerts to operations"
                  className="h-10 rounded-lg"
                />
                <Input
                  value={ruleForm.code}
                  onChange={(event) => setRuleForm((current) => ({ ...current, code: event.target.value }))}
                  placeholder="system_alerts_ops"
                  className="h-10 rounded-lg"
                />
                <Select value={ruleForm.queueId} onValueChange={(value) => setRuleForm((current) => ({ ...current, queueId: value }))}>
                  <SelectTrigger className="h-10 rounded-lg">
                    <SelectValue placeholder="Target queue" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">No queue</SelectItem>
                    {queuesQuery.data?.map((queue) => (
                      <SelectItem key={queue.id} value={queue.id}>
                        {queue.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="grid gap-3 md:grid-cols-2">
                  <Select value={ruleForm.source} onValueChange={(value) => setRuleForm((current) => ({ ...current, source: value as RuleForm["source"] }))}>
                    <SelectTrigger className="h-10 rounded-lg">
                      <SelectValue placeholder="Source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any source</SelectItem>
                      <SelectItem value="customer_chat">Customer chat</SelectItem>
                      <SelectItem value="driver_app">Driver app</SelectItem>
                      <SelectItem value="system_alert">System alert</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={ruleForm.priority} onValueChange={(value) => setRuleForm((current) => ({ ...current, priority: value as RuleForm["priority"] }))}>
                    <SelectTrigger className="h-10 rounded-lg">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any priority</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  value={ruleForm.routeContains}
                  onChange={(event) => setRuleForm((current) => ({ ...current, routeContains: event.target.value }))}
                  placeholder="Route contains, e.g. Tashkent"
                  className="h-10 rounded-lg"
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <Select value={ruleForm.defaultOwnerId} onValueChange={(value) => setRuleForm((current) => ({ ...current, defaultOwnerId: value }))}>
                    <SelectTrigger className="h-10 rounded-lg">
                      <SelectValue placeholder="Owner override" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Queue default owner</SelectItem>
                      {assigneesQuery.data?.map((assignee) => (
                        <SelectItem key={assignee.id} value={assignee.id}>
                          {assignee.name || assignee.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    value={ruleForm.sortOrder}
                    onChange={(event) => setRuleForm((current) => ({ ...current, sortOrder: event.target.value }))}
                    placeholder="100"
                    className="h-10 rounded-lg"
                  />
                </div>
                <label className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2 text-sm">
                  <span>Active rule</span>
                  <input
                    type="checkbox"
                    checked={ruleForm.isActive}
                    onChange={(event) => setRuleForm((current) => ({ ...current, isActive: event.target.checked }))}
                  />
                </label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    className="h-10 flex-1 rounded-lg bg-slate-950 hover:bg-slate-800"
                    disabled={!ruleForm.name.trim() || ruleMutation.isPending}
                    onClick={() => ruleMutation.mutate(ruleForm)}
                  >
                    {ruleMutation.isPending ? "Saving..." : ruleForm.id ? "Update rule" : "Create rule"}
                  </Button>
                  {ruleForm.id ? (
                    <Button type="button" variant="outline" className="h-10 rounded-lg" onClick={() => setRuleForm(emptyRuleForm)}>
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Assignment rules</h2>
                  <p className="text-sm text-slate-500">Loaded {rulesQuery.data?.length ?? 0} routing rules.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-lg"
                  onClick={() => void rulesQuery.refetch()}
                  disabled={rulesQuery.isFetching}
                >
                  Refresh
                </Button>
              </div>
              <div className="mt-4 overflow-hidden rounded-xl border">
                <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_6rem_9rem] bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <span>Rule</span>
                  <span>Match</span>
                  <span>Queue</span>
                  <span>Order</span>
                  <span className="text-right">Actions</span>
                </div>
                <div className="max-h-[30rem] overflow-y-auto">
                  {(rulesQuery.data ?? []).length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-500">No assignment rules configured yet.</div>
                  ) : (
                    (rulesQuery.data ?? []).map((rule: SupportAssignmentRule) => (
                      <div key={rule.id} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_6rem_9rem] items-center gap-3 border-t px-3 py-3 text-sm">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{rule.name}</div>
                          <div className="truncate text-xs text-slate-500">{rule.code}</div>
                        </div>
                        <div className="min-w-0 text-xs text-slate-600">
                          <div>Source: {rule.source ?? "any"}</div>
                          <div>Priority: {rule.priority ?? "any"}</div>
                          {rule.routeContains ? <div className="truncate">Route: {rule.routeContains}</div> : null}
                        </div>
                        <div className="truncate text-slate-600">{rule.queueName || "No queue"}</div>
                        <div>{rule.sortOrder}</div>
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg"
                            onClick={() =>
                              setRuleForm({
                                id: rule.id,
                                name: rule.name,
                                code: rule.code,
                                queueId: rule.queueId ?? "__none",
                                source: rule.source ?? "any",
                                priority: rule.priority ?? "any",
                                routeContains: rule.routeContains ?? "",
                                defaultOwnerId: rule.defaultOwnerId ?? "__none",
                                sortOrder: String(rule.sortOrder ?? 100),
                                isActive: rule.isActive,
                              })
                            }
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg border-red-200 text-red-600 hover:bg-red-50"
                            disabled={deleteRuleMutation.isPending}
                            onClick={() => deleteRuleMutation.mutate(rule.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </PageShell>
  );
}

