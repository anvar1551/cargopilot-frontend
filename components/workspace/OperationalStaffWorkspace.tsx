"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { api } from "@/lib/api";
import { authContext, authEpoch, hasPermission } from "@/lib/auth";
import { useWorkspaceSession } from "@/lib/workspace";
import {
  OPERATIONAL_PROFILES,
  operationalError,
  operationalPayload,
  type OperationalIntent,
  type OperationalKind,
} from "@/lib/operational-intent";
import {
  finishOperational,
  mutateOperational,
  pendingOperational,
} from "@/lib/operational-workspace";
import PageShell from "@/components/layout/PageShell";
import WorkspaceState from "./WorkspaceState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  readOperationalDiscovery,
  type ManagedOperationalGrant,
  type OperationalWarehouse,
} from "@/lib/operational-discovery";

const membersSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            membershipId: z.string().uuid(),
            name: z.string().max(160),
            email: z.string().max(254),
            roles: z
              .array(z.object({ code: z.string().max(160) }).strip())
              .max(100),
            scopes: z
              .array(
                z
                  .object({
                    scopeType: z.string().max(40),
                    scopeRefId: z.string().uuid(),
                  })
                  .strip(),
              )
              .max(100),
          })
          .strip(),
      )
      .max(20),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.literal(20),
  })
  .strip();
