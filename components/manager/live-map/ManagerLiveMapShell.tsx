"use client";

import dynamic from "next/dynamic";
import { Map, RefreshCw, Truck } from "lucide-react";

import PageShell from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const ManagerLiveMapClient = dynamic(() => import("./ManagerLiveMapClient"), {
  ssr: false,
  loading: () => <LiveMapLoadingSkeleton />,
});

function LiveMapLoadingSkeleton() {
  return (
    <PageShell>
      <div className="space-y-4">
        <Card className="border-border/70 bg-gradient-to-r from-cyan-50/70 via-background to-indigo-50/50">
          <CardHeader className="pb-2 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-2">
                <Badge variant="secondary" className="w-fit">
                  <Map className="mr-1 h-3.5 w-3.5" />
                  Live map
                </Badge>
                <CardTitle className="text-xl leading-tight">Loading operations map</CardTitle>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/90 px-3 py-1.5 text-xs text-muted-foreground">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Preparing map module
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-9 w-40 rounded-lg" />
              <Skeleton className="h-9 w-40 rounded-lg" />
              <Skeleton className="h-9 w-40 rounded-lg" />
              <Skeleton className="h-9 flex-1 rounded-lg" />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/70 bg-gradient-to-br from-slate-50/70 via-background to-indigo-50/45">
          <CardContent className="p-0">
            <div className="grid h-[78vh] min-h-[620px] grid-rows-[320px_minmax(0,1fr)] lg:grid-cols-[360px_minmax(0,1fr)] lg:grid-rows-1">
              <div className="border-b border-border/60 bg-gradient-to-b from-cyan-50/40 via-background to-indigo-50/40 p-4 lg:border-b-0 lg:border-r">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                  <Truck className="h-4 w-4" />
                  Drivers
                </div>
                <Skeleton className="h-9 w-full rounded-lg" />
                <div className="mt-5 space-y-3">
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                </div>
              </div>
              <div className="relative h-full w-full overflow-hidden bg-slate-100">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(14,165,233,0.16),transparent_28%),radial-gradient(circle_at_70%_35%,rgba(99,102,241,0.13),transparent_26%),linear-gradient(135deg,rgba(248,250,252,0.96),rgba(226,232,240,0.88))]" />
                <div className="absolute inset-8 rounded-3xl border border-white/70 bg-white/30 shadow-inner backdrop-blur-sm" />
                <div className="absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-border/70 bg-background/95 px-4 py-2 text-sm text-muted-foreground shadow-sm">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading Mapbox
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

export default function ManagerLiveMapShell() {
  return <ManagerLiveMapClient />;
}
