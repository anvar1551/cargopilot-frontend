"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authContext, authEpoch, hasPermission } from "@/lib/auth";
import { useWorkspaceSession } from "@/lib/workspace";
import {
  configuration,
  readSetup,
  mutateSetup,
  pendingSetup,
  finishSetup,
  setupError,
  type SetupKind,
  type SetupIntent,
  type SetupProposal,
} from "@/lib/entity-setup";
import PageShell from "@/components/layout/PageShell";
import WorkspaceState from "./WorkspaceState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const fieldLabels: Record<string, string> = {
  id: "Entity ID",
  baseCurrency: "Base currency",
  fiscalYearStartMonth: "Fiscal start month",
  timezone: "IANA timezone",
  reportingCurrency: "Reporting currency",
  isActive: "Active",
};

export default function EntitySetupWorkspace() {
  const s = useWorkspaceSession();
  if (!s.context || !s.user)
    return (
      <PageShell className="admin-workspace">
        <WorkspaceState
          kind="denied"
          title="Selected company required"
          description="Sign in with your independently appointed setup membership."
        />
      </PageShell>
    );
  const propose = hasPermission(s.user, "finance.entitySetup.propose"),
    check = hasPermission(s.user, "finance.entitySetup.approve");
  return (
    <Setup key={s.epoch} context={s.context} propose={propose} check={check} />
  );
}
function Setup({
  context,
  propose,
  check,
}: {
  context: string;
  propose: boolean;
  check: boolean;
}) {
  const [kind, setKind] = useState<"proposer" | "checker">(
    propose ? "proposer" : "checker",
  );
  const [cursors, setCursors] = useState<string[]>([]),
    [selected, setSelected] = useState<SetupProposal>();
  const permitted = kind === "proposer" ? propose : check;
  const a = useQuery({
    queryKey: ["entity-setup-authority", context, kind],
    enabled: permitted,
    retry: false,
    staleTime: 0,
    queryFn: () => readSetup(context, "authority", kind),
  });
  const list = useQuery({
    queryKey: ["entity-setup-proposals", context, kind, cursors.at(-1)],
    enabled: !!a.data,
    retry: false,
    staleTime: 0,
    queryFn: () => readSetup(context, "proposals", kind, cursors.at(-1)),
  });
  const refresh = () => {
    void a.refetch();
    void list.refetch();
  };
  return (
    <PageShell className="admin-workspace">
      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 basis-80">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Independent company setup
            </p>
            <h1 className="text-2xl font-semibold">Initial issuing entity</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Explicit configuration, independently approved. Your existing
              owned organization supplies issuing identity; this flow adds no
              legal name, tax identity, accounting or FX defaults.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={refresh}
            disabled={!permitted || a.isFetching || list.isFetching}
          >
            Refresh authority and proposals
          </Button>
        </header>
        {!propose && !check ? (
          <WorkspaceState
            kind="denied"
            title="Setup authority unavailable"
            description="Owner appointment under issuing-entity-setup.v1 is required. Financial delegation or administrator status alone does not authorize setup."
          />
        ) : (
          <>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Setup authority view"
            >
              {propose && (
                <Button
                  variant={kind === "proposer" ? "default" : "outline"}
                  onClick={() => {
                    setKind("proposer");
                    setCursors([]);
                    setSelected(undefined);
                  }}
                >
                  Proposer
                </Button>
              )}
              {check && (
                <Button
                  variant={kind === "checker" ? "default" : "outline"}
                  onClick={() => {
                    setKind("checker");
                    setCursors([]);
                    setSelected(undefined);
                  }}
                >
                  Independent checker
                </Button>
              )}
            </div>
            {a.isPending && (
              <p role="status">Checking current accepted setup authority…</p>
            )}
            {a.isError && (
              <p role="alert" className="rounded-xl border p-4">
                {setupError(a.error)}
              </p>
            )}
            {a.data && (
              <>
                <section className="rounded-2xl border bg-card p-5 space-y-3">
                  <h2 className="font-semibold">{a.data.companyName}</h2>
                  <p className="text-sm">
                    Accepted {a.data.kind} · {a.data.revision}. Reporting
                    currency must remain null. Publication does not enable
                    accounting or payments.
                  </p>
                  {a.data.entity ? (
                    <>
                      <h3 className="font-medium">
                        Already configured — published entity
                      </h3>
                      <dl className="admin-columns gap-3 text-sm">
                        {Object.entries(a.data.entity).map(([k, v]) => (
                          <div key={k}>
                            <dt className="text-muted-foreground">
                              {fieldLabels[k] ?? k}
                            </dt>
                            <dd>{v === null ? "None" : String(v)}</dd>
                          </div>
                        ))}
                      </dl>
                      <p className="text-sm">
                        Initial setup is complete. Editing, deactivation and
                        corrections are separate unavailable workflows.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm">
                      No entity is published. Choose every configuration value
                      explicitly; no company defaults are inferred.
                    </p>
                  )}
                </section>
                <section className="rounded-2xl border bg-card p-5 space-y-4">
                  <h2 className="text-lg font-semibold">Immutable proposals</h2>
                  <p className="text-sm text-muted-foreground">
                    Proposers see their own records; authorized checkers see
                    this selected company. Pending proposals confer no
                    configuration authority.
                  </p>
                  {list.isPending && (
                    <p role="status">Loading bounded proposal inventory…</p>
                  )}
                  {list.isError && <p role="alert">{setupError(list.error)}</p>}
                  {list.data && !list.data.items.length && (
                    <p>No proposals on this page.</p>
                  )}
                  <ul className="space-y-3">
                    {list.data?.items.map((p) => (
                      <li key={p.proposalId} className="rounded-xl border p-4">
                        <div className="flex min-w-0 flex-wrap items-start gap-3">
                          <div className="min-w-0 flex-1 basis-64">
                            <h3 className="font-medium">
                              {p.configuration.baseCurrency} ·{" "}
                              {p.configuration.timezone} · fiscal month{" "}
                              {p.configuration.fiscalYearStartMonth}
                            </h3>
                            <p className="text-sm">
                              {p.decision?.action ?? "pending"} · proposed by{" "}
                              {p.proposer.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {p.proposalId}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => setSelected(p)}
                          >
                            Inspect exact proposal
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={!cursors.length || list.isFetching}
                      onClick={() => setCursors((v) => v.slice(0, -1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!list.data?.nextCursor || list.isFetching}
                      onClick={() => {
                        const cursor = list.data?.nextCursor;
                        if (cursor) setCursors((v) => [...v, cursor]);
                      }}
                    >
                      Next
                    </Button>
                  </div>
                </section>
                {selected && (
                  <section className="rounded-2xl border bg-card p-5 space-y-3">
                    <h2 className="text-lg font-semibold">
                      Exact immutable content
                    </h2>
                    <p className="text-sm">
                      Proposer: {selected.proposer.name} ·{" "}
                      {selected.proposer.userId}
                    </p>
                    <p className="text-sm">
                      Content identity: {selected.contentHash}
                    </p>
                    <p className="text-sm">
                      Proposal reason: {selected.reason}
                    </p>
                    <dl className="admin-columns gap-3">
                      {Object.entries(selected.configuration).map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-sm text-muted-foreground">
                            {fieldLabels[k] ?? k}
                          </dt>
                          <dd>{v === null ? "None" : String(v)}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="text-sm">
                      State: {selected.decision?.action ?? "pending"}
                      {selected.decision &&
                        ` · decision reason: ${selected.decision.reason}`}
                    </p>
                    {!selected.independent && (
                      <p className="text-sm">
                        You are the proposer. Another human must decide this
                        proposal.
                      </p>
                    )}
                  </section>
                )}
                <Mutation
                  key={context + ":" + kind}
                  context={context}
                  kind={kind === "proposer" ? "propose" : "decide"}
                  currencies={a.data.supportedCurrencies}
                  enabled={
                    kind === "proposer"
                      ? !a.data.entity
                      : !!selected && !selected.decision && selected.independent
                  }
                  selected={selected}
                  refresh={refresh}
                />
              </>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
function Mutation({
  context,
  kind,
  currencies,
  enabled,
  selected,
  refresh,
}: {
  context: string;
  kind: SetupKind;
  currencies: string[];
  enabled: boolean;
  selected?: SetupProposal;
  refresh: () => void;
}) {
  const [currency, setCurrency] = useState(""),
    [month, setMonth] = useState(""),
    [timezone, setTimezone] = useState(""),
    [reason, setReason] = useState(""),
    [decision, setDecision] = useState<"" | "approved" | "rejected">("");
  const [intent, setIntent] = useState<SetupIntent | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const active = useRef(true),
    epoch = useRef(authEpoch());
  const current = () =>
    active.current &&
    context === authContext() &&
    epoch.current === authEpoch();
  useEffect(() => {
    active.current = true;
    try {
      setIntent(pendingSetup(context, kind));
    } catch {
      setError(
        "Stored intent is unreadable. Sending is blocked; retain it for review.",
      );
    }
    return () => {
      active.current = false;
    };
  }, [context, kind]);
  async function submit(retry = false) {
    if (busy || !current()) return;
    setBusy(true);
    setError("");
    try {
      const payload = retry
        ? null
        : kind === "propose"
          ? {
              configuration: configuration.parse({
                baseCurrency: currency,
                fiscalYearStartMonth: Number(month),
                timezone,
                reportingCurrency: null,
              }),
              reason,
            }
          : {
              proposalId: selected?.proposalId,
              contentHash: selected?.contentHash,
              decision,
              reason,
              expected: selected?.configuration,
            };
      if (!retry && kind === "propose" && !currencies.includes(currency))
        throw Error("Select a server-supported currency");
      const receipt = await mutateSetup(context, kind, payload);
      if (current()) {
        setIntent(receipt);
        refresh();
      }
    } catch (e) {
      if (current()) {
        try {
          setIntent(pendingSetup(context, kind));
        } catch {}
        setError(
          e instanceof Error && !("response" in e)
            ? e.name === "ZodError"
              ? "Complete explicit configuration and a bounded reason; unsupported values cannot be submitted."
              : e.message
            : setupError(e),
        );
      }
    } finally {
      if (current()) setBusy(false);
    }
  }
  return (
    <section className="rounded-2xl border bg-card p-5 space-y-4">
      <h2 className="text-lg font-semibold">
        {kind === "propose"
          ? "Propose initial configuration"
          : "Independent decision"}
      </h2>
      <p className="text-sm text-muted-foreground">
        Persist the exact non-secret intent before sending. Explicit retries
        retain the same ID/content. Unconfirmed intents cannot be replaced or
        discarded here.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <fieldset
          className="admin-columns gap-4"
          disabled={
            !enabled || busy || !!intent || error.startsWith("Stored intent")
          }
        >
          {kind === "propose" ? (
            <>
              <div>
                <Label htmlFor="setup-currency">Base currency</Label>
                <select
                  id="setup-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  required
                  className="mt-2 w-full rounded-md border p-2"
                >
                  <option value="">Choose explicitly…</option>
                  {currencies.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="setup-month">Fiscal start month (1–12)</Label>
                <Input
                  id="setup-month"
                  type="number"
                  min={1}
                  max={12}
                  step={1}
                  required
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="setup-timezone">IANA timezone</Label>
                <Input
                  id="setup-timezone"
                  required
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="Enter the approved timezone"
                  maxLength={100}
                />
              </div>
              <p className="text-sm self-center">
                Reporting currency: none (null). No FX is available.
              </p>
            </>
          ) : (
            <div>
              <Label htmlFor="setup-decision">
                Decision for inspected immutable proposal
              </Label>
              <select
                id="setup-decision"
                required
                value={decision}
                onChange={(e) => setDecision(e.target.value as typeof decision)}
                className="mt-2 w-full rounded-md border p-2"
              >
                <option value="">Choose explicitly…</option>
                <option value="approved">Approve</option>
                <option value="rejected">Reject</option>
              </select>
            </div>
          )}
          <div className="admin-span-all">
            <Label htmlFor="setup-reason">
              {kind === "propose" ? "Proposal" : "Decision"} reason
            </Label>
            <Input
              id="setup-reason"
              required
              value={reason}
              maxLength={1000}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <Button type="submit" className="admin-span-all justify-self-start">
            {busy
              ? "Awaiting confirmation…"
              : kind === "propose"
                ? "Persist and propose"
                : "Persist and submit decision"}
          </Button>
        </fieldset>
      </form>
      {!enabled && !intent && (
        <p className="text-sm">
          {kind === "propose"
            ? "An entity already exists; creation is unavailable."
            : "Inspect a pending proposal made by another human before deciding."}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl border p-3">
          {error}
        </p>
      )}
      {intent && (
        <div className="rounded-xl border p-4 space-y-3" aria-live="polite">
          <p className="font-medium">Local receipt: {intent.state}</p>
          <p className="text-sm">Operation ID: {intent.operationId}</p>
          {intent.code && <p className="text-sm">{intent.code}</p>}
          <pre
            className="admin-receipt"
            tabIndex={0}
            role="region"
            aria-label="Immutable setup intent and confirmed result"
          >
            {JSON.stringify(
              { intent: intent.payload, result: intent.result ?? null },
              null,
              2,
            )}
          </pre>
          <p className="text-sm">
            This receipt does not override current authority or live proposal
            state.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void submit(true)}
            >
              Explicit matching retry
            </Button>
            {intent.state === "confirmed" && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void finishSetup(context, kind)
                    .then(() => {
                      if (current()) {
                        setIntent(null);
                        setReason("");
                        refresh();
                      }
                    })
                    .catch((e) => {
                      if (current()) setError(setupError(e));
                    })
                    .finally(() => {
                      if (current()) setBusy(false);
                    });
                }}
              >
                Finish confirmed action
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