export default function OperationalStaffWorkspace() {
  const session = useWorkspaceSession();
  if (!session.context || !session.user)
    return (
      <PageShell>
        <WorkspaceState
          kind="denied"
          title="Selected membership required"
          description="Sign in to the company you intend to manage."
        />
      </PageShell>
    );
  const invite = hasPermission(session.user, "membership.invite"),
    delegate = hasPermission(session.user, "membership.delegateOperational");
  if (!invite && !delegate)
    return (
      <PageShell>
        <WorkspaceState
          kind="denied"
          title="Staff delegation unavailable"
          description="An explicitly approved company delegation authority is required. Ordinary business permissions and role names confer no authority."
        />
        <Link href="/invitations/accept" className="underline">
          Accept an invitation
        </Link>
      </PageShell>
    );
  return (
    <Staff
      key={session.epoch}
      context={session.context}
      userId={session.user.id}
      invite={invite && delegate}
      delegate={delegate}
      directory={invite}
    />
  );
}
function Staff({
  context,
  userId,
  invite,
  delegate,
  directory,
}: {
  context: string;
  userId: string;
  invite: boolean;
  delegate: boolean;
  directory: boolean;
}) {
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [target, setTarget] = useState<ManagedOperationalGrant>(),
    [cancelTarget, setCancelTarget] = useState("");
  const [invitationCursors, setInvitationCursors] = useState<string[]>([]),
    [grantCursors, setGrantCursors] = useState<string[]>([]);
  const accepted = useQuery({
    queryKey: ["operational-ceiling", context],
    enabled: delegate,
    retry: false,
    staleTime: 0,
    queryFn: () => readOperationalDiscovery(context, "ceiling"),
  });
  const warehouses = useQuery({
    queryKey: ["operational-warehouse-ceiling", context],
    enabled: accepted.isSuccess,
    retry: false,
    queryFn: () => readOperationalDiscovery(context, "warehouses"),
  });
  const invitations = useQuery({
    queryKey: ["operational-invitations", context, invitationCursors.at(-1)],
    enabled: accepted.isSuccess && invite && accepted.data.canInvite,
    retry: false,
    queryFn: () =>
      readOperationalDiscovery(
        context,
        "invitations",
        invitationCursors.at(-1),
      ),
  });
  const grants = useQuery({
    queryKey: ["operational-managed-grants", context, grantCursors.at(-1)],
    enabled: accepted.isSuccess,
    retry: false,
    queryFn: () =>
      readOperationalDiscovery(context, "grants", grantCursors.at(-1)),
  });
  const available =
    accepted.isSuccess && !warehouses.isError && !grants.isError;
  const resources = warehouses.data?.items ?? [];
  const approved = accepted.data?.profiles.map((p) => p.revision) ?? [];
  const refreshDiscovery = () => {
    void accepted.refetch();
    void warehouses.refetch();
    void invitations.refetch();
    void grants.refetch();
    void members.refetch();
  };
  const members = useQuery({
    queryKey: ["operational-members", context, q, page],
    enabled: directory,
    retry: false,
    queryFn: async () => {
      const epoch = authEpoch();
      if (context !== authContext()) throw Error("Selected context changed");
      const r = await api.get("/api/auth", { params: { q, page, limit: 20 } });
      if (context !== authContext() || epoch !== authEpoch())
        throw Error("Session changed");
      return membersSchema.parse(r.data);
    },
  });
  return (
    <PageShell>
      <div className="space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Company administration
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Operational staff
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Invite clerks, dispatchers and warehouse staff. The server verifies
            your active accepted ceiling on every request. Financial, driver and
            delegation grants are separate workflows.
          </p>
          <Link
            href="/invitations/accept"
            className="inline-block text-sm underline underline-offset-4"
          >
            Accept an invitation as its recipient
          </Link>
        </header>
        <div className="grid gap-5 xl:grid-cols-2">
          <Action
            context={context}
            kind="invite"
            allowed={invite && available && Boolean(accepted.data?.canInvite)}
            warehouses={resources}
            profiles={approved}
            onConfirmed={refreshDiscovery}
          />
          <Action
            context={context}
            kind="cancel"
            allowed={
              invite &&
              available &&
              Boolean(accepted.data?.canInvite) &&
              !invitations.isError
            }
            warehouses={resources}
            profiles={approved}
            cancellationId={cancelTarget}
            onConfirmed={refreshDiscovery}
          />
        </div>
        <section className="rounded-2xl border bg-card p-5 space-y-4">
          <h2 className="text-lg font-semibold">
            Accepted operational delegation
          </h2>
          {accepted.isPending ? (
            <p role="status">Checking current accepted authority…</p>
          ) : accepted.isError || !available ? (
            <p role="alert">
              Discovery is unavailable. Your accepted authority may be revoked,
              expired or inconsistent; sign in afresh or ask the installation
              owner to review it. No grant or invitation action is enabled from
              role names alone.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Current ceiling: {accepted.data.ceilingRevision}. Only
              server-returned profiles and owned warehouses are selectable.
              Every mutation checks current authority again.
            </p>
          )}
          <Button variant="outline" onClick={refreshDiscovery}>
            Refresh accepted authority and inventory
          </Button>
          <h3 className="font-semibold">Your invitations</h3>
          {invitations.isError ? (
            <p role="alert">
              Invitations cannot be read under current authority.
            </p>
          ) : invitations.isFetching ? (
            <p role="status">Loading invitations…</p>
          ) : (
            <ul className="space-y-2">
              {invitations.data?.items.map((i) => (
                <li
                  key={i.id}
                  className="rounded-xl border p-3 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="text-sm">
                    <p className="font-medium">{i.email}</p>
                    <p>
                      {OPERATIONAL_PROFILES[i.profileRevision]} · {i.state} ·
                      expires {new Date(i.expiresAt).toLocaleString()}
                    </p>
                    <p className="text-xs break-all">{i.id}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={i.state !== "pending" || !available}
                    onClick={() => setCancelTarget(i.id)}
                  >
                    Select for cancellation
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {invitations.isSuccess && !invitations.data.items.length && (
            <p className="text-sm">No invitations on this page.</p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={!invitationCursors.length || invitations.isFetching}
              onClick={() => setInvitationCursors((v) => v.slice(0, -1))}
            >
              Previous invitations
            </Button>
            <Button
              variant="outline"
              disabled={!invitations.data?.nextCursor || invitations.isFetching}
              onClick={() =>
                setInvitationCursors((v) => [
                  ...v,
                  invitations.data!.nextCursor!,
                ])
              }
            >
              Next invitations
            </Button>
          </div>
          <h3 className="font-semibold">
            Workflow-managed access within your ceiling
          </h3>
          <p className="text-sm text-muted-foreground">
            Unrelated grants, self changes, other delegators and access outside
            your current ceiling are excluded. The member directory below does
            not imply grant authority.
          </p>
          {grants.isError ? (
            <p role="alert">
              Managed grants cannot be read under current authority.
            </p>
          ) : grants.isFetching ? (
            <p role="status">Loading managed grants…</p>
          ) : (
            <ul className="space-y-2">
              {grants.data?.items.map((g) => (
                <li
                  key={g.membershipId}
                  className="rounded-xl border p-3 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="text-sm">
                    <p className="font-medium">
                      {g.name} · {g.email}
                    </p>
                    <p>
                      {OPERATIONAL_PROFILES[g.profileRevision]} ·{" "}
                      {g.enabled ? "Active" : "Revoked"}
                    </p>
                    <p>
                      {!g.enabled && "Last managed scope (revoked): "}
                      {g.warehouseIds.length
                        ? g.warehouseIds
                            .map(
                              (id) =>
                                resources.find((w) => w.id === id)?.name ??
                                "Unavailable warehouse",
                            )
                            .join(", ")
                        : "Selected company scope"}
                    </p>
                    <p className="text-xs break-all">{g.membershipId}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!available}
                    onClick={() => setTarget(g)}
                  >
                    Inspect managed access
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {grants.isSuccess && !grants.data.items.length && (
            <p className="text-sm">
              No manageable grants on this page. Continue if another page is
              available.
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={!grantCursors.length || grants.isFetching}
              onClick={() => setGrantCursors((v) => v.slice(0, -1))}
            >
              Previous grants
            </Button>
            <Button
              variant="outline"
              disabled={!grants.data?.nextCursor || grants.isFetching}
              onClick={() =>
                setGrantCursors((v) => [...v, grants.data!.nextCursor!])
              }
            >
              Next grants
            </Button>
          </div>
        </section>
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-semibold">Selected-company members</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This is the existing scoped member directory, not a managed-grant or
            invitation inventory. Selecting a member does not prove that their
            grants may be changed.
          </p>
          {directory ? (
            <>
              <Label htmlFor="staff-search" className="mt-4 block">
                Search members
              </Label>
              <Input
                id="staff-search"
                className="mt-2 max-w-md"
                value={q}
                maxLength={100}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
              {members.isPending ? (
                <p role="status" className="py-4">
                  Loading members…
                </p>
              ) : members.isError ? (
                <p role="alert" className="py-4">
                  The directory could not be loaded in this context. Retry after
                  verifying current access.
                </p>
              ) : (
                <>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <caption className="sr-only">
                        Current company members and displayed profiles
                      </caption>
                      <thead>
                        <tr className="border-b">
                          <th className="p-3">Member</th>
                          <th className="p-3">Displayed profiles</th>
                          <th className="p-3">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.data?.items.map((m) => (
                          <tr key={m.membershipId} className="border-b">
                            <td className="p-3">
                              <p className="font-medium">{m.name}</p>
                              <p className="text-muted-foreground">{m.email}</p>
                            </td>
                            <td className="p-3">
                              {m.roles.map((r) => r.code).join(", ") ||
                                "No active profile"}
                            </td>
                            <td className="p-3">
                              <Button variant="outline" size="sm" disabled>
                                {m.id === userId
                                  ? "Self changes prohibited"
                                  : "Use managed inventory"}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!members.data?.items.length && (
                    <p className="py-4 text-sm">
                      No members match this search.
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button
                      variant="outline"
                      disabled={page === 1}
                      onClick={() => setPage((v) => v - 1)}
                    >
                      Previous
                    </Button>
                    <span className="text-sm">Page {page}</span>
                    <Button
                      variant="outline"
                      disabled={page * 20 >= (members.data?.total ?? 0)}
                      onClick={() => setPage((v) => v + 1)}
                    >
                      Next
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => void members.refetch()}
                    >
                      Refresh directory
                    </Button>
                  </div>
                </>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm">
              Directory permission is absent. Use an explicit verified
              membership ID; no global lookup is available.
            </p>
          )}
        </section>
        <Action
          context={context}
          kind="grant"
          allowed={delegate && available}
          target={target}
          warehouses={resources}
          profiles={approved}
          onConfirmed={refreshDiscovery}
        />
        <aside className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
          Inventory never recovers a secret or changes a pending intent. Lost
          tokens cannot be regenerated by retries; no email is sent. Discovery
          is a current snapshot, not authorization for a later mutation.
        </aside>
      </div>
    </PageShell>
  );
}
function Action({
  context,
  kind,
  allowed,
  target,
  cancellationId,
  warehouses,
  profiles,
  onConfirmed,
}: {
  context: string;
  kind: Exclude<OperationalKind, "accept">;
  allowed: boolean;
  target?: ManagedOperationalGrant;
  cancellationId?: string;
  warehouses: OperationalWarehouse[];
  profiles: Array<keyof typeof OPERATIONAL_PROFILES>;
  onConfirmed?: () => void;
}) {
  const [intent, setIntent] = useState<OperationalIntent | null>(null),
    [email, setEmail] = useState(""),
    [id, setId] = useState(""),
    [reason, setReason] = useState("");
  const [profile, setProfile] = useState<keyof typeof OPERATIONAL_PROFILES>(
      "operational-clerk.v1",
    ),
    [warehouseText, setWarehouseText] = useState(""),
    [action, setAction] = useState("grant");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [token, setToken] = useState<string | null>(null);
  const mounted = useRef(true),
    running = useRef(false);
  useEffect(() => {
    mounted.current = true;
    try {
      const saved = pendingOperational(context, kind);
      setIntent(saved);
      if (saved) {
        const p = saved.payload;
        setEmail(typeof p.email === "string" ? p.email : "");
        setId(String(p.invitationId ?? p.membershipId ?? ""));
        setReason(typeof p.reason === "string" ? p.reason : "");
        if (
          typeof p.profileRevision === "string" &&
          p.profileRevision in OPERATIONAL_PROFILES
        )
          setProfile(p.profileRevision as keyof typeof OPERATIONAL_PROFILES);
        setWarehouseText(
          Array.isArray(p.warehouseIds) ? p.warehouseIds.join(",") : "",
        );
        if (p.action === "grant" || p.action === "revoke") setAction(p.action);
      }
    } catch {
      setError("Stored intent is unreadable; no request may be sent.");
    }
    return () => {
      mounted.current = false;
    };
  }, [context, kind]);
  useEffect(() => {
    if (!intent && !running.current) {
      if (target) {
        setId(target.membershipId);
        setProfile(target.profileRevision);
        setWarehouseText(target.warehouseIds.join(","));
      } else if (cancellationId) setId(cancellationId);
    }
  }, [target, cancellationId, intent]);
  const submit = async (retry = false) => {
    if (running.current || !allowed) return;
    setError("");
    let payload: unknown;
    try {
      const warehouseIds = warehouseText.trim()
        ? warehouseText.split(/[\s,]+/).filter(Boolean)
        : [];
      payload = retry
        ? null
        : operationalPayload(
            kind,
            kind === "invite"
              ? { email, profileRevision: profile, warehouseIds, reason }
              : kind === "cancel"
                ? { invitationId: id, reason }
                : {
                    membershipId: id,
                    action,
                    profileRevision: profile,
                    warehouseIds,
                    reason,
                  },
          );
    } catch {
      setError(
        "Check email/UUIDs, the required reason and profile scopes (up to 20 warehouses). No request was sent.",
      );
      return;
    }
    const epoch = authEpoch();
    running.current = true;
    setBusy(true);
    try {
      const r = await mutateOperational(context, kind, payload);
      if (
        mounted.current &&
        epoch === authEpoch() &&
        context === authContext()
      ) {
        setIntent(r.intent);
        setToken(r.oneTimeToken ?? null);
        onConfirmed?.();
      }
    } catch (e) {
      if (
        mounted.current &&
        epoch === authEpoch() &&
        context === authContext()
      ) {
        setError(operationalError(e));
        try {
          setIntent(pendingOperational(context, kind));
        } catch {
          /* Preserve unreadable storage; never overwrite it. */
        }
      }
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const title =
    kind === "invite"
      ? "Invite operational staff"
      : kind === "cancel"
        ? "Cancel a known invitation"
        : "Replace or revoke managed access";
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {kind === "grant"
          ? "Only workflow-managed non-self targets. Replacement checks both removed and proposed scopes; unrelated grants are protected. Target sessions are revoked on success."
          : kind === "cancel"
            ? "Only your own issued invitation. Select it from inventory; acceptance may have won the race."
            : "A 72-hour single-use token is returned once. Secure delivery is your responsibility."}
      </p>
      {!allowed && (
        <p role="status" className="mt-3 text-sm">
          Current accepted authority and required permissions must be confirmed.
          Permission possession or role names alone do not enable this action.
        </p>
      )}
      {!intent &&
        ((kind === "grant" && !target) ||
          (kind === "cancel" && !cancellationId)) && (
          <p className="mt-3 text-sm" role="status">
            Select an eligible record from the authoritative inventory below
            before starting an action.
          </p>
        )}
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <fieldset
          disabled={
            !allowed ||
            busy ||
            Boolean(intent) ||
            (kind === "grant" && !target) ||
            (kind === "cancel" && !cancellationId)
          }
          className="space-y-4 disabled:opacity-70"
        >
          <div className="space-y-2">
            <Label htmlFor={`${kind}-id`}>
              {kind === "invite"
                ? "Recipient email"
                : kind === "cancel"
                  ? "Invitation ID"
                  : "Company membership ID"}
            </Label>
            <Input
              id={`${kind}-id`}
              type={kind === "invite" ? "email" : "text"}
              autoComplete="off"
              value={kind === "invite" ? email : id}
              onChange={(e) =>
                kind === "invite"
                  ? setEmail(e.target.value)
                  : setId(e.target.value)
              }
              required
              readOnly={kind !== "invite"}
            />
          </div>
          {kind !== "cancel" && (
            <>
              <div className="space-y-2">
                <Label htmlFor={`${kind}-profile`}>
                  {kind === "grant" && action === "revoke"
                    ? "Exact current managed profile"
                    : "Approved profile"}
                </Label>
                <select
                  id={`${kind}-profile`}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={profile}
                  onChange={(e) => {
                    setProfile(
                      e.target.value as keyof typeof OPERATIONAL_PROFILES,
                    );
                    if (e.target.value !== "operational-warehouse.v1")
                      setWarehouseText("");
                  }}
                >
                  {profiles.map((value) => (
                    <option key={value} value={value}>
                      {OPERATIONAL_PROFILES[value]}
                    </option>
                  ))}
                </select>
              </div>
              {profile === "operational-warehouse.v1" && (
                <div className="space-y-2">
                  <Label htmlFor={`${kind}-warehouses`}>
                    Allowed warehouses
                  </Label>
                  <div
                    id={`${kind}-warehouses`}
                    className="max-h-60 overflow-y-auto rounded-md border p-3 space-y-3"
                    role="group"
                    aria-label="Allowed warehouse resources"
                  >
                    {warehouses.map((w) => (
                      <label
                        key={w.id}
                        className="flex gap-3 items-start text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={warehouseText.split(",").includes(w.id)}
                          onChange={(e) =>
                            setWarehouseText((old) => {
                              const ids = old
                                .split(",")
                                .filter(Boolean)
                                .filter((id) => id !== w.id);
                              return [
                                ...ids,
                                ...(e.target.checked ? [w.id] : []),
                              ].join(",");
                            })
                          }
                        />
                        <span>
                          {w.name}
                          <span className="block text-xs text-muted-foreground">
                            {w.location}
                          </span>
                        </span>
                      </label>
                    ))}
                    {!warehouses.length && (
                      <p>
                        No owned warehouses are available in your accepted
                        ceiling.
                      </p>
                    )}
                  </div>
                  <p
                    id={`${kind}-scope-note`}
                    className="text-xs text-muted-foreground"
                  >
                    Select explicit resources within your current accepted
                    ceiling. No implicit company or warehouse access.
                  </p>
                </div>
              )}
              {kind === "grant" && (
                <div className="space-y-2">
                  <Label htmlFor="grant-action">Managed action</Label>
                  <select
                    id="grant-action"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                  >
                    <option value="grant">
                      Replace operational profile/scopes
                    </option>
                    <option value="revoke">
                      Revoke exact managed profile/scopes
                    </option>
                  </select>
                </div>
              )}
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor={`${kind}-reason`}>Reason</Label>
            <Input
              id={`${kind}-reason`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              required
            />
          </div>
          <Button
            type="submit"
            disabled={Boolean(error) && !intent && error.startsWith("Stored")}
          >
            {busy
              ? "Awaiting confirmation…"
              : kind === "invite"
                ? "Create invitation"
                : kind === "cancel"
                  ? "Request cancellation"
                  : "Submit managed change"}
          </Button>
        </fieldset>
      </form>
      {intent && (
        <div
          className="mt-4 space-y-3 rounded-xl bg-muted p-4 text-sm"
          role="status"
        >
          <p className="font-medium">Local receipt: {intent.state}</p>
          <p className="break-all">Operation ID: {intent.operationId}</p>
          <pre className="max-h-44 overflow-auto whitespace-pre-wrap break-all text-xs">
            {JSON.stringify(intent.result ?? intent.payload, null, 2)}
          </pre>
          <p>No live invitation state is inferred from this receipt.</p>
          <Button
            variant="outline"
            disabled={busy || !allowed}
            onClick={() => void submit(true)}
          >
            Verify/retry original intent
          </Button>
          {intent.state === "confirmed" && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={async () => {
                const epoch = authEpoch();
                try {
                  await finishOperational(context, kind);
                  if (
                    !mounted.current ||
                    epoch !== authEpoch() ||
                    context !== authContext()
                  )
                    return;
                  setIntent(null);
                  setToken(null);
                  setError("");
                } catch {
                  if (
                    !mounted.current ||
                    epoch !== authEpoch() ||
                    context !== authContext()
                  )
                    return;
                  setError(
                    "Unable to finish confirmed intent; storage remains protected.",
                  );
                }
              }}
            >
              Start a new action
            </Button>
          )}
        </div>
      )}
      {kind === "invite" && intent?.state === "confirmed" && (
        <div className="mt-4 space-y-3 rounded-xl border border-amber-300 p-4 text-sm">
          <h3 className="font-semibold">Private one-time handoff</h3>
          {token ? (
            <>
              <Label htmlFor="one-time-invitation-token">
                Invitation token — not saved
              </Label>
              <Input
                id="one-time-invitation-token"
                type="password"
                autoComplete="off"
                value={token}
                readOnly
              />
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(token);
                  } catch {
                    setError(
                      "Clipboard unavailable. Select the transient token for private handoff.",
                    );
                  }
                }}
              >
                Copy token for secure delivery
              </Button>
              <Button variant="ghost" onClick={() => setToken(null)}>
                Clear token from this screen
              </Button>
              <p>
                Send the recipient the token and /invitations/accept separately
                using an approved private channel. No email was sent.
                Closing/reloading loses this token.
              </p>
            </>
          ) : (
            <p>
              The token is unavailable here. Matching creation retries recover
              only metadata. Do not regenerate a secret or create another
              invitation because the outcome was uncertain.
            </p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
