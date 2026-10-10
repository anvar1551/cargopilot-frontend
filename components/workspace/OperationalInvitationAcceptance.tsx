"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { authContext, authEpoch, dashboardPathForUser } from "@/lib/auth";
import { useWorkspaceSession } from "@/lib/workspace";
import {
  acceptOperationalInvitation,
  finishOperational,
  pendingOperational,
} from "@/lib/operational-workspace";
import {
  operationalError,
  type OperationalIntent,
} from "@/lib/operational-intent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export default function OperationalInvitationAcceptance() {
  const session = useWorkspaceSession();
  return (
    <Recipient
      key={session.epoch}
      signedIn={Boolean(session.context)}
      email={session.user?.email}
      workspaceHref={dashboardPathForUser(session.user)}
    />
  );
}
function Recipient({
  signedIn,
  email,
  workspaceHref,
}: {
  signedIn: boolean;
  email?: string;
  workspaceHref: string;
}) {
  const [token, setToken] = useState(""),
    [name, setName] = useState(""),
    [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<OperationalIntent | null>(null);
  const running = useRef(false);
  const [pending, setPending] = useState<OperationalIntent | null>(null);
  useEffect(() => {
    try {
      setPending(
        pendingOperational(authContext() ?? "recipient:new", "accept"),
      );
    } catch {
      setError(
        "Stored acceptance is unreadable; preserve it for review. No replacement may be sent.",
      );
    }
  }, []);
  const submit = async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    const epoch = authEpoch(),
      context = authContext();
    try {
      const r = await acceptOperationalInvitation({
        token,
        mode: signedIn ? "existing" : "new",
        ...(!signedIn ? { name, password } : {}),
      });
      if (epoch === authEpoch() && context === authContext()) {
        setResult(r);
        setToken("");
        setName("");
      }
    } catch (e) {
      if (epoch === authEpoch() && context === authContext()) {
        setError(operationalError(e));
        try {
          setPending(pendingOperational(context ?? "recipient:new", "accept"));
        } catch {
          /* Never overwrite an unreadable intent. */
        }
      }
    } finally {
      setPassword("");
      running.current = false;
      setBusy(false);
    }
  };
  return (
    <main className="min-h-screen bg-muted px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-xl space-y-6 rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            CargoPilot · company invitation
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Accept operational access
          </h1>
          <p className="text-sm text-muted-foreground">
            Only the invited identity can accept. Tokens and passwords stay
            transient; no session is issued by acceptance.
          </p>
        </header>
        <div className="rounded-xl bg-muted p-4 text-sm">
          {signedIn ? (
            <>
              <p className="font-medium">Existing identity: {email}</p>
              <p>
                Acceptance verifies this authenticated identity. No password or
                email reassignment is submitted.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium">New identity enrollment</p>
              <p>
                If you already have an account, sign in first, then return here.
                Never establish a new password for an existing identity.
              </p>
            </>
          )}
          <Link
            className="mt-2 inline-block underline underline-offset-4"
            href={signedIn ? workspaceHref : "/login"}
          >
            {signedIn
              ? "Open your workspace to sign out or change identity"
              : "Sign in as an existing invited user"}
          </Link>
        </div>
        {!result ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <fieldset className="space-y-4" disabled={busy}>
              <div className="space-y-2">
                <Label htmlFor="accept-token">Private invitation token</Label>
                <Input
                  id="accept-token"
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                  minLength={43}
                  maxLength={43}
                />
              </div>
              {!signedIn && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="accept-name">Your name</Label>
                    <Input
                      id="accept-name"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      maxLength={160}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accept-password">Establish password</Label>
                    <Input
                      id="accept-password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={12}
                      maxLength={72}
                      aria-describedby="accept-password-note"
                    />
                    <p
                      id="accept-password-note"
                      className="text-xs text-muted-foreground"
                    >
                      12–72 characters, maximum 72 UTF-8 bytes. Cleared after
                      every attempt.
                    </p>
                  </div>
                </>
              )}
              <Button type="submit" className="w-full">
                {busy
                  ? "Awaiting confirmation…"
                  : signedIn
                    ? "Accept as authenticated identity"
                    : "Accept and establish identity"}
              </Button>
            </fieldset>
          </form>
        ) : (
          <section
            role="status"
            className="space-y-3 rounded-xl border p-4 text-sm"
          >
            <h2 className="font-semibold">Acceptance confirmed</h2>
            <p className="break-all">
              Membership: {String(result.result?.companyMembershipId)}
            </p>
            <p className="break-all">Operation: {result.operationId}</p>
            <p>
              Sign in afresh and explicitly select this company membership.
              Acceptance did not switch your current workspace.
            </p>
            <Link
              className="inline-block underline"
              href={signedIn ? workspaceHref : "/login"}
            >
              {signedIn
                ? "Open workspace, sign out, then select the new company"
                : "Continue to login"}
            </Link>
            <Button
              variant="outline"
              onClick={async () => {
                const epoch = authEpoch(),
                  context = authContext();
                try {
                  await finishOperational(result.context, "accept");
                  if (epoch !== authEpoch() || context !== authContext())
                    return;
                  setResult(null);
                  setPending(null);
                  setError("");
                } catch {
                  if (epoch !== authEpoch() || context !== authContext())
                    return;
                  setError(
                    "Confirmed acceptance could not be closed; preserve it for review.",
                  );
                }
              }}
            >
              Finish confirmed acceptance
            </Button>
          </section>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {!result && pending && (
          <p role="status" className="break-all rounded-xl border p-4 text-sm">
            Preserved local acceptance: {pending.state}. Operation ID:{" "}
            {pending.operationId}. Re-enter the original token; a new-user
            attempt requires authenticated confirmation before any retry.
          </p>
        )}
        <aside className="text-sm text-muted-foreground">
          If a new-user response is lost, do not submit credentials again or
          start a new operation. Sign in with the established identity, return
          with the original token and confirm the preserved acceptance.
          Expired/cancelled tokens need the original inviter’s review. No email
          delivery is claimed.
        </aside>
      </div>
    </main>
  );
}
