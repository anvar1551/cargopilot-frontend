"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { authContext, authEpoch } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  mutatePricing,
  pendingPricing,
  finishPricing,
  pricingError,
  type PricingKind,
  type PricingIntent,
} from "@/lib/pricing-workflow";
export function ExactDetails({
  value,
  title = "Exact content",
}: {
  value: unknown;
  title?: string;
}) {
  return (
    <details className="min-w-0 max-w-full rounded-lg border p-3">
      <summary className="cursor-pointer break-words font-medium">
        {title}
      </summary>
      <pre
        tabIndex={0}
        aria-label={title}
        className="mt-3 max-h-96 max-w-full overflow-auto rounded-md bg-muted p-3 text-sm whitespace-pre-wrap break-all"
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0 space-y-2 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}
export const control =
  "w-full min-w-0 max-w-full rounded-md border bg-background px-3 py-2 text-sm";
export function IntentAction({
  context,
  kind,
  payload,
  allowed,
  retryAllowed,
  label,
  onConfirmed,
}: {
  context: string;
  kind: PricingKind;
  payload: () => unknown;
  allowed: boolean;
  retryAllowed?: boolean;
  label: string;
  onConfirmed: () => void;
}) {
  const [intent, setIntent] = useState<PricingIntent | null>(null),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const live = useRef(true),
    epoch = authEpoch();
  const current = () =>
    live.current && context === authContext() && epoch === authEpoch();
  useEffect(() => {
    live.current = true;
    try {
      setIntent(pendingPricing(context, kind));
      setReady(true);
    } catch (e) {
      setError(pricingError(e));
    }
    return () => {
      live.current = false;
    };
  }, [context, kind]);
  const run = async (retry: boolean) => {
    setBusy(true);
    setError("");
    try {
      const r = await mutatePricing(context, kind, retry ? null : payload());
      if (current()) {
        setIntent(r);
        onConfirmed();
      }
    } catch (e) {
      if (current()) {
        setError(pricingError(e));
        try {
          setIntent(pendingPricing(context, kind));
        } catch {
          setReady(false);
        }
      }
    } finally {
      if (current()) setBusy(false);
    }
  };
  const finish = async () => {
    setBusy(true);
    try {
      await finishPricing(context, kind);
      if (current()) {
        setIntent(null);
        onConfirmed();
      }
    } catch (e) {
      if (current()) setError(pricingError(e));
    } finally {
      if (current()) setBusy(false);
    }
  };
  return (
    <div className="min-w-0 space-y-3 rounded-lg border bg-muted/20 p-4">
      {error && (
        <p role="alert" className="break-words text-sm text-destructive">
          {error}
        </p>
      )}
      {intent ? (
        <>
          <p className="text-sm font-medium">
            {intent.state === "confirmed"
              ? "Historical confirmation — refresh current state"
              : "Unconfirmed intent — keep its original content"}
          </p>
          <ExactDetails value={intent} title="Stored request and receipt" />
          <div className="flex flex-wrap gap-2">
            {!kind.startsWith("draft") && (
              <Button
                disabled={busy || !(retryAllowed ?? allowed) || !ready}
                onClick={() => void run(true)}
              >
                Retry exact original request
              </Button>
            )}
            {intent.state === "confirmed" && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void finish()}
              >
                Archive local confirmation / new action
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {kind.startsWith("draft")
              ? "Draft writes have no durable server retry contract. An uncertain draft cannot be replayed or discarded here."
              : "Refreshed selectors never replace this request. No automatic replay or uncertain-intent abandonment."}
          </p>
        </>
      ) : (
        <Button
          disabled={busy || !allowed || !ready}
          onClick={() => void run(false)}
        >
          {busy ? "Waiting for confirmation…" : label}
        </Button>
      )}
    </div>
  );
}
