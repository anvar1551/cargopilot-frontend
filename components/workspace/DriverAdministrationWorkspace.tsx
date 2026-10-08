"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authEpoch, authContext, hasPermission } from "@/lib/auth";
import { useWorkspaceSession } from "@/lib/workspace";
import {
  DRIVER_PROFILES,
  driverError,
  driverPayload,
  type DriverIntent,
  type DriverKind,
} from "@/lib/driver-intent";
import {
  finishDriver,
  mutateDriver,
  pendingDriver,
} from "@/lib/driver-workspace";
import {
  readDriverDiscovery,
  type ManagedDriverGrant,
} from "@/lib/driver-discovery";
import PageShell from "@/components/layout/PageShell";
import WorkspaceState from "./WorkspaceState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export default function DriverAdministrationWorkspace() {
  const session = useWorkspaceSession();
  if (!session.context || !session.user)
    return (
      <PageShell className="admin-workspace">
        <WorkspaceState
          kind="denied"
          title="Selected membership required"
          description="Sign in to the company you intend to manage."
        />
      </PageShell>
    );
  return (
    <DriverStaff
      key={session.epoch}
      context={session.context}
      delegate={hasPermission(session.user, "membership.delegateDrivers")}
      invite={hasPermission(session.user, "membership.invite")}
    />
  );
}
function DriverStaff({
  context,
  delegate,
  invite,
}: {
  context: string;
  delegate: boolean;
  invite: boolean;
}) {
  const [target, setTarget] = useState<ManagedDriverGrant>(),
    [cancelTarget, setCancelTarget] = useState("");
  const [invitationCursors, setInvitationCursors] = useState<string[]>([]),
    [grantCursors, setGrantCursors] = useState<string[]>([]);
  const accepted = useQuery({
    queryKey: ["driver-ceiling", context],
    enabled: delegate,
    retry: false,
    staleTime: 0,
    queryFn: () => readDriverDiscovery(context, "ceiling"),
  });
  const invitations = useQuery({
    queryKey: ["driver-invitations", context, invitationCursors.at(-1)],
    enabled: accepted.isSuccess && invite && accepted.data.canInvite,
    retry: false,
    queryFn: () =>
      readDriverDiscovery(context, "invitations", invitationCursors.at(-1)),
  });
  const grants = useQuery({
    queryKey: ["driver-managed-grants", context, grantCursors.at(-1)],
    enabled: accepted.isSuccess,
    retry: false,
    queryFn: () => readDriverDiscovery(context, "grants", grantCursors.at(-1)),
  });
  const available = delegate && accepted.isSuccess && !grants.isError,
    profiles = accepted.data?.profiles.map((p) => p.revision) ?? [];
  const refresh = () => {
    void accepted.refetch();
    void invitations.refetch();
    void grants.refetch();
  };
  return (
    <PageShell className="admin-workspace">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Company administration
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Driver memberships
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Provision exact local or linehaul eligibility in this selected
            company. No company or warehouse scope, cash capability or shared
            identity classification is granted.
          </p>
          <div className="flex gap-4">
            <Link
              className="underline text-sm"
              href="/invitations/driver/accept"
            >
              Accept a driver invitation
            </Link>
            <Link
              className="underline text-sm"
              href="/dashboard/manager/drivers/roster"
            >
              Authorized fleet roster
            </Link>
          </div>
        </header>
        <section className="rounded-2xl border bg-card p-5 space-y-3">
          <h2 className="text-lg font-semibold">Accepted driver delegation</h2>
          {!delegate || accepted.isError ? (
            <p role="alert">
              Current driver authority is unavailable, revoked or inconsistent.
              Operational delegation and role names cannot authorize driver
              grants.
            </p>
          ) : accepted.isPending ? (
            <p role="status">Checking accepted driver authority…</p>
          ) : (
            <p className="text-sm">
              Current ceiling: {accepted.data.ceilingRevision}. Allowed
              profiles: {profiles.map((p) => DRIVER_PROFILES[p]).join(", ")}.
            </p>
          )}
          <Button variant="outline" onClick={refresh}>
            Refresh driver authority and inventory
          </Button>
        </section>
        <div className="admin-columns gap-5">
          <Action
            kind="invite"
            context={context}
            allowed={available && invite && Boolean(accepted.data?.canInvite)}
            profiles={profiles}
            onConfirmed={refresh}
          />
          <Action
            kind="cancel"
            context={context}
            allowed={
              available &&
              invite &&
              Boolean(accepted.data?.canInvite) &&
              !invitations.isError
            }
            profiles={profiles}
            cancellationId={cancelTarget}
            onConfirmed={refresh}
          />
        </div>
        <section className="rounded-2xl border bg-card p-5 space-y-4">
          <h2 className="text-lg font-semibold">Your driver invitations</h2>
          {invitations.isError ? (
            <p role="alert">
              Invitations cannot be read under current driver authority.
            </p>
          ) : invitations.isFetching ? (
            <p role="status">Loading invitations…</p>
          ) : (
            <ul className="space-y-2">
              {invitations.data?.items.map((i) => (
                <li
                  key={i.id}
                  className="rounded-xl border p-3 flex flex-wrap justify-between items-center gap-3"
                >
                  <div className="min-w-0 flex-1 basis-64 text-sm">
                    <p className="font-medium">{i.email}</p>
                    <p>
                      {DRIVER_PROFILES[i.profileRevision]} · {i.state}
                    </p>
                    <p>Expires {new Date(i.expiresAt).toLocaleString()}</p>
                    <p className="text-xs break-all">{i.id}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!available || i.state !== "pending"}
                    onClick={() => setCancelTarget(i.id)}
                  >
                    Select for cancellation
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {invitations.isSuccess && !invitations.data.items.length && (
            <p>No invitations on this page.</p>
          )}
          <div className="flex flex-wrap gap-2">
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
        </section>
        <section className="rounded-2xl border bg-card p-5 space-y-4">
          <h2 className="text-lg font-semibold">Managed driver eligibility</h2>
          <p className="text-sm text-muted-foreground">
            Only manageable exact driver memberships within your ceiling appear.
            Historical work never authorizes current actions; every mutation
            revalidates eligibility.
          </p>
          {grants.isError ? (
            <p role="alert">
              Eligibility cannot be read under current driver authority.
            </p>
          ) : grants.isFetching ? (
            <p role="status">Loading eligibility…</p>
          ) : (
            <ul className="space-y-2">
              {grants.data?.items.map((g) => (
                <li
                  key={g.membershipId}
                  className="rounded-xl border p-3 flex flex-wrap justify-between gap-3"
                >
                  <div className="min-w-0 flex-1 basis-64 text-sm">
                    <p className="font-medium">
                      {g.name} · {g.email}
                    </p>
                    <p>
                      {DRIVER_PROFILES[g.profileRevision]} ·{" "}
                      {g.enabled ? "Active" : "Revoked"}
                    </p>
                    <p>
                      {g.activeWork
                        ? "Active work: type replacement blocked. Revocation remains available."
                        : "No current type-change blocker observed; mutation checks again."}
                    </p>
                    <p className="text-xs break-all">{g.membershipId}</p>
                  </div>
                  <Button
                    variant="outline"
                    disabled={!available}
                    onClick={() => setTarget(g)}
                  >
                    Inspect driver eligibility
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {grants.isSuccess && !grants.data.items.length && (
            <p>
              No manageable eligibility on this page. Continue if another page
              is available.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!grantCursors.length || grants.isFetching}
              onClick={() => setGrantCursors((v) => v.slice(0, -1))}
            >
              Previous drivers
            </Button>
            <Button
              variant="outline"
              disabled={!grants.data?.nextCursor || grants.isFetching}
              onClick={() =>
                setGrantCursors((v) => [...v, grants.data!.nextCursor!])
              }
            >
              Next drivers
            </Button>
          </div>
        </section>
        <Action
          kind="grant"
          context={context}
          allowed={available}
          target={target}
          profiles={profiles}
          onConfirmed={refresh}
        />
        <aside className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
          Tokens are returned once and never stored. No email is sent. Missing
          delivery cannot regenerate a secret. Revocation stops driver actions
          without reassignment, erasing custody or granting cash recovery.
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
  profiles,
  onConfirmed,
}: {
  context: string;
  kind: Exclude<DriverKind, "accept">;
  allowed: boolean;
  target?: ManagedDriverGrant;
  cancellationId?: string;
  profiles: Array<keyof typeof DRIVER_PROFILES>;
  onConfirmed?: () => void;
}) {
  const [intent, setIntent] = useState<DriverIntent | null>(null),
    [email, setEmail] = useState(""),
    [id, setId] = useState(""),
    [reason, setReason] = useState("");
  const [profile, setProfile] =
      useState<keyof typeof DRIVER_PROFILES>("local-driver.v1"),
    [action, setAction] = useState("grant");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [token, setToken] = useState<string | null>(null);
  const mounted = useRef(true),
    running = useRef(false);
  useEffect(() => {
    mounted.current = true;
    try {
      const saved = pendingDriver(context, kind);
      setIntent(saved);
      if (saved) {
        const p = saved.payload;
        setEmail(typeof p.email === "string" ? p.email : "");
        setId(String(p.invitationId ?? p.membershipId ?? ""));
        setReason(typeof p.reason === "string" ? p.reason : "");
        if (
          typeof p.profileRevision === "string" &&
          p.profileRevision in DRIVER_PROFILES
        )
          setProfile(p.profileRevision as keyof typeof DRIVER_PROFILES);
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
      } else if (cancellationId) setId(cancellationId);
    }
  }, [target, cancellationId, intent]);
  useEffect(() => {
    if (!intent && !target && profiles.length && !profiles.includes(profile))
      setProfile(profiles[0]);
  }, [intent, target, profiles, profile]);
  const submit = async (retry = false) => {
    if (running.current || !allowed) return;
    setError("");
    let payload: unknown;
    try {
      payload = retry
        ? null
        : driverPayload(
            kind,
            kind === "invite"
              ? { email, profileRevision: profile, reason }
              : kind === "cancel"
                ? { invitationId: id, reason }
                : {
                    membershipId: id,
                    action,
                    profileRevision: profile,
                    reason,
                  },
          );
    } catch {
      setError(
        "Check email/UUIDs, the required reason and approved driver profile. No request was sent.",
      );
      return;
    }
    const epoch = authEpoch();
    running.current = true;
    setBusy(true);
    try {
      const r = await mutateDriver(context, kind, payload);
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
        setError(driverError(e));
        try {
          setIntent(pendingDriver(context, kind));
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
      ? "Invite driver staff"
      : kind === "cancel"
        ? "Cancel a known invitation"
        : "Replace or revoke managed access";
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {kind === "grant"
          ? "Only workflow-managed non-self targets. Replacement checks existing and proposed profiles. Active pickup assignments, outstanding nominations or accepted custody block type changes; revocation preserves work and identity history. Target sessions are revoked on success."
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
                  disabled={kind === "grant" && action === "revoke"}
                  onChange={(e) => {
                    setProfile(e.target.value as keyof typeof DRIVER_PROFILES);
                  }}
                >
                  {profiles.map((value) => (
                    <option
                      key={value}
                      value={value}
                      disabled={
                        kind === "grant" &&
                        !!target?.activeWork &&
                        value !== target.profileRevision
                      }
                    >
                      {DRIVER_PROFILES[value]}
                    </option>
                  ))}
                </select>
              </div>
              {kind === "grant" && (
                <div className="space-y-2">
                  <Label htmlFor="grant-action">Managed action</Label>
                  <select
                    id="grant-action"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={action}
                    onChange={(e) => {
                      setAction(e.target.value);
                      if (e.target.value === "revoke" && target)
                        setProfile(target.profileRevision);
                    }}
                  >
                    <option value="grant">Replace driver eligibility</option>
                    <option value="revoke">
                      Revoke managed driver eligibility
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
          <pre
            className="admin-receipt"
            tabIndex={0}
            role="region"
            aria-label="Persisted operation receipt"
          >
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
                  await finishDriver(context, kind);
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
                Send the recipient the token and /invitations/driver/accept
                separately using an approved private channel. No email was sent.
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
