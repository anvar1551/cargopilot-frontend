"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, RotateCw } from "lucide-react";
import { toast } from "sonner";

import {
  FinanceEmptyState,
  FinancePager,
  FinanceStatusBadge,
  financeErrorMessage,
  formatDate,
} from "@/components/manager/finance/finance-ui";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listFinanceSourceEvents,
  retryFinanceSourceEvent,
  type FinanceSourceEventStatus,
} from "@/lib/finance";
import { hasPermission, type AuthUser } from "@/lib/auth";

export default function FinanceExceptionsWorkspace({
  user,
}: {
  user: AuthUser | null;
}) {
  const client = useQueryClient();
  const canManage = hasPermission(user, "finance.exceptions.manage");
  const [status, setStatus] = useState<FinanceSourceEventStatus | "all">(
    "exception",
  );
  const [page, setPage] = useState(1);
  const [cursors, setCursors] = useState<Array<string | undefined>>([
    undefined,
  ]);
  const cursor = cursors[page - 1];
  const events = useQuery({
    queryKey: ["finance", "source-events", status, page, cursor],
    queryFn: () =>
      listFinanceSourceEvents({
        status: status === "all" ? undefined : status,
        cursor,
        limit: 25,
      }),
  });
  const retry = useMutation({
    mutationFn: retryFinanceSourceEvent,
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: ["finance", "source-events"],
      });
      await client.invalidateQueries({ queryKey: ["finance", "exceptions"] });
      toast.success("Source event returned to the posting queue");
    },
    onError: (error) =>
      toast.error(financeErrorMessage(error, "Could not retry source event")),
  });
  const changeStatus = (value: string) => {
    setStatus(value as FinanceSourceEventStatus | "all");
    setPage(1);
    setCursors([undefined]);
  };
  const next = () => {
    const nextCursor = events.data?.pageInfo.nextCursor;
    if (!nextCursor) return;
    setCursors((current) => {
      const copy = [...current];
      copy[page] = nextCursor;
      return copy;
    });
    setPage((value) => value + 1);
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Posting event monitor</CardTitle>
          <CardDescription>
            Operational events are idempotently converted into finance
            documents. Exceptions remain visible until corrected and retried.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Select value={status} onValueChange={changeStatus}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              <SelectItem value="exception">Exceptions</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="posted">Posted</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => void events.refetch()}>
            <RefreshCw /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {events.data?.items.length ? (
          <div className="overflow-hidden rounded-2xl border">
            <div className="max-h-[560px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-white">
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Posting result</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.data.items.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <p className="font-semibold">{event.eventType}</p>
                        <p className="text-xs text-slate-500">
                          Occurred {formatDate(event.occurredAt, true)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="capitalize">
                          {event.sourceType.replaceAll("_", " ")}
                        </p>
                        <p
                          className="max-w-52 truncate font-mono text-xs text-slate-500"
                          title={event.sourceId}
                        >
                          {event.sourceId}
                        </p>
                      </TableCell>
                      <TableCell>
                        {event.financeJournalEntry ? (
                          <>
                            <p className="font-mono font-semibold">
                              {event.financeJournalEntry.journalNumber}
                            </p>
                            <p className="text-xs text-slate-500">
                              {event.resolvedRule?.code ?? "Rule unavailable"}
                            </p>
                          </>
                        ) : event.lastErrorMessage ? (
                          <div className="flex max-w-sm gap-2 text-rose-700">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span className="text-xs">
                              {event.lastErrorMessage}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500">
                            Awaiting posting
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{event.attempts}</TableCell>
                      <TableCell>
                        <FinanceStatusBadge status={event.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {canManage && event.status === "exception" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={retry.isPending}
                            onClick={() => retry.mutate(event.id)}
                          >
                            <RotateCw /> Retry
                          </Button>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="px-4 pb-4">
              <FinancePager
                page={page}
                canPrevious={page > 1}
                canNext={Boolean(events.data.pageInfo.hasMore)}
                onPrevious={() => setPage((value) => value - 1)}
                onNext={next}
              />
            </div>
          </div>
        ) : (
          <FinanceEmptyState
            title={
              status === "exception"
                ? "No posting exceptions"
                : "No source events"
            }
            description={
              status === "exception"
                ? "Operational finance events are processing without unresolved configuration failures."
                : "No events match the selected processing status."
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
