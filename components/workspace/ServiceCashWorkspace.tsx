"use client";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { useQuery } from "@tanstack/react-query";
import { authContext, authEpoch } from "@/lib/auth";
import { useWorkspaceSession } from "@/lib/workspace";
import {
  readCash,
  cashAvailableActions,
  mutateCashAction,
  pendingCash,
  finishCash,
  legacyCashPending,
  cashError,
  type CashAction,
  type CashIntent,
  type CashAccess,
  type CashPage,
  type RecipientPage,
} from "@/lib/service-cash";
import PageShell from "@/components/layout/PageShell";
import WorkspaceState from "./WorkspaceState";
import { Field, control, ExactDetails } from "./PricingWorkflowShared";
import { Button as UiButton } from "@/components/ui/button";
function Button({ className, ...props }: ComponentProps<typeof UiButton>) {
  return (
    <UiButton
      {...props}
      className={`max-w-full h-auto whitespace-normal py-2 ${className ?? ""}`}
    />
  );
}
const labels: Record<CashAction, string> = {
  collect: "Record collection",
  offer: "Offer cash handoff",
  accept: "Accept this cash offer",
  settle: "Confirm independent settlement",
};
export default function ServiceCashWorkspace() {
  const s = useWorkspaceSession();
  if (!s.user || !s.context)
    return (
      <PageShell className="admin-workspace">
        <WorkspaceState
          kind="denied"
          title="Selected membership required"
          description="Sign in to the exact membership with an independently accepted cash capability."
        />
      </PageShell>
    );
  return <CashWorkspace key={s.epoch} context={s.context} />;
}
function CashWorkspace({ context }: { context: string }) {
  const [cursor, setCursor] = useState<string | undefined>(),
    [orderId, setOrderId] = useState(""),
    [offerId, setOfferId] = useState(""),
    [warehouseId, setWarehouseId] = useState(""),
    [recipientId, setRecipientId] = useState(""),
    [recipientCursor, setRecipientCursor] = useState<string | undefined>(),
    [note, setNote] = useState(""),
    [intent, setIntent] = useState<CashIntent | null>(null),
    [ready, setReady] = useState(false),
    [legacy, setLegacy] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const live = useRef(true),
    epoch = authEpoch(),
    current = () =>
      live.current && context === authContext() && epoch === authEpoch();
  useEffect(() => {
    live.current = true;
    try {
      setIntent(pendingCash(context));
      setLegacy(legacyCashPending());
      setReady(true);
    } catch (e) {
      setError(cashError(e));
    }
    return () => {
      live.current = false;
    };
  }, [context]);
  const access = useQuery({
    queryKey: ["service-cash-access", context, epoch],
    queryFn: () => readCash<CashAccess>(context, "/cash/access"),
    retry: false,
  });
  const queue = useQuery({
    queryKey: ["service-cash-work", context, epoch, cursor],
    queryFn: () =>
      readCash<CashPage>(context, "/cash/queue", { limit: 20, cursor }),
    enabled: !!access.data,
    retry: false,
  });
  const preflight = useQuery({
    queryKey: ["service-cash-preflight", context, epoch, orderId],
    queryFn: () => readCash<CashPage>(context, `/${orderId}/cash/preflight`),
    enabled: !!orderId && !!access.data,
    retry: false,
  });
  const rows = preflight.data?.items ?? [],
    work =
      rows.find((r) => (r.offerId ?? "") === offerId) ??
      (rows.length === 1 ? rows[0] : undefined),
    cap = access.error ? undefined : access.data;
  const myHeld =
    work?.state === "held" && work.holderMembershipId === cap?.membershipId;
  const recipients = useQuery({
    queryKey: [
      "service-cash-recipients",
      context,
      epoch,
      orderId,
      warehouseId,
      recipientCursor,
      work?.expectedEventId,
    ],
    queryFn: () =>
      readCash<RecipientPage>(context, `/${orderId}/cash/recipients`, {
        limit: 10,
        cursor: recipientCursor,
        ...(work?.holderWarehouseId ? {} : { warehouseId }),
      }),
    enabled:
      !!cap &&
      !!myHeld &&
      cap.permissions.includes("cash.handoff") &&
      (!!work?.holderWarehouseId || !!warehouseId),
    retry: false,
  });
  const selectedRecipient = recipients.data?.items.find(
    (r) => r.membershipId === recipientId,
  );
  const refresh = () => {
    void queue.refetch();
    if (orderId) void preflight.refetch();
    void access.refetch();
  };
  const run = async (action: CashAction, retry = false) => {
    if (busy || !ready || legacy) return;
    setBusy(true);
    setError("");
    try {
      let payload: unknown = null;
      if (!retry) {
        if (!work || intent)
          throw Error(
            "Load current preflight and resolve the original intent first",
          );
        const base = {
          orderId: work.orderId,
          kind: "service_charge",
          note: note || null,
        };
        if (action === "collect") {
          if (!work.obligationId) throw Error("No authoritative obligation");
          if (cap?.profileRevision === "warehouse-cash.v1" && !warehouseId)
            throw Error("Select your scoped warehouse");
          payload = {
            ...base,
            obligationId: work.obligationId,
            ...(cap?.profileRevision === "warehouse-cash.v1"
              ? { warehouseId }
              : {}),
          };
        } else {
          if (!work.expectedEventId)
            throw Error("No authoritative custody event");
          const state = { ...base, expectedEventId: work.expectedEventId };
          if (action === "offer") {
            if (
              !selectedRecipient ||
              recipients.data?.expectedEventId !== work.expectedEventId
            )
              throw Error(
                "Refresh and choose a currently eligible named recipient",
              );
            payload = {
              ...state,
              recipientMembershipId: selectedRecipient.membershipId,
              recipientWarehouseId: selectedRecipient.warehouseId,
            };
          } else if (action === "accept") {
            if (
              !work.offerId ||
              work.recipientMembershipId !== cap?.membershipId
            )
              throw Error("Choose an offer addressed to your exact membership");
            payload = { ...state, offerId: work.offerId };
          } else {
            if (
              !window.confirm(
                "Confirm physical settlement as the independently authorized checker. This does not mark an invoice paid or post accounting.",
              )
            )
              return;
            payload = state;
          }
        }
      }
      const r = await mutateCashAction(context, action, payload);
      if (current()) {
        setIntent(r);
        refresh();
      }
    } catch (e) {
      if (current()) {
        setError(cashError(e));
        try {
          setIntent(pendingCash(context));
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
      await finishCash(context);
      if (current()) {
        setIntent(null);
        setNote("");
        refresh();
      }
    } catch (e) {
      if (current()) setError(cashError(e));
    } finally {
      if (current()) setBusy(false);
    }
  };
  const selectOrder = (id: string, offer: string | null) => {
    setOrderId(id);
    setOfferId(offer ?? "");
    setRecipientId("");
    setRecipientCursor(undefined);
    setWarehouseId("");
    setNote("");
  };
  const actions = cap && work ? cashAvailableActions(cap, work) : [];
  const blocked = busy || !ready || legacy || !!intent || preflight.isFetching;
  return (
    <PageShell className="admin-workspace">
      <div className="min-w-0 space-y-6">
        <header className="min-w-0 space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Operations / Service-charge cash
          </p>
          <h1 className="text-2xl font-semibold break-words">
            Controlled cash custody
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Record company service-charge money using its accepted obligation.
            Parcel movement never transfers money. A handoff offer retains the
            current holder until the named recipient explicitly accepts.
          </p>
        </header>
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-destructive p-4 break-words"
          >
            {error}
          </div>
        )}
        {legacy && (
          <WorkspaceState
            kind="error"
            title="Legacy cash intent requires reconciliation"
            description="An older persisted request exists. It is preserved without adoption or deletion. New cash actions are blocked until its outcome is safely resolved outside this workspace."
          />
        )}
        {access.isPending ? (
          <WorkspaceState
            kind="loading"
            title="Checking accepted cash access"
          />
        ) : access.error ? (
          <WorkspaceState
            kind="denied"
            title="Cash capability unavailable"
            description={cashError(access.error)}
          />
        ) : (
          cap && (
            <section className="rounded-xl border bg-card p-4 space-y-2 min-w-0">
              <h2 className="font-semibold">Accepted access</h2>
              <p className="text-sm break-words">
                {cap.profileRevision} · selected membership only
              </p>
              <p className="text-sm text-muted-foreground break-all">
                Legal entity: {cap.legalEntityId}
              </p>
              <p className="text-sm">
                Merchant COD, refunds, suspended-holder recovery and accounting
                are unavailable.
              </p>
            </section>
          )
        )}
        {intent && (
          <section
            className="min-w-0 rounded-xl border border-primary p-4 space-y-3"
            aria-live="polite"
          >
            <h2 className="font-semibold">
              {intent.state === "confirmed"
                ? "Confirmed historical receipt"
                : "Uncertain original action — retained"}
            </h2>
            <p className="text-sm">
              {labels[intent.action]}. This receipt is not the current
              operational snapshot. No other action can replace this request.
            </p>
            <ExactDetails
              value={intent}
              title="Original request identity, content and receipt"
            />
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={busy || legacy || !cap}
                onClick={() => void run(intent.action, true)}
              >
                Explicitly retry original request
              </Button>
              {intent.state === "confirmed" && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void finish()}
                >
                  Keep receipt reviewed; start next action
                </Button>
              )}
            </div>
          </section>
        )}
        {cap && (
          <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <section className="min-w-0 rounded-xl border p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold">Your scoped cash work</h2>
                <Button
                  variant="outline"
                  disabled={queue.isFetching}
                  onClick={refresh}
                >
                  Refresh current state
                </Button>
              </div>
              {queue.isPending ? (
                <WorkspaceState kind="loading" title="Loading cash work" />
              ) : queue.error ? (
                <WorkspaceState
                  kind="error"
                  title="Discovery unavailable"
                  description={cashError(queue.error)}
                />
              ) : !queue.data?.items.length ? (
                <WorkspaceState
                  kind="empty"
                  title="No eligible cash work on this page"
                  description="Only proved service-charge obligations within your selected capability are listed."
                />
              ) : (
                <ul className="space-y-3">
                  {queue.data.items.map((r) => (
                    <li
                      key={`${r.orderId}:${r.offerId ?? "none"}`}
                      className="min-w-0 rounded-lg border p-3 space-y-2"
                    >
                      <p className="font-medium break-all">{r.orderNumber}</p>
                      <p className="text-sm break-words">
                        {r.amount ?? "Unproved"} {r.currency ?? ""} ·{" "}
                        {r.collectionParty.toLowerCase()} collection ·{" "}
                        {r.orderStatus}
                      </p>
                      <p className="text-sm">
                        {r.offerId
                          ? "Pending offer — custody not transferred"
                          : r.state}
                      </p>
                      <Button
                        variant="outline"
                        className="max-w-full whitespace-normal"
                        onClick={() => selectOrder(r.orderId, r.offerId)}
                      >
                        Inspect authoritative preflight
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  disabled={!cursor || queue.isFetching}
                  onClick={() => setCursor(undefined)}
                >
                  First page
                </Button>
                <Button
                  variant="outline"
                  disabled={!queue.data?.meta.nextCursor || queue.isFetching}
                  onClick={() =>
                    setCursor(queue.data?.meta.nextCursor ?? undefined)
                  }
                >
                  Next page
                </Button>
              </div>
            </section>
            <section className="min-w-0 rounded-xl border p-4 space-y-4">
              <h2 className="font-semibold">
                Authoritative preflight and action
              </h2>
              {!orderId ? (
                <WorkspaceState
                  kind="empty"
                  title="Select scoped work"
                  description="No manual identifiers. Select an order or pending offer from discovery."
                />
              ) : preflight.isFetching ? (
                <WorkspaceState
                  kind="loading"
                  title="Reloading the current obligation and custody"
                />
              ) : preflight.error ? (
                <WorkspaceState
                  kind="denied"
                  title="Preflight denied"
                  description={cashError(preflight.error)}
                />
              ) : (
                <>
                  {rows.length > 1 && (
                    <Field label="Exact pending offer">
                      <select
                        className={control}
                        value={offerId}
                        onChange={(e) => setOfferId(e.target.value)}
                      >
                        <option value="">Select an offer</option>
                        {rows.map((r) => (
                          <option
                            key={r.offerId ?? "none"}
                            value={r.offerId ?? ""}
                          >
                            {r.recipientName ?? "Unresolved recipient"} ·{" "}
                            {r.recipientWarehouseName ?? "Driver"} · {r.offerId}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                  {work && (
                    <>
                      <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-2">
                        {[
                          ["Order", work.orderNumber],
                          [
                            "Service-charge amount",
                            `${work.amount ?? "Unproved"} ${work.currency ?? ""}`,
                          ],
                          [
                            "Collection timing",
                            `${work.collectionParty}: before ${work.collectionParty === "SENDER" ? "picked_up" : "delivered"}`,
                          ],
                          [
                            "Current holder",
                            work.state === "settled"
                              ? "Settled"
                              : `${work.holderName ?? "Not collected"}${work.holderWarehouseName ? " at " + work.holderWarehouseName : ""}`,
                          ],
                          [
                            "Pending transfer",
                            work.offerId
                              ? `${work.recipientName ?? "Unresolved recipient"} ${work.recipientWarehouseName ?? ""} — awaiting acceptance`
                              : "None",
                          ],
                          [
                            "Current state",
                            `${work.state} / ${work.orderStatus}`,
                          ],
                        ].map(([k, v]) => (
                          <div key={k} className="min-w-0">
                            <dt className="text-muted-foreground">{k}</dt>
                            <dd className="font-medium break-words [overflow-wrap:anywhere]">
                              {v}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <ExactDetails
                        value={{
                          obligationId: work.obligationId,
                          expectedEventId: work.expectedEventId,
                          offerId: work.offerId,
                          holderMembershipId: work.holderMembershipId,
                          holderWarehouseId: work.holderWarehouseId,
                        }}
                        title="Exact authoritative source identities"
                      />
                      <Field label="Optional audit note (up to 500 characters)">
                        <textarea
                          className={control}
                          maxLength={500}
                          value={note}
                          disabled={blocked}
                          onChange={(e) => setNote(e.target.value)}
                        />
                      </Field>
                      {(myHeld ||
                        (!work.expectedEventId &&
                          cap.profileRevision === "warehouse-cash.v1")) &&
                        !work.holderWarehouseId && (
                          <Field label="Explicit approved warehouse">
                            <select
                              className={control}
                              disabled={blocked}
                              value={warehouseId}
                              onChange={(e) => {
                                setWarehouseId(e.target.value);
                                setRecipientId("");
                                setRecipientCursor(undefined);
                              }}
                            >
                              <option value="">Select named warehouse</option>
                              {cap.warehouses.map((w) => (
                                <option key={w.id} value={w.id}>
                                  {w.name} · {w.id}
                                </option>
                              ))}
                            </select>
                          </Field>
                        )}
                      {myHeld && cap.permissions.includes("cash.handoff") && (
                        <div className="space-y-3">
                          <Field label="Eligible exact recipient">
                            <select
                              className={control}
                              disabled={blocked || recipients.isFetching}
                              value={recipientId}
                              onChange={(e) => setRecipientId(e.target.value)}
                            >
                              <option value="">
                                Select recipient from current eligibility
                              </option>
                              {recipients.data?.items.map((r) => (
                                <option
                                  key={r.membershipId}
                                  value={r.membershipId}
                                >
                                  {r.name} · {r.profileRevision} ·{" "}
                                  {r.membershipId}
                                </option>
                              ))}
                            </select>
                          </Field>
                          {recipients.error && (
                            <p role="alert" className="text-sm break-words">
                              {cashError(recipients.error)}
                            </p>
                          )}
                          {recipients.isFetching ? (
                            <p role="status">Checking recipients…</p>
                          ) : (
                            recipients.data &&
                            !recipients.data.items.length && (
                              <p className="text-sm">
                                No eligible recipient on this page. The
                                warehouse must have durable order handover
                                evidence; a local driver must have accepted
                                last-mile custody.
                              </p>
                            )
                          )}
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              disabled={blocked || !recipientCursor}
                              onClick={() => {
                                setRecipientCursor(undefined);
                                setRecipientId("");
                              }}
                            >
                              First recipients
                            </Button>
                            <Button
                              variant="outline"
                              disabled={
                                blocked || !recipients.data?.meta.nextCursor
                              }
                              onClick={() => {
                                setRecipientCursor(
                                  recipients.data?.meta.nextCursor ?? undefined,
                                );
                                setRecipientId("");
                              }}
                            >
                              Next recipients
                            </Button>
                          </div>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-3">
                        {actions.includes("collect") && (
                          <Button
                            disabled={blocked}
                            onClick={() => void run("collect")}
                          >
                            {labels.collect}
                          </Button>
                        )}
                        {actions.includes("offer") && (
                          <Button
                            disabled={
                              blocked ||
                              !selectedRecipient ||
                              recipients.isFetching
                            }
                            onClick={() => void run("offer")}
                          >
                            {labels.offer}
                          </Button>
                        )}
                        {actions.includes("accept") && (
                          <Button
                            disabled={blocked}
                            onClick={() => void run("accept")}
                          >
                            {labels.accept}
                          </Button>
                        )}
                        {actions.includes("settle") && (
                          <Button
                            disabled={blocked}
                            onClick={() => void run("settle")}
                          >
                            {labels.settle}
                          </Button>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Every action reloads authorization and custody on the
                        server. Visibility is not authority. Independent
                        settlement neither pays invoices nor enables accounting.
                      </p>
                    </>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </PageShell>
  );
}
