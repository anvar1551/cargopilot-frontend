"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { authContext, authEpoch, hasPermission } from "@/lib/auth";
import { useWorkspaceSession } from "@/lib/workspace";
import {
  readFinancialDiscovery,
  mutateFinancial,
  pendingFinancial,
  finishFinancial,
  financialError,
  type FinancialIntent,
  type FinancialKind,
  type FinancialRecipient,
  type FinancialProposal,
  type FinancialGrant,
} from "@/lib/financial-access";
import PageShell from "@/components/layout/PageShell";
import WorkspaceState from "./WorkspaceState";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
export default function FinancialAccessWorkspace() {
  const s = useWorkspaceSession();
  if (!s.context || !s.user)
    return (
      <PageShell>
        <WorkspaceState
          kind="denied"
          title="Selected company required"
          description="Sign in to the company whose financial access you manage."
        />
      </PageShell>
    );
  return (
    <Access
      key={s.epoch}
      context={s.context}
      permitted={
        hasPermission(s.user, "membership.proposeFinancial") ||
        hasPermission(s.user, "membership.approveFinancial")
      }
    />
  );
}
function Access({
  context,
  permitted,
}: {
  context: string;
  permitted: boolean;
}) {
  const [kind, setKind] = useState<"proposer" | "checker">("proposer"),
    [recipient, setRecipient] = useState<FinancialRecipient>(),
    [proposal, setProposal] = useState<FinancialProposal>(),
    [grant, setGrant] = useState<FinancialGrant>();
  const [cursors, setCursors] = useState<Record<string, string[]>>({
    recipients: [],
    proposals: [],
    grants: [],
  });
  const ceiling = useQuery({
    queryKey: ["financial-ceiling", context],
    enabled: permitted,
    retry: false,
    staleTime: 0,
    queryFn: () => readFinancialDiscovery(context, "ceiling"),
  });
  const accepted = ceiling.data?.authorities.find((a) => a.kind === kind);
  const recipients = useQuery({
    queryKey: [
      "financial-recipients",
      context,
      kind,
      cursors.recipients.at(-1),
    ],
    enabled: !!accepted && kind === "proposer",
    retry: false,
    queryFn: () =>
      readFinancialDiscovery(
        context,
        "recipients",
        kind,
        cursors.recipients.at(-1),
      ),
  });
  const proposals = useQuery({
    queryKey: ["financial-proposals", context, kind, cursors.proposals.at(-1)],
    enabled: !!accepted,
    retry: false,
    queryFn: () =>
      readFinancialDiscovery(
        context,
        "proposals",
        kind,
        cursors.proposals.at(-1),
      ),
  });
  const grants = useQuery({
    queryKey: ["financial-grants", context, kind, cursors.grants.at(-1)],
    enabled: !!accepted,
    retry: false,
    queryFn: () =>
      readFinancialDiscovery(context, "grants", kind, cursors.grants.at(-1)),
  });
  const refresh = () => {
    void ceiling.refetch();
    if (accepted) {
      if (kind === "proposer") void recipients.refetch();
      void proposals.refetch();
      void grants.refetch();
    }
  };
  function switchKind(k: "proposer" | "checker") {
    setKind(k);
    setRecipient(undefined);
    setProposal(undefined);
    setGrant(undefined);
    setCursors({ recipients: [], proposals: [], grants: [] });
  }
  return (
    <PageShell>
      <div className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Independent company governance
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              Financial access
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Exact operational financial profiles, independently accepted.
              Pending proposals grant no access. Ordinary staff or driver
              delegation is insufficient.
            </p>
          </div>
          <Link
            href="/dashboard/manager/finance"
            className="text-sm underline underline-offset-4"
          >
            Existing finance workspace
          </Link>
        </header>
        {!permitted ? (
          <WorkspaceState
            kind="denied"
            title="Financial delegation authority required"
            description="An owner-appointed proposer or checker ceiling is required. This page cannot appoint one."
          />
        ) : ceiling.isPending ? (
          <p role="status">Checking current accepted authority…</p>
        ) : ceiling.isError ? (
          <p role="alert">{financialError(ceiling.error)}</p>
        ) : null}
        <Button variant="outline" disabled={!permitted} onClick={refresh}>
          Refresh accepted authority and inventory
        </Button>
        {ceiling.data && (
          <div className="grid gap-3 sm:grid-cols-2">
            {ceiling.data.authorities.map((a) => (
              <section
                className="rounded-2xl border bg-card p-5 shadow-sm"
                key={a.kind}
              >
                <h2 className="font-semibold capitalize">{a.kind} ceiling</h2>
                <p className="mt-2 text-sm">
                  {a.legalEntity.name} · {a.legalEntity.baseCurrency}
                </p>
                <p className="break-all text-xs text-muted-foreground">
                  Entity {a.legalEntity.id}
                </p>
                <ul className="mt-3 space-y-2 text-sm">
                  {a.profiles.map((p) => (
                    <li key={p.revision}>
                      <strong>{p.revision}</strong>
                      <p className="break-words text-xs text-muted-foreground">
                        {p.permissions.join(" · ")}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
        <div
          className="flex gap-2"
          role="group"
          aria-label="Financial authority view"
        >
          {(["proposer", "checker"] as const).map((k) => (
            <Button
              key={k}
              variant={kind === k ? "default" : "outline"}
              aria-pressed={kind === k}
              disabled={!ceiling.data?.authorities.some((a) => a.kind === k)}
              onClick={() => switchKind(k)}
            >
              {k === "proposer" ? "Proposer view" : "Checker view"}
            </Button>
          ))}
        </div>
        {ceiling.data && !accepted && (
          <p role="status">
            Choose your accepted authority view. No entity or ceiling is created
            here.
          </p>
        )}
        {accepted && (
          <>
            {kind === "proposer" && (
              <Inventory
                title="Eligible existing memberships"
                items={recipients.data?.items}
                pending={recipients.isPending}
                error={recipients.error}
                page={cursors.recipients}
                next={recipients.data?.nextCursor}
                move={(v) => setCursors((x) => ({ ...x, recipients: v }))}
              >
                {recipients.data?.items.map((r) => (
                  <li
                    key={r.membershipId}
                    className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:justify-between"
                  >
                    <div>
                      <h3 className="font-medium">{r.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {r.currentEnabled
                          ? "Accepted"
                          : "No enabled managed access"}{" "}
                        · {r.currentProfiles.join(", ") || "None"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setRecipient({ ...r })}
                    >
                      Select recipient
                    </Button>
                  </li>
                ))}
              </Inventory>
            )}
            {kind === "proposer" && (
              <Mutation
                key={"propose:" + kind}
                kind="propose"
                context={context}
                available={!!accepted}
                valid={!!recipient}
                initial={
                  recipient
                    ? {
                        membershipId: recipient.membershipId,
                        legalEntityId: accepted.legalEntity.id,
                        expectedAcceptanceId: recipient.expectedAcceptanceId,
                      }
                    : undefined
                }
                profiles={accepted.profiles.map((p) => p.revision)}
                heading={
                  recipient
                    ? "Propose for " + recipient.name
                    : "Select an eligible recipient"
                }
                refresh={refresh}
              />
            )}
            <Inventory
              title={
                kind === "checker"
                  ? "Independent acceptance queue"
                  : "Your immutable proposals"
              }
              items={proposals.data?.items}
              pending={proposals.isPending}
              error={proposals.error}
              page={cursors.proposals}
              next={proposals.data?.nextCursor}
              move={(v) => setCursors((x) => ({ ...x, proposals: v }))}
            >
              {proposals.data?.items.map((p) => (
                <li key={p.proposalId} className="rounded-xl border p-4">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row">
                    <div>
                      <h3 className="font-medium">{p.recipientName}</h3>
                      <p className="text-sm">{p.profileRevisions.join(", ")}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {p.state} · {new Date(p.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {kind === "checker" && (
                      <Button
                        variant="outline"
                        disabled={
                          p.state !== "pending" || !p.independent || p.stale
                        }
                        onClick={() => setProposal({ ...p })}
                      >
                        Inspect for acceptance
                      </Button>
                    )}
                  </div>
                  <dl className="mt-3 space-y-1 text-xs break-words">
                    <dt>Immutable reason</dt>
                    <dd>{p.reason}</dd>
                    <dt>Company and entity scope</dt>
                    <dd>Selected company · entity {p.legalEntityId}</dd>
                    <dt>Expected previous acceptance</dt>
                    <dd>
                      {p.expectedAcceptanceId ?? "No previous grant"} ·{" "}
                      {p.expectedEnabled ? "enabled" : "disabled"}
                    </dd>
                    <dt>Proposal identity / content fingerprint</dt>
                    <dd className="break-all">
                      {p.proposalId} / {p.fingerprint}
                    </dd>
                  </dl>
                  {!p.independent && kind === "checker" && (
                    <p className="mt-2 text-sm">
                      Different human required; proposer/recipient cannot check.
                    </p>
                  )}
                  {p.stale && p.state === "pending" && (
                    <p className="mt-2 text-sm">
                      The expected grant changed; this proposal cannot be
                      accepted.
                    </p>
                  )}
                </li>
              ))}
            </Inventory>
            {kind === "checker" && (
              <Mutation
                kind="accept"
                context={context}
                available={!!accepted}
                valid={
                  !!proposal &&
                  proposal.independent &&
                  !proposal.stale &&
                  proposal.state === "pending"
                }
                initial={
                  proposal
                    ? {
                        proposalId: proposal.proposalId,
                        fingerprint: proposal.fingerprint,
                        expected: {
                          membershipId: proposal.membershipId,
                          legalEntityId: proposal.legalEntityId,
                          profileRevisions: proposal.profileRevisions,
                        },
                      }
                    : undefined
                }
                heading={
                  proposal
                    ? "Independently accept for " + proposal.recipientName
                    : "Inspect an eligible immutable proposal"
                }
                refresh={refresh}
              />
            )}
            <Inventory
              title="Workflow-managed financial access"
              items={grants.data?.items}
              pending={grants.isPending}
              error={grants.error}
              page={cursors.grants}
              next={grants.data?.nextCursor}
              move={(v) => setCursors((x) => ({ ...x, grants: v }))}
            >
              {grants.data?.items.map((g) => (
                <li
                  key={g.membershipId}
                  className="flex flex-col justify-between gap-3 rounded-xl border p-4 sm:flex-row"
                >
                  <div>
                    <h3 className="font-medium">{g.name}</h3>
                    <p className="text-sm">{g.profileRevisions.join(", ")}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.enabled ? "Accepted access" : "Revoked access"} ·
                      unrelated grants are preserved
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    disabled={!g.enabled}
                    onClick={() => setGrant({ ...g })}
                  >
                    Inspect for revocation
                  </Button>
                </li>
              ))}
            </Inventory>
            <Mutation
              kind="revoke"
              context={context}
              available={!!accepted}
              valid={!!grant?.enabled}
              initial={
                grant
                  ? {
                      membershipId: grant.membershipId,
                      legalEntityId: grant.legalEntityId,
                      expectedAcceptanceId: grant.acceptanceId,
                    }
                  : undefined
              }
              heading={
                grant
                  ? "Revoke managed access for " + grant.name
                  : "Select accepted managed access"
              }
              refresh={refresh}
            />
          </>
        )}
        <p className="text-xs text-muted-foreground">
          Replacement is a new independently accepted proposal, never an
          immediate edit. No financial invitations, automatic grants, entity
          setup, cash, accounting or FX here. Selectors are snapshots; every
          mutation revalidates current authority. Empty filtered pages can still
          have a next page.
        </p>
      </div>
    </PageShell>
  );
}
function Inventory({
  title,
  items,
  pending,
  error,
  page,
  next,
  move,
  children,
}: {
  title: string;
  items?: unknown[];
  pending: boolean;
  error: unknown;
  page: string[];
  next?: string | null;
  move(v: string[]): void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      {error ? (
        <p className="mt-3" role="alert">
          {financialError(error)}
        </p>
      ) : pending ? (
        <p className="mt-3" role="status">
          Loading authorized records…
        </p>
      ) : (
        <>
          <ul className="my-4 space-y-3">{children}</ul>
          {!items?.length && (
            <p className="my-3 text-sm">No eligible records on this page.</p>
          )}
        </>
      )}
      <div className="mt-4 flex gap-2">
        <Button
          variant="outline"
          disabled={!page.length || pending}
          onClick={() => move(page.slice(0, -1))}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          disabled={!next || pending}
          onClick={() => move([...page, next!])}
        >
          Next
        </Button>
      </div>
    </section>
  );
}
function Mutation({
  kind,
  context,
  available,
  valid,
  initial,
  profiles = [],
  heading,
  refresh,
}: {
  kind: FinancialKind;
  context: string;
  available: boolean;
  valid: boolean;
  initial?: Record<string, unknown>;
  profiles?: string[];
  heading: string;
  refresh(): void;
}) {
  const [intent, setIntent] = useState<FinancialIntent | null>(null),
    [reason, setReason] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const mounted = useRef(true),
    running = useRef(false);
  useEffect(() => {
    mounted.current = true;
    try {
      const i = pendingFinancial(context, kind);
      setIntent(i);
      if (i) {
        setReason(String(i.payload.reason));
        setSelected((i.payload.profileRevisions as string[]) ?? []);
      }
    } catch {
      setError("Stored intent unreadable; sending is blocked.");
    }
    return () => {
      mounted.current = false;
    };
  }, [context, kind]);
  async function submit(retry = false) {
    if (running.current || !available) return;
    running.current = true;
    setBusy(true);
    setError("");
    const epoch = authEpoch();
    try {
      const payload = retry
        ? null
        : {
            ...initial,
            ...(kind === "propose" ? { profileRevisions: selected } : {}),
            reason,
          };
      const r = await mutateFinancial(context, kind, payload);
      if (
        mounted.current &&
        context === authContext() &&
        epoch === authEpoch()
      ) {
        setIntent(r);
        refresh();
      }
    } catch (e) {
      if (
        mounted.current &&
        context === authContext() &&
        epoch === authEpoch()
      ) {
        setError(financialError(e));
        try {
          setIntent(pendingFinancial(context, kind));
        } catch {
          setError("Stored intent unreadable; blocked for review.");
        }
      }
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function finish() {
    const epoch = authEpoch();
    try {
      await finishFinancial(context, kind);
      if (
        mounted.current &&
        context === authContext() &&
        epoch === authEpoch()
      ) {
        setIntent(null);
        setReason("");
        setSelected([]);
        setError("");
      }
    } catch {
      setError("Unconfirmed intent cannot be replaced.");
    }
  }
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold">
        {intent ? "Original " + kind + " intent" : heading}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Persistence is verified before send. Refreshed selectors never replace
        this intent. Confirmed access changes require a fresh recipient login.
      </p>
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <fieldset
          disabled={
            !available ||
            !valid ||
            busy ||
            !!intent ||
            error.includes("unreadable")
          }
          className="space-y-4"
        >
          {kind === "propose" && (
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="mb-2 text-sm font-medium">
                Exact approved profiles within your ceiling
              </legend>
              {profiles.map((p) => (
                <label
                  className="flex items-start gap-2 rounded-xl border p-3 text-sm"
                  key={p}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(p)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, p]
                          : selected.filter((v) => v !== p),
                      )
                    }
                  />
                  <span>{p}</span>
                </label>
              ))}
            </fieldset>
          )}
          <div>
            <Label htmlFor={kind + "-reason"}>Reason</Label>
            <Input
              id={kind + "-reason"}
              value={reason}
              maxLength={500}
              required
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <Button type="submit">
            {busy
              ? "Awaiting confirmation…"
              : kind === "propose"
                ? "Propose exact access"
                : kind === "accept"
                  ? "Independently accept"
                  : "Revoke managed access"}
          </Button>
        </fieldset>
      </form>
      {(intent || initial) && (
        <details
          className="my-3 rounded-xl bg-muted/40 p-3"
          open={kind === "accept"}
        >
          <summary className="cursor-pointer text-sm font-medium">
            Exact {intent ? "persisted" : "selected"} context / grant intent
          </summary>
          <pre className="mt-2 whitespace-pre-wrap break-all text-xs">
            {JSON.stringify(intent?.payload ?? initial, null, 2)}
          </pre>
        </details>
      )}
      {intent && (
        <div className="my-3 space-y-2 rounded-xl bg-muted/40 p-3 text-sm">
          <p>
            Local state: <strong>{intent.state}</strong>
          </p>
          <p className="break-all">Operation ID: {intent.operationId}</p>
          {intent.code && <p>{intent.code}</p>}
          {intent.result && (
            <pre className="whitespace-pre-wrap break-all text-xs">
              {JSON.stringify(intent.result, null, 2)}
            </pre>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!available || busy}
              onClick={() => void submit(true)}
            >
              Retry original {kind}
            </Button>
            <Button
              variant="outline"
              disabled={intent.state !== "confirmed" || busy}
              onClick={() => void finish()}
            >
              Finish confirmed action
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
    </section>
  );
}
