"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authContext, authEpoch, hasPermission } from "@/lib/auth";
import { useWorkspaceSession } from "@/lib/workspace";
import {
  readCashAdministration,
  mutateCashAdmin,
  pendingCashAdmin,
  finishCashAdmin,
  cashAdminError,
  type CashAdminKind,
  type CashAdminIntent,
  type CashAdminRecipient,
  type CashAdminProposal,
  type CashAdminGrant,
  type CashAdminCeiling,
} from "@/lib/cash-administration";
import PageShell from "@/components/layout/PageShell";
import WorkspaceState from "./WorkspaceState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
const labels: Record<string, string> = {
  "local-driver-cash.v1": "Local driver cash supplement",
  "warehouse-cash.v1": "Warehouse cash supplement",
  "cash-settlement-checker.v1": "Independent settlement checker",
};
const kindLabel = (k: string) =>
  k === "service_charge"
    ? "Company service charge"
    : "Merchant goods COD — monetary basis unavailable";
export default function CashAdministrationWorkspace() {
  const s = useWorkspaceSession();
  if (!s.user || !s.context)
    return (
      <PageShell className="admin-workspace">
        <WorkspaceState
          kind="denied"
          title="Selected company required"
          description="Sign in with your independently appointed cash proposer or checker membership."
        />
      </PageShell>
    );
  return (
    <Administration
      key={s.epoch}
      context={s.context}
      propose={hasPermission(s.user, "membership.proposeCashCapability")}
      check={hasPermission(s.user, "membership.approveCashCapability")}
    />
  );
}
function Administration({
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
    ),
    [cursors, setCursors] = useState<Record<string, string[]>>({
      recipients: [],
      proposals: [],
      grants: [],
    });
  const [recipient, setRecipient] = useState<CashAdminRecipient>(),
    [proposal, setProposal] = useState<CashAdminProposal>(),
    [grant, setGrant] = useState<CashAdminGrant>();
  const permitted = kind === "proposer" ? propose : check;
  const ceiling = useQuery({
    queryKey: ["cash-admin-ceiling", context, kind],
    enabled: permitted,
    retry: false,
    staleTime: 0,
    queryFn: () => readCashAdministration(context, "ceiling", kind),
  });
  const ready = !!ceiling.data && !ceiling.isError;
  const recipients = useQuery({
    queryKey: [
      "cash-admin-recipients",
      context,
      kind,
      cursors.recipients.at(-1),
    ],
    enabled: ready && kind === "proposer",
    retry: false,
    queryFn: () =>
      readCashAdministration(
        context,
        "recipients",
        kind,
        cursors.recipients.at(-1),
      ),
  });
  const proposals = useQuery({
    queryKey: ["cash-admin-proposals", context, kind, cursors.proposals.at(-1)],
    enabled: ready,
    retry: false,
    queryFn: () =>
      readCashAdministration(
        context,
        "proposals",
        kind,
        cursors.proposals.at(-1),
      ),
  });
  const grants = useQuery({
    queryKey: ["cash-admin-grants", context, kind, cursors.grants.at(-1)],
    enabled: ready,
    retry: false,
    queryFn: () =>
      readCashAdministration(context, "grants", kind, cursors.grants.at(-1)),
  });
  function refresh() {
    void ceiling.refetch();
    if (kind === "proposer") void recipients.refetch();
    void proposals.refetch();
    void grants.refetch();
  }
  const warehouseNames = (ids: string[]) =>
    ids
      .map(
        (id) => ceiling.data?.warehouses.find((w) => w.id === id)?.name ?? id,
      )
      .join(", ");
  return (
    <PageShell className="admin-workspace">
      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 basis-80">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Independent capability governance
            </p>
            <h1 className="text-2xl font-semibold">Cash access supplements</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Approve narrowly scoped cash access without changing base
              driver/warehouse roles, scopes or other-company memberships.
              Pending proposals grant nothing.
            </p>
          </div>
          <Button
            variant="outline"
            disabled={!permitted || ceiling.isFetching}
            onClick={refresh}
          >
            Refresh accepted authority and inventory
          </Button>
        </header>
        {!propose && !check ? (
          <WorkspaceState
            kind="denied"
            title="Cash delegation unavailable"
            description="Separate owner-accepted cash-delegation.v1 is required. Ordinary administrator, financial, operational or driver delegation is insufficient."
          />
        ) : (
          <>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Cash authority view"
            >
              {propose && (
                <Button
                  variant={kind === "proposer" ? "default" : "outline"}
                  onClick={() => {
                    setKind("proposer");
                    setCursors({ recipients: [], proposals: [], grants: [] });
                    setRecipient(undefined);
                    setProposal(undefined);
                    setGrant(undefined);
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
                    setCursors({ recipients: [], proposals: [], grants: [] });
                    setRecipient(undefined);
                    setProposal(undefined);
                    setGrant(undefined);
                  }}
                >
                  Independent checker
                </Button>
              )}
            </div>
            {ceiling.isPending && (
              <p role="status">Checking accepted cash authority…</p>
            )}
            {ceiling.isError && (
              <p role="alert" className="rounded-xl border p-4">
                {cashAdminError(ceiling.error)}
              </p>
            )}
            {ceiling.data && (
              <>
                <section className="rounded-2xl border bg-card p-5 space-y-3">
                  <h2 className="text-lg font-semibold">
                    {ceiling.data.legalEntity.name}
                  </h2>
                  <p className="text-sm">
                    Owned entity: {ceiling.data.legalEntity.id} ·{" "}
                    {ceiling.data.legalEntity.baseCurrency} ·{" "}
                    {ceiling.data.revision} / {kind}
                  </p>
                  <div className="admin-columns gap-4">
                    <div>
                      <h3 className="font-medium">Accepted profile ceiling</h3>
                      <ul className="text-sm space-y-2">
                        {ceiling.data.profiles.map((p) => (
                          <li key={p.revision}>
                            {labels[p.revision]} · {p.revision}
                            <p className="text-muted-foreground">
                              {p.permissions.join(", ")}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-medium">Accepted resources</h3>
                      <p className="text-sm">
                        Cash kinds:{" "}
                        {ceiling.data.kinds.map(kindLabel).join(", ")}
                      </p>
                      <ul className="text-sm space-y-2">
                        {ceiling.data.warehouses.map((w) => (
                          <li key={w.id}>
                            {w.name}
                            <p className="text-muted-foreground">{w.id}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Warehouse ceilings do not grant warehouse scopes.
                    Service-charge execution still needs accepted exact pricing,
                    payer/CASH instructions and custody. Merchant COD,
                    accounting, FX and suspended-holder recovery remain
                    unavailable. No collection, transfer or settlement action is
                    performed here.
                  </p>
                </section>
                {kind === "proposer" && (
                  <Inventory
                    title="Eligible existing recipients"
                    pending={recipients.isPending}
                    error={recipients.error}
                    empty={recipients.data?.items.length === 0}
                    next={recipients.data?.nextCursor}
                    previous={cursors.recipients.length > 0}
                    busy={recipients.isFetching}
                    onNext={() => {
                      const c = recipients.data?.nextCursor;
                      if (c)
                        setCursors((v) => ({
                          ...v,
                          recipients: [...v.recipients, c],
                        }));
                    }}
                    onPrevious={() =>
                      setCursors((v) => ({
                        ...v,
                        recipients: v.recipients.slice(0, -1),
                      }))
                    }
                  >
                    <ul className="space-y-3">
                      {recipients.data?.items.map((r) => (
                        <li
                          key={r.membershipId}
                          className="rounded-xl border p-4 flex min-w-0 flex-wrap items-start gap-3"
                        >
                          <div className="min-w-0 flex-1 basis-64">
                            <h3 className="font-medium">{r.name}</h3>
                            <p className="text-sm">
                              {r.profiles
                                .map((p) => labels[p.revision])
                                .join(", ")}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {r.membershipId} · previous acceptance:{" "}
                              {r.expectedAcceptanceId ?? "None"}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => setRecipient(r)}
                          >
                            Select recipient
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </Inventory>
                )}
                <Inventory
                  title="Immutable cash proposals"
                  pending={proposals.isPending}
                  error={proposals.error}
                  empty={proposals.data?.items.length === 0}
                  next={proposals.data?.nextCursor}
                  previous={cursors.proposals.length > 0}
                  busy={proposals.isFetching}
                  onNext={() => {
                    const c = proposals.data?.nextCursor;
                    if (c)
                      setCursors((v) => ({
                        ...v,
                        proposals: [...v.proposals, c],
                      }));
                  }}
                  onPrevious={() =>
                    setCursors((v) => ({
                      ...v,
                      proposals: v.proposals.slice(0, -1),
                    }))
                  }
                >
                  <ul className="space-y-3">
                    {proposals.data?.items.map((p) => (
                      <li
                        key={p.proposalId}
                        className="rounded-xl border p-4 flex min-w-0 flex-wrap items-start gap-3"
                      >
                        <div className="min-w-0 flex-1 basis-64">
                          <h3 className="font-medium">
                            {p.recipientName} · {labels[p.profileRevisions[0]]}
                          </h3>
                          <p className="text-sm">
                            {p.state}
                            {p.state === "pending" && p.stale
                              ? " · prior grant changed"
                              : ""}{" "}
                            · proposer: {p.proposerName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {p.proposalId}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => setProposal(p)}
                        >
                          Inspect exact proposal
                        </Button>
                      </li>
                    ))}
                  </ul>
                </Inventory>
                {proposal && (
                  <section className="rounded-2xl border bg-card p-5 space-y-3">
                    <h2 className="text-lg font-semibold">
                      Exact proposal for {proposal.recipientName}
                    </h2>
                    <dl className="admin-columns gap-3 text-sm">
                      {Object.entries({
                        Recipient: proposal.recipientName,
                        "Recipient membership": proposal.membershipId,
                        "Issuing entity": proposal.legalEntityId,
                        Profile: proposal.profileRevisions[0],
                        "Cash kinds": proposal.kinds.map(kindLabel).join(", "),
                        Warehouses: warehouseNames(proposal.warehouseIds),
                        "Previous acceptance":
                          proposal.expectedAcceptanceId ?? "None",
                        Fingerprint: proposal.fingerprint,
                        Reason: proposal.reason,
                        Proposer: proposal.proposerName,
                        State: proposal.state,
                      }).map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-muted-foreground">{k}</dt>
                          <dd>{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <details className="rounded-xl border p-3">
                      <summary className="cursor-pointer font-medium text-sm">
                        Exact immutable identifiers
                      </summary>
                      <pre
                        className="admin-receipt"
                        tabIndex={0}
                        role="region"
                        aria-label="Exact immutable cash proposal"
                      >
                        {JSON.stringify(proposal, null, 2)}
                      </pre>
                    </details>
                    {!proposal.independent && (
                      <p className="text-sm">
                        Checker must be a different human from proposer and
                        recipient.
                      </p>
                    )}
                  </section>
                )}
                <Inventory
                  title="Workflow-managed supplements"
                  pending={grants.isPending}
                  error={grants.error}
                  empty={grants.data?.items.length === 0}
                  next={grants.data?.nextCursor}
                  previous={cursors.grants.length > 0}
                  busy={grants.isFetching}
                  onNext={() => {
                    const c = grants.data?.nextCursor;
                    if (c)
                      setCursors((v) => ({ ...v, grants: [...v.grants, c] }));
                  }}
                  onPrevious={() =>
                    setCursors((v) => ({ ...v, grants: v.grants.slice(0, -1) }))
                  }
                >
                  <p className="text-sm text-muted-foreground">
                    Only this workflow&apos;s managed supplements are displayed. Base
                    profiles, unrelated grants and other companies remain
                    untouched.
                  </p>
                  <ul className="space-y-3">
                    {grants.data?.items.map((g) => (
                      <li
                        key={g.membershipId}
                        className="rounded-xl border p-4 flex min-w-0 flex-wrap items-start gap-3"
                      >
                        <div className="min-w-0 flex-1 basis-64">
                          <h3 className="font-medium">
                            {g.name} · {labels[g.profileRevisions[0]]}
                          </h3>
                          <p className="text-sm">
                            {g.enabled ? "Accepted" : "Revoked"} ·{" "}
                            {g.kinds.map(kindLabel).join(", ")}
                          </p>
                          <p className="text-sm">
                            {warehouseNames(g.warehouseIds)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Acceptance: {g.acceptanceId}
                          </p>
                        </div>
                        <Button variant="outline" onClick={() => setGrant(g)}>
                          Inspect managed supplement
                        </Button>
                      </li>
                    ))}
                  </ul>
                </Inventory>
                {grant && (
                  <section className="rounded-2xl border bg-card p-5 space-y-3">
                    <h2 className="font-semibold">
                      Managed supplement for {grant.name}
                    </h2>
                    <p className="text-sm">
                      Replacement is a new independently accepted proposal,
                      never an immediate edit. Select this membership from
                      eligible recipients; its previous acceptance is included
                      in the immutable request.
                    </p>
                    <pre
                      className="admin-receipt"
                      tabIndex={0}
                      role="region"
                      aria-label="Current managed cash supplement"
                    >
                      {JSON.stringify(grant, null, 2)}
                    </pre>
                  </section>
                )}
                <div className="admin-columns gap-5">
                  {kind === "proposer" && (
                    <Mutation
                      key="propose"
                      kind="propose"
                      context={context}
                      ceiling={ceiling.data}
                      enabled={ready && !!recipient}
                      recipient={recipient}
                      refresh={refresh}
                    />
                  )}{" "}
                  {kind === "checker" && (
                    <Mutation
                      key="accept"
                      kind="accept"
                      context={context}
                      ceiling={ceiling.data}
                      enabled={
                        ready &&
                        !!proposal &&
                        proposal.independent &&
                        proposal.state === "pending" &&
                        !proposal.stale
                      }
                      proposal={proposal}
                      refresh={refresh}
                    />
                  )}
                  <Mutation
                    key="revoke"
                    kind="revoke"
                    context={context}
                    ceiling={ceiling.data}
                    enabled={ready && !!grant && grant.enabled}
                    grant={grant}
                    refresh={refresh}
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
function Inventory({
  title,
  pending,
  error,
  empty,
  next,
  previous,
  busy,
  onNext,
  onPrevious,
  children,
}: {
  title: string;
  pending: boolean;
  error: unknown;
  empty: boolean;
  next?: string | null;
  previous: boolean;
  busy: boolean;
  onNext: () => void;
  onPrevious: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-5 space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {pending ? (
        <p role="status">Loading bounded inventory…</p>
      ) : error ? (
        <p role="alert">{cashAdminError(error)}</p>
      ) : (
        <>
          {children}
          {empty && (
            <p>
              No eligible records on this page. Filtering may leave an empty
              page with a next cursor.
            </p>
          )}
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={!previous || busy}
          onClick={onPrevious}
        >
          Previous
        </Button>
        <Button variant="outline" disabled={!next || busy} onClick={onNext}>
          Next
        </Button>
      </div>
    </section>
  );
}
function Mutation({
  kind,
  context,
  ceiling,
  enabled,
  recipient,
  proposal,
  grant,
  refresh,
}: {
  kind: CashAdminKind;
  context: string;
  ceiling: CashAdminCeiling;
  enabled: boolean;
  recipient?: CashAdminRecipient;
  proposal?: CashAdminProposal;
  grant?: CashAdminGrant;
  refresh: () => void;
}) {
  const [profile, setProfile] = useState(""),
    [warehouseIds, setWarehouses] = useState<string[]>([]),
    [kinds, setKinds] = useState<string[]>([]),
    [reason, setReason] = useState(""),
    [intent, setIntent] = useState<CashAdminIntent | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const active = useRef(true),
    epoch = useRef(authEpoch()),
    current = () =>
      active.current &&
      context === authContext() &&
      epoch.current === authEpoch();
  useEffect(() => {
    active.current = true;
    try {
      setIntent(pendingCashAdmin(context, kind));
    } catch {
      setError(
        "Stored intent is unreadable; sending is blocked. Preserve it for review.",
      );
    }
    return () => {
      active.current = false;
    };
  }, [context, kind]);
  const eligible = recipient?.profiles.find((p) => p.revision === profile),
    allowedWarehouses = ceiling.warehouses.filter((w) =>
      eligible?.warehouseIds.includes(w.id),
    );
  async function submit(retry = false) {
    if (busy || !current()) return;
    setBusy(true);
    setError("");
    try {
      if (
        !retry &&
        kind === "propose" &&
        (!eligible ||
          !ceiling.profiles.some((p) => p.revision === profile) ||
          warehouseIds.some(
            (id) => !allowedWarehouses.some((w) => w.id === id),
          ) ||
          kinds.some(
            (k) => !ceiling.kinds.includes(k as "cod" | "service_charge"),
          ))
      )
        throw Error(
          "Select a current eligible profile and resources within the returned ceiling",
        );
      const payload = retry
        ? null
        : kind === "propose"
          ? {
              membershipId: recipient?.membershipId,
              legalEntityId: ceiling.legalEntity.id,
              profileRevisions: [profile],
              warehouseIds,
              kinds,
              expectedAcceptanceId: recipient?.expectedAcceptanceId,
              reason,
            }
          : kind === "accept"
            ? {
                proposalId: proposal?.proposalId,
                fingerprint: proposal?.fingerprint,
                reason,
                expected: proposal
                  ? {
                      membershipId: proposal.membershipId,
                      legalEntityId: proposal.legalEntityId,
                      profileRevisions: proposal.profileRevisions,
                      warehouseIds: proposal.warehouseIds,
                      kinds: proposal.kinds,
                    }
                  : undefined,
              }
            : {
                membershipId: grant?.membershipId,
                legalEntityId: grant?.legalEntityId,
                expectedAcceptanceId: grant?.acceptanceId,
                reason,
              };
      const r = await mutateCashAdmin(context, kind, payload);
      if (current()) {
        setIntent(r);
        refresh();
      }
    } catch (e) {
      if (current()) {
        try {
          setIntent(pendingCashAdmin(context, kind));
        } catch {}
        setError(
          e instanceof Error && !("response" in e)
            ? e.name === "ZodError"
              ? "Select exactly one eligible profile, at least one owned warehouse/cash kind and a bounded reason."
              : e.message
            : cashAdminError(e),
        );
      }
    } finally {
      if (current()) setBusy(false);
    }
  }
  const toggle = (v: string, values: string[], update: (v: string[]) => void) =>
    update(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  return (
    <section className="rounded-2xl border bg-card p-5 space-y-4">
      <h2 className="text-lg font-semibold">
        {kind === "propose"
          ? "Propose or replace supplement"
          : kind === "accept"
            ? "Independent acceptance"
            : "Revoke managed supplement"}
      </h2>
      <p className="text-sm text-muted-foreground">
        {kind === "propose"
          ? `Recipient: ${recipient?.name ?? "Select an eligible membership"}`
          : kind === "accept"
            ? `Proposal: ${proposal?.proposalId ?? "Inspect a pending independent proposal"}`
            : `Recipient: ${grant?.name ?? "Inspect an accepted managed supplement"}`}
      </p>
      <p className="text-sm text-muted-foreground">
        Persist before sending. Refreshed selectors cannot change a pending
        intent. Explicit matching retries use the original content and ID.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <fieldset
          className="space-y-4"
          disabled={
            !enabled || busy || !!intent || error.startsWith("Stored intent")
          }
        >
          {kind === "propose" && (
            <>
              <div>
                <Label htmlFor="cash-supplement-profile">
                  Approved supplemental profile
                </Label>
                <select
                  id="cash-supplement-profile"
                  value={profile}
                  onChange={(e) => {
                    setProfile(e.target.value);
                    setWarehouses([]);
                  }}
                  required
                  className="mt-2 w-full rounded-md border p-2"
                >
                  <option value="">Choose explicitly…</option>
                  {recipient?.profiles
                    .filter((p) =>
                      ceiling.profiles.some((v) => v.revision === p.revision),
                    )
                    .map((p) => (
                      <option key={p.revision} value={p.revision}>
                        {labels[p.revision]} · {p.revision}
                      </option>
                    ))}
                </select>
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">
                  Named warehouse ceiling (not a scope grant)
                </legend>
                {!allowedWarehouses.length && (
                  <p className="text-sm">
                    Choose a profile to see its eligible warehouses.
                  </p>
                )}
                {allowedWarehouses.map((w) => (
                  <label
                    className="flex min-w-0 items-start gap-2 text-sm"
                    key={w.id}
                  >
                    <input
                      type="checkbox"
                      checked={warehouseIds.includes(w.id)}
                      onChange={() => toggle(w.id, warehouseIds, setWarehouses)}
                    />
                    <span>
                      {w.name}
                      <span className="block text-muted-foreground">
                        {w.id}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">
                  Approved cash kinds
                </legend>
                {ceiling.kinds.map((k) => (
                  <label
                    className="flex min-w-0 items-start gap-2 text-sm"
                    key={k}
                  >
                    <input
                      type="checkbox"
                      checked={kinds.includes(k)}
                      onChange={() => toggle(k, kinds, setKinds)}
                    />
                    <span>{kindLabel(k)}</span>
                  </label>
                ))}
              </fieldset>
            </>
          )}
          <div>
            <Label htmlFor={`cash-admin-${kind}-reason`}>Decision reason</Label>
            <Input
              id={`cash-admin-${kind}-reason`}
              required
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <Button type="submit">
            {busy
              ? "Awaiting confirmation…"
              : kind === "propose"
                ? "Persist and propose"
                : kind === "accept"
                  ? "Persist and accept independently"
                  : "Persist and revoke"}
          </Button>
        </fieldset>
      </form>
      {!enabled && !intent && (
        <p className="text-sm">
          Select an eligible owned record for this action. Revoked/unavailable
          authority or stale/consumed proposals cannot authorize mutation.
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
          <p className="text-sm">Original operation ID: {intent.operationId}</p>
          {intent.code && <p className="text-sm">{intent.code}</p>}
          <pre
            className="admin-receipt"
            tabIndex={0}
            role="region"
            aria-label="Immutable cash administration intent and result"
          >
            {JSON.stringify(
              { intent: intent.payload, result: intent.result ?? null },
              null,
              2,
            )}
          </pre>
          <p className="text-sm">
            Historical receipt is not current execution authority. Unconfirmed
            intent cannot be discarded or replaced here.
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
                  void finishCashAdmin(context, kind)
                    .then(() => {
                      if (current()) {
                        setIntent(null);
                        setReason("");
                        refresh();
                      }
                    })
                    .catch((e) => {
                      if (current()) setError(cashAdminError(e));
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
