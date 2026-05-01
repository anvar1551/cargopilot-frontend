"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Clock3, RefreshCw, Route, TrendingUp, Wallet } from "lucide-react";

import PageShell from "@/components/layout/PageShell";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchManagerAnalyticsFinanceQueueV2,
  fetchManagerAnalyticsSummaryV2,
  fetchManagerAnalyticsTrendV2,
  fetchManagerAnalyticsWarningsV2,
  invalidateManagerAnalyticsV2,
  subscribeManagerAnalyticsStream,
  type ManagerAnalyticsV2FinanceQueue,
  type ManagerAnalyticsV2Summary,
  type ManagerAnalyticsV2Trend,
  type ManagerAnalyticsV2Warnings,
} from "@/lib/manager";
import { getStatusLabel } from "@/lib/i18n/labels";
import { usePageVisibility } from "@/lib/usePageVisibility";

function formatMoney(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value || 0);
}

function StatCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <Card className="border-border/70">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
          <div className="text-3xl font-semibold tracking-tight">{value}</div>
        </div>
        <div className={`rounded-2xl p-3 ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export function ManagerAnalyticsV2Page() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const isPageVisible = usePageVisibility();

  const [rangeDays, setRangeDays] = useState("30");
  const [queueStatus, setQueueStatus] = useState<"all" | "expected" | "held">("all");
  const [queueKind, setQueueKind] = useState<"all" | "cod" | "service_charge">("all");
  const [queuePage, setQueuePage] = useState(1);
  const [streamConnectedAt, setStreamConnectedAt] = useState<string | null>(null);

  useEffect(() => {
    setQueuePage(1);
  }, [queueStatus, queueKind]);

  const summaryQuery = useQuery<ManagerAnalyticsV2Summary, any>({
    queryKey: ["manager-analytics-v2-summary", rangeDays],
    queryFn: () => fetchManagerAnalyticsSummaryV2({ rangeDays: Number(rangeDays) }),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const summaryStaleHours = summaryQuery.data?.period?.staleHours ?? 48;

  const trendQuery = useQuery<ManagerAnalyticsV2Trend, any>({
    queryKey: ["manager-analytics-v2-trend", rangeDays],
    queryFn: () => fetchManagerAnalyticsTrendV2({ rangeDays: Number(rangeDays) }),
    enabled: Boolean(summaryQuery.data),
    staleTime: 45_000,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const warningsQuery = useQuery<ManagerAnalyticsV2Warnings, any>({
    queryKey: ["manager-analytics-v2-warnings", rangeDays, summaryStaleHours],
    queryFn: () =>
      fetchManagerAnalyticsWarningsV2({
        rangeDays: Number(rangeDays),
        staleHours: summaryStaleHours,
      }),
    enabled: Boolean(summaryQuery.data),
    staleTime: 45_000,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const financeQueueQuery = useQuery<ManagerAnalyticsV2FinanceQueue, any>({
    queryKey: ["manager-analytics-v2-finance-queue", queueStatus, queueKind, queuePage],
    queryFn: () =>
      fetchManagerAnalyticsFinanceQueueV2({
        queuePage,
        queuePageSize: 20,
        queueStatuses: queueStatus === "all" ? [] : [queueStatus],
        queueKinds: queueKind === "all" ? [] : [queueKind],
      }),
    enabled: Boolean(summaryQuery.data),
    staleTime: 20_000,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (!isPageVisible) return;
    const unsubscribe = subscribeManagerAnalyticsStream({
      onReady: (payload) => {
        setStreamConnectedAt(payload.connectedAt ?? new Date().toISOString());
      },
      onRefresh: () => {
        queryClient.invalidateQueries({ queryKey: ["manager-analytics-v2-summary"] });
        queryClient.invalidateQueries({ queryKey: ["manager-analytics-v2-trend"] });
      },
      onError: () => {
        setStreamConnectedAt(null);
      },
    });
    return unsubscribe;
  }, [isPageVisible, queryClient]);

  const data = summaryQuery.data;
  const trend = trendQuery.data?.trend;
  const warnings = warningsQuery.data;
  const queue = financeQueueQuery.data;

  const trendPeak = useMemo(() => {
    if (!trend?.created?.length) return 1;
    return Math.max(
      1,
      ...trend.created.flatMap((row, i) => [row.count, trend.delivered[i]?.count ?? 0]),
    );
  }, [trend]);

  const trendCreated = useMemo(() => trend?.created?.slice(-14) ?? [], [trend?.created]);
  const trendDelivered = useMemo(() => trend?.delivered?.slice(-14) ?? [], [trend?.delivered]);

  const refreshAll = async () => {
    await invalidateManagerAnalyticsV2();
    queryClient.invalidateQueries({ queryKey: ["manager-analytics-v2-summary"] });
    queryClient.invalidateQueries({ queryKey: ["manager-analytics-v2-trend"] });
    queryClient.invalidateQueries({ queryKey: ["manager-analytics-v2-warnings"] });
    queryClient.invalidateQueries({ queryKey: ["manager-analytics-v2-finance-queue"] });
  };

  return (
    <PageShell className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-border/70 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.10),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(249,115,22,0.10),_transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] px-6 py-6 shadow-sm sm:px-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-3">
            <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.28em]">
              {t("managerAnalytics.badge")}
            </Badge>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">{t("managerAnalytics.title")} V2</h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Redis-first split analytics with SSE refresh.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Select value={rangeDays} onValueChange={setRangeDays}>
              <SelectTrigger className="w-[160px] bg-background/90"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">{t("managerAnalytics.filters.last7Days")}</SelectItem>
                <SelectItem value="30">{t("managerAnalytics.filters.last30Days")}</SelectItem>
                <SelectItem value="90">{t("managerAnalytics.filters.last90Days")}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={refreshAll} disabled={summaryQuery.isFetching}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("managerAnalytics.refresh")}
            </Button>
            <Badge variant="outline" className="rounded-full">
              {streamConnectedAt ? `SSE live` : `SSE reconnecting`}
            </Badge>
          </div>
        </div>
      </section>

      {!data && summaryQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <Skeleton key={idx} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : null}

      {data ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title={t("managerAnalytics.cards.createdInRange")} value={data.overview.createdInRange} icon={TrendingUp} tone="bg-sky-500/10 text-sky-600" />
            <StatCard title={t("managerAnalytics.cards.openOrders")} value={data.overview.openOrders} icon={Route} tone="bg-slate-900/10 text-slate-700" />
            <StatCard title={t("managerAnalytics.cards.deliveredInRange")} value={data.overview.deliveredInRange} icon={Clock3} tone="bg-emerald-500/10 text-emerald-600" />
            <StatCard title={t("managerAnalytics.cards.exceptionOpenOrders")} value={data.overview.exceptionOpenOrders} icon={AlertTriangle} tone="bg-amber-500/10 text-amber-700" />
            <StatCard title="Unpaid COD" value={data.finance.unpaidCodCount} icon={Wallet} tone="bg-orange-500/10 text-orange-600" />
            <StatCard title="Unpaid Service" value={data.finance.unpaidServiceCount} icon={Wallet} tone="bg-violet-500/10 text-violet-600" />
            <StatCard title="Pending invoices" value={data.finance.pendingInvoicesCount} icon={Wallet} tone="bg-rose-500/10 text-rose-600" />
            <StatCard title="Paid invoices" value={formatMoney(data.finance.invoicedPaidAmount, locale)} icon={Wallet} tone="bg-emerald-500/10 text-emerald-700" />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-border/70">
              <CardHeader>
                <CardTitle>{t("managerAnalytics.sections.trend")}</CardTitle>
                <CardDescription>{data.period.rangeDays}d window</CardDescription>
              </CardHeader>
              <CardContent>
                {!trend ? (
                  <Skeleton className="h-40 rounded-2xl" />
                ) : (
                  <div className="overflow-x-auto rounded-2xl border bg-background/80 p-4">
                    <div className="grid h-28 min-w-[560px] grid-cols-14 items-end gap-2">
                      {trendCreated.map((item, idx) => {
                        const delivered = trendDelivered[idx]?.count ?? 0;
                        return (
                          <div key={item.date} className="space-y-1">
                            <div className="flex h-20 items-end gap-1">
                              <div className="w-1/2 rounded-t-md bg-sky-500/80" style={{ height: `${Math.max(8, (item.count / trendPeak) * 100)}%` }} />
                              <div className="w-1/2 rounded-t-md bg-emerald-500/80" style={{ height: `${Math.max(8, (delivered / trendPeak) * 100)}%` }} />
                            </div>
                            <div className="truncate text-center text-[10px] text-muted-foreground">{item.date.slice(5)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader>
                <CardTitle>{t("managerAnalytics.sections.guidance")}</CardTitle>
                <CardDescription>Split warnings endpoint</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!warnings ? (
                  <Skeleton className="h-36 rounded-2xl" />
                ) : (
                  <>
                    <div className="rounded-2xl border bg-background/80 px-4 py-3 text-sm">
                      Overdue open orders: <span className="font-semibold">{warnings.overdueTotal}</span>
                    </div>
                    <div className="rounded-2xl border bg-background/80 px-4 py-3 text-sm">
                      Stale open orders: <span className="font-semibold">{warnings.staleTotal}</span>
                    </div>
                    <div className="rounded-2xl border bg-background/80 px-4 py-3 text-sm">
                      Finance exposure: <span className="font-semibold">{warnings.financeExposureTotal}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="space-y-4">
            <Card className="border-border/70">
              <CardHeader className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle>{t("managerAnalytics.finance.queueTitle")}</CardTitle>
                    <CardDescription>Lazy-loaded paginated finance queue</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Select value={queueStatus} onValueChange={(v: any) => setQueueStatus(v)}>
                      <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="expected">Expected</SelectItem>
                        <SelectItem value="held">Held</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={queueKind} onValueChange={(v: any) => setQueueKind(v)}>
                      <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All kinds</SelectItem>
                        <SelectItem value="cod">COD</SelectItem>
                        <SelectItem value="service_charge">Service charge</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!queue ? (
                  <Skeleton className="h-40 rounded-2xl" />
                ) : (queue.queue ?? []).length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">No queue items.</div>
                ) : (
                  <div className="space-y-3">
                    {(queue.queue ?? []).map((item) => (
                      <div key={item.id} className="rounded-2xl border bg-background/80 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="rounded-full">
                            {item.orderNumber ? `#${item.orderNumber}` : item.orderId.slice(0, 8)}
                          </Badge>
                          <Badge variant="secondary" className="rounded-full">
                            {getStatusLabel(item.orderStatus, t)}
                          </Badge>
                          <Badge variant="outline" className="rounded-full">
                            {item.status}
                          </Badge>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                          <div>
                            {item.kind} - {item.holderLabel || item.holderType}
                          </div>
                          <div className="font-semibold">{formatMoney(item.amount, locale)}</div>
                        </div>
                        <div className="mt-2">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/dashboard/manager/orders/${item.orderId}`}>Open order</Link>
                          </Button>
                        </div>
                      </div>
                    ))}

                    <div className="flex items-center justify-between pt-1 text-sm">
                      <span>
                        Page {queue.queueMeta?.page ?? 1} / {queue.queueMeta?.pageCount ?? 1}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setQueuePage((p) => Math.max(1, p - 1))}
                          disabled={!queue.queueMeta?.hasPrev}
                        >
                          Prev
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setQueuePage((p) => p + 1)}
                          disabled={!queue.queueMeta?.hasNext}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      ) : null}
    </PageShell>
  );
}
