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
    [target, setTarget] = useState("");
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
          <Action context={context} kind="invite" allowed={invite} />
          <Action context={context} kind="cancel" allowed={invite} />
        </div>
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
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!delegate || m.id === userId}
                                onClick={() => setTarget(m.membershipId)}
                              >
                                {m.id === userId
                                  ? "Self changes prohibited"
                                  : "Select membership"}
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
          allowed={delegate}
          target={target}
          onConfirmed={() => void members.refetch()}
        />
        <aside className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
          No invitation inventory/status or accepted-ceiling picker exists.
          Warehouse IDs must be explicitly obtained from authorized
          provisioning; the backend checks ownership and your ceiling. Never
          guess an ID. A lost token cannot be recovered by retry, and no email
          is sent.
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
  onConfirmed,
}: {
  context: string;
  kind: Exclude<OperationalKind, "accept">;
  allowed: boolean;
  target?: string;
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
      setIntent(pendingOperational(context, kind));
    } catch {
      setError("Stored intent is unreadable; no request may be sent.");
    }
    return () => {
      mounted.current = false;
    };
  }, [context, kind]);
  useEffect(() => {
    if (target && !intent && !running.current) setId(target);
  }, [target, intent]);
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
            ? "Only your own issued invitation. Enter its original ID; acceptance may have won the race."
            : "A 72-hour single-use token is returned once. Secure delivery is your responsibility."}
      </p>
      {!allowed && (
        <p role="status" className="mt-3 text-sm">
          Required permission hints are absent. Even with permission,
          owner-approved authority must exist.
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
          disabled={!allowed || busy || Boolean(intent)}
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
                  onChange={(e) =>
                    setProfile(
                      e.target.value as keyof typeof OPERATIONAL_PROFILES,
                    )
                  }
                >
                  {Object.entries(OPERATIONAL_PROFILES).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </div>
              {profile === "operational-warehouse.v1" && (
                <div className="space-y-2">
                  <Label htmlFor={`${kind}-warehouses`}>
                    Explicit owned warehouse IDs
                  </Label>
                  <textarea
                    id={`${kind}-warehouses`}
                    className="min-h-20 w-full rounded-md border bg-background p-3 text-sm"
                    value={warehouseText}
                    onChange={(e) => setWarehouseText(e.target.value)}
                    aria-describedby={`${kind}-scope-note`}
                  />
                  <p
                    id={`${kind}-scope-note`}
                    className="text-xs text-muted-foreground"
                  >
                    Comma or newline separated, up to 20 UUIDs. No implicit
                    company or warehouse access.
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
