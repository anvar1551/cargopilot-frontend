"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { readPricing, pricingError } from "@/lib/pricing-workflow";
import { Button } from "@/components/ui/button";
import { ExactDetails } from "./PricingWorkflowShared";
export default function PricingReferencePanel({
  context,
}: {
  context: string;
}) {
  const [view, setView] = useState("regions"),
    [cursors, setCursors] = useState<string[]>([]);
  const r = useQuery({
    queryKey: ["pricing-reference", context, view, cursors.at(-1)],
    retry: false,
    queryFn: () =>
      readPricing<{
        items: Record<string, unknown>[];
        nextCursor: string | null;
        policy?: unknown;
      }>(context, "/workflow", {
        view,
        permission: "pricing.read",
        cursor: cursors.at(-1),
      }),
  });
  return (
    <section className="min-w-0 space-y-4 rounded-xl border p-4">
      <h2 className="text-lg font-semibold">
        Shared reference information (read-only)
      </h2>
      <p className="text-sm text-muted-foreground">
        Existing region, zone and SLA references are preserved. Their unowned
        mutations remain disabled; they are not approved billing policies.
      </p>
      <div className="flex flex-wrap gap-2">
        {[
          ["regions", "Regions"],
          ["zones", "Zone matrix"],
          ["sla", "SLA rules & thresholds"],
        ].map(([v, label]) => (
          <Button
            key={v}
            variant={view === v ? "default" : "outline"}
            onClick={() => {
              setView(v);
              setCursors([]);
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      {r.isFetching && <p role="status">Loading reference page…</p>}
      {r.error && <p role="alert">{pricingError(r.error)}</p>}
      {r.data?.items.length === 0 && <p>No reference records on this page.</p>}
      {r.data?.items.map((v, i) => (
        <ExactDetails
          key={String(v.id ?? i)}
          value={v}
          title={String(
            v.name ??
              (v.originRegion as { name?: string })?.name ??
              "Zone reference",
          )}
        />
      ))}
      {!!r.data?.policy && (
        <ExactDetails
          value={r.data.policy}
          title="Read-only operational SLA thresholds"
        />
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={!cursors.length}
          onClick={() => setCursors((c) => c.slice(0, -1))}
        >
          Previous references
        </Button>
        <Button
          variant="outline"
          disabled={!r.data?.nextCursor}
          onClick={() => setCursors((c) => [...c, r.data!.nextCursor!])}
        >
          Next references
        </Button>
      </div>
    </section>
  );
}
