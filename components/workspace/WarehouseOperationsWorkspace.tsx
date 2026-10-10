"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authContext, authEpoch, hasPermission } from "@/lib/auth";
import { useWorkspaceSession } from "@/lib/workspace";
import {
  readCustody,
  pendingCustody,
  mutateCustody,
  finishCustody,
  custodyActionLabel,
  type CustodyAction,
  type CustodyIntent,
  type CustodyPage,
  type CustodyPreflight,
  type CustodyOptions,
} from "@/lib/custody-workspace";
import { cashError } from "@/lib/service-cash";
import PageShell from "@/components/layout/PageShell";
import WorkspaceState from "./WorkspaceState";
import { Field, control } from "./PricingWorkflowShared";
import { Button as UiButton } from "@/components/ui/button";
function Button({ className, ...p }: ComponentProps<typeof UiButton>) {
  return (
    <UiButton
      {...p}
      className={`h-auto max-w-full whitespace-normal py-2 ${className ?? ""}`}
    />
  );
}
const panel =
  "min-w-0 max-w-full space-y-4 rounded-xl border bg-background p-4 sm:p-5";
export const phaseLabel = (p: string) =>
  ({
    "pickup-offered": "Incoming pickup handover",
    transport: "Incoming accepted transport",
    warehouse: "Held at warehouse",
    "transport-offered": "Awaiting linehaul acceptance",
    "last-mile-offered": "Awaiting local-driver acceptance",
  })[p] ?? p.replaceAll("-", " ");
export default function WarehouseOperationsWorkspace() {
  const s = useWorkspaceSession();
  if (!s.user || !s.context)
    return (
      <PageShell>
        <WorkspaceState
          kind="denied"
          title="Selected membership required"
          description="Sign in to your authorized company membership."
        />
      </PageShell>
    );
  if (
    !hasPermission(s.user, "shipment.view") ||
    !["intake", "receive", "dispatch", "last-mile-offer"].some((a) =>
      hasPermission(s.user, `shipment.custody.${a}`),
    )
  )
    return (
      <PageShell>
        <WorkspaceState
          kind="denied"
          title="Warehouse access unavailable"
          description="An action permission and explicit owned warehouse scopes are required. Administrator or company access alone is insufficient."
        />
      </PageShell>
    );
  return <Operations key={s.epoch} context={s.context} epoch={s.epoch} />;
}
function Operations({ context, epoch }: { context: string; epoch: string }) {
  const params = useSearchParams(),
    deepLink = params.get("custody") ?? "";
  const [warehouse, setWarehouse] = useState(""),
    [search, setSearch] = useState(""),
    [term, setTerm] = useState(""),
    [cursor, setCursor] = useState<string>(),
    [selected, setSelected] = useState(deepLink),
    [intent, setIntent] = useState<CustodyIntent | null>(null),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setSelected(deepLink);
  }, [deepLink]);
  const { user } = useWorkspaceSession();
  const live = useRef(true),
    cache = useQueryClient(),
    current = () =>
      live.current && authContext() === context && authEpoch() === epoch;
  useEffect(() => {
    live.current = true;
    try {
      setIntent(pendingCustody(context));
      setReady(true);
    } catch (e) {
      setError(cashError(e));
    }
    return () => {
      live.current = false;
    };
  }, [context]);
  const warehouses = useQuery({
    queryKey: ["custody-warehouses", context, epoch],
    queryFn: () =>
      readCustody<{ id: string; name: string }[]>(context, "/api/warehouses"),
    retry: false,
  });
  const work = useQuery({
    queryKey: ["custody-work", context, epoch, warehouse, term, cursor],
    queryFn: () =>
      readCustody<CustodyPage>(context, "/api/orders/custody-work", {
        kind: "warehouse",
        limit: 20,
        cursor,
        warehouseId: warehouse || undefined,
        search: term || undefined,
      }),
    retry: false,
  });
  const preflight = useQuery({
    queryKey: ["custody-preflight", context, epoch, selected],
    queryFn: () =>
      readCustody<CustodyPreflight>(context, `/api/orders/${selected}/custody`),
    enabled: !!selected,
    retry: false,
  });
  async function submit(input: Parameters<typeof mutateCustody>[1]) {
    if (busy || !ready) return;
    setBusy(true);
    setError("");
    try {
      const r = await mutateCustody(context, input);
      if (current()) {
        setIntent(r);
        await cache.invalidateQueries({
          predicate: (q) =>
            q.queryKey[0] === "custody-work" ||
            q.queryKey[0] === "custody-preflight",
        });
      }
    } catch (e) {
      if (current()) {
        setError(cashError(e));
        try {
          setIntent(pendingCustody(context));
        } catch {
          setReady(false);
        }
      }
    } finally {
      if (current()) setBusy(false);
    }
  }
  async function acknowledge() {
    setBusy(true);
    try {
      await finishCustody(context);
      if (current()) setIntent(null);
    } catch (e) {
      if (current()) setError(cashError(e));
    } finally {
      if (current()) setBusy(false);
    }
  }
  function printManifest() {
    if (!current() || !work.data?.items.length) return;
    const popup = window.open("", "_blank", "width=1000,height=750");
    if (!popup) {
      setError("Allow this site's print window and try again.");
      return;
    }
    popup.document.title = "Warehouse work manifest";
    const h = popup.document.createElement("h1");
    h.textContent = "Warehouse work manifest";
    popup.document.body.append(h);
    const note = popup.document.createElement("p");
    note.textContent =
      "Current authorized page only. Not custody acceptance, a complete inventory or money owed. Refresh before acting.";
    popup.document.body.append(note);
    const list = popup.document.createElement("ul");
    for (const row of work.data.items) {
      const item = popup.document.createElement("li");
      item.textContent = `${row.orderNumber} — ${phaseLabel(row.phase)} — ${row.status.replaceAll("_", " ")} — ${new Date(row.expectedUpdatedAt).toLocaleString()}`;
      list.append(item);
    }
    popup.document.body.append(list);
    popup.focus();
    popup.print();
  }
  return (
    <PageShell className="admin-workspace">
      <div className="min-w-0 space-y-6">
        <header className="flex min-w-0 flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Warehouse operations
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              Receive, hold and hand over
            </h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Your explicitly scoped work. Nominations are offers; the exact
              receiving actor must accept.
            </p>
          </div>
          <nav
            aria-label="Related workspaces"
            className="flex max-w-full flex-wrap gap-3 text-sm underline underline-offset-4"
          >
            {hasPermission(user, "cash.custody.read") && (
              <Link href="/dashboard/service-cash">Service Cash</Link>
            )}
            {(hasPermission(user, "finance.invoices.read") ||
              hasPermission(user, "finance.invoices.issue")) && (
              <Link href="/dashboard/manager/invoices">Sales Invoices</Link>
            )}
            <Link href="/dashboard/manager/warehouses">
              Location administration
            </Link>
            {hasPermission(user, "drivers.read") && (
              <Link href="/dashboard/manager/drivers/roster">
                Driver route manifests
              </Link>
            )}
            {(hasPermission(user, "membership.invite") ||
              hasPermission(user, "membership.delegateOperational")) && (
              <Link href="/dashboard/manager/users">Operational staff</Link>
            )}
          </nav>
        </header>
        <aside className="rounded-lg border p-4 text-sm">
          Parcel intake and reassignment never transfer cash. Service Cash owns
          collection, offers, acceptance and settlement. Creating a location
          grants neither warehouse access nor a staff delegation ceiling.
        </aside>
        {error && (
          <p
            role="alert"
            className="break-words rounded-lg border border-destructive p-3 text-sm"
          >
            {error}
          </p>
        )}
        {intent && (
          <section className={panel} aria-label="Original custody request">
            <h2 className="font-semibold">
              {intent.state === "confirmed"
                ? "Confirmed historical receipt"
                : "Unconfirmed request — original content retained"}
            </h2>
            <p className="break-words">
              {custodyActionLabel(intent.payload.action)} ·{" "}
              {intent.display.orderNumber} · {intent.display.target}
            </p>
            <p className="text-sm text-muted-foreground">
              {intent.result
                ? `${phaseLabel(intent.result.phase)} · ${intent.result.status.replaceAll("_", " ")}. This receipt is not a current-state snapshot.`
                : "Do not start another action or retarget this request. Retry retains the original identity, expected state and complete parcel set."}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={busy || !ready}
                onClick={() => void submit(null)}
              >
                Retry original request
              </Button>
              {intent.state === "confirmed" && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void acknowledge()}
                >
                  Acknowledge confirmation
                </Button>
              )}
            </div>
          </section>
        )}
        <div className="grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className={panel}>
            <h2 className="text-lg font-semibold">Floor and incoming orders</h2>
            <Field label="Warehouse">
              <select
                className={control}
                value={warehouse}
                disabled={warehouses.isPending || !!warehouses.error}
                onChange={(e) => {
                  setWarehouse(e.target.value);
                  setCursor(undefined);
                  setSelected("");
                }}
              >
                <option value="">All my explicitly scoped warehouses</option>
                {warehouses.data?.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
            {warehouses.error && (
              <p role="alert" className="text-sm">
                Named selection unavailable: {cashError(warehouses.error)}
              </p>
            )}
            <form
              className="flex min-w-0 flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                setTerm(search.trim());
                setCursor(undefined);
                setSelected("");
              }}
            >
              <div className="min-w-0 flex-1">
                <Field label="Scan parcel code or exact order number">
                  <input
                    className={control}
                    value={search}
                    maxLength={120}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Scan or enter a business reference"
                  />
                </Field>
              </div>
              <Button type="submit">Find authorized work</Button>
              {term && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setTerm("");
                    setCursor(undefined);
                  }}
                >
                  Clear search
                </Button>
              )}
            </form>
            <p className="text-sm text-muted-foreground">
              Scanning only identifies work. Confirm every parcel per order. No
              bulk custody action.
            </p>
            {work.isPending ? (
              <p role="status">Loading current work…</p>
            ) : work.error ? (
              <WorkspaceState
                kind="denied"
                title="Work unavailable"
                description={cashError(work.error)}
              />
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {work.data?.items.length ?? 0} orders on this page; not a
                  warehouse-wide inventory total.
                </p>
                <ul className="space-y-2">
                  {work.data?.items.map((row) => (
                    <li key={row.orderId}>
                      <button
                        type="button"
                        className={`w-full min-w-0 rounded-lg border p-3 text-left transition-colors motion-reduce:transition-none hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary ${selected === row.orderId ? "border-primary bg-muted" : ""}`}
                        onClick={() => setSelected(row.orderId)}
                      >
                        <span className="block break-words font-medium">
                          {row.orderNumber}
                        </span>
                        <span className="block break-words text-sm">
                          {phaseLabel(row.phase)} ·{" "}
                          {row.status.replaceAll("_", " ")}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {!work.data?.items.length && (
                  <WorkspaceState
                    kind="empty"
                    title="No actionable work"
                    description="No incoming or currently held work matches this selected context and filter. Offers remain held at the warehouse until driver acceptance; they expose no new warehouse action."
                  />
                )}
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCursor(undefined);
                      void work.refetch();
                    }}
                  >
                    Refresh from start
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!work.data?.nextCursor}
                    onClick={() =>
                      setCursor(work.data?.nextCursor ?? undefined)
                    }
                  >
                    Next page
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!work.data?.items.length}
                    onClick={printManifest}
                  >
                    Print this work page
                  </Button>
                </div>
              </>
            )}
          </section>
          <section className={panel}>
            <h2 className="text-lg font-semibold">
              Whole-order custody preflight
            </h2>
            {!selected ? (
              <WorkspaceState
                kind="empty"
                title="Select authorized work"
                description="Load current ownership, expected state and complete parcel set before preparing an action."
              />
            ) : preflight.isPending ? (
              <p role="status">Checking custody…</p>
            ) : preflight.error ? (
              <WorkspaceState
                kind="denied"
                title="Preflight rejected"
                description={cashError(preflight.error)}
              />
            ) : preflight.data ? (
              <CustodyDetail
                key={
                  preflight.data.orderId +
                  preflight.data.updatedAt +
                  preflight.data.custody?.id
                }
                context={context}
                epoch={epoch}
                data={preflight.data}
                disabled={busy || !ready || !!intent}
                submit={submit}
              />
            ) : null}
            <Button
              variant="outline"
              disabled={!selected || preflight.isFetching}
              onClick={() => void preflight.refetch()}
            >
              Refresh preflight
            </Button>
          </section>
        </div>
        <section className={panel}>
          <h2 className="font-semibold">Unavailable and separate operations</h2>
          <p className="text-sm text-muted-foreground">
            Customer self-pickup delivery, exception/return overrides and
            generic bulk status changes have no approved warehouse custody
            contract here. Full driver-route manifests retain their separately
            authorized dispatch entrypoint; this workspace prints scoped loaded
            work. Label/proof and transport planning retain existing separately
            authorized entrypoints. Customer self-service remains a separate
            portal.
          </p>
        </section>
      </div>
    </PageShell>
  );
}
function CustodyDetail({
  context,
  epoch,
  data,
  disabled,
  submit,
}: {
  context: string;
  epoch: string;
  data: CustodyPreflight;
  disabled: boolean;
  submit: (input: Parameters<typeof mutateCustody>[1]) => Promise<void>;
}) {
  const [action, setAction] = useState<CustodyAction | "">(""),
    [checked, setChecked] = useState<string[]>([]),
    [driver, setDriver] = useState(""),
    [leg, setLeg] = useState(""),
    [reason, setReason] = useState(""),
    [driverCursor, setDriverCursor] = useState<string>(),
    [legCursor, setLegCursor] = useState<string>();
  const needsDriver = action === "dispatch" || action === "last-mile-offer";
  const drivers = useQuery({
    queryKey: [
      "custody-options",
      context,
      epoch,
      data.orderId,
      data.updatedAt,
      action,
      "drivers",
      driverCursor,
    ],
    queryFn: () =>
      readCustody<CustodyOptions>(
        context,
        `/api/orders/${data.orderId}/custody-options`,
        { action, kind: "drivers", limit: 20, cursor: driverCursor },
      ),
    enabled: needsDriver,
    retry: false,
  });
  const legs = useQuery({
    queryKey: [
      "custody-options",
      context,
      epoch,
      data.orderId,
      data.updatedAt,
      action,
      "legs",
      legCursor,
    ],
    queryFn: () =>
      readCustody<CustodyOptions>(
        context,
        `/api/orders/${data.orderId}/custody-options`,
        { action, kind: "legs", limit: 20, cursor: legCursor },
      ),
    enabled: action === "dispatch",
    retry: false,
  });
  const warehouseId =
      action === "intake" || action === "receive"
        ? data.custody?.destinationWarehouseId
        : data.custody?.warehouseId,
    warehouseName = data.warehouses.find((w) => w.id === warehouseId)?.name,
    pickedDriver = drivers.data?.items.find((d) => d.id === driver),
    pickedLeg = legs.data?.items.find((l) => l.id === leg);
  const valid =
    !!action &&
    !!warehouseId &&
    checked.length === data.parcelIds.length &&
    data.parcelIds.length > 0 &&
    (!needsDriver || !!pickedDriver) &&
    (action !== "dispatch" || !!pickedLeg) &&
    (!reason || (reason.trim().length >= 10 && reason.trim().length <= 500));
  return (
    <div className="min-w-0 space-y-4">
      <h3 className="break-words text-lg font-semibold">{data.orderNumber}</h3>
      <p className="break-words">
        {phaseLabel(data.custody?.phase ?? "No custody journal")} ·{" "}
        {data.status.replaceAll("_", " ")}
      </p>
      <p className="text-sm text-muted-foreground">
        Expected-state snapshot:{" "}
        <time dateTime={data.updatedAt}>
          {new Date(data.updatedAt).toLocaleString()}
        </time>
        . Every mutation revalidates; reading does not reserve custody.
      </p>
      <fieldset className="min-w-0 space-y-3 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">
          Confirm the complete physical parcel set
        </legend>
        {data.parcels.map((p) => (
          <label key={p.id} className="flex min-w-0 items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={checked.includes(p.id)}
              disabled={disabled}
              onChange={(e) =>
                setChecked((v) =>
                  e.target.checked ? [...v, p.id] : v.filter((x) => x !== p.id),
                )
              }
            />
            <span className="min-w-0 break-all">
              {p.parcelCode}
              <span className="block text-muted-foreground">
                Piece {p.pieceNo} of {p.pieceTotal}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <Field label="Authorized action">
        <select
          className={control}
          value={action}
          disabled={disabled}
          onChange={(e) => {
            setAction(e.target.value as CustodyAction | "");
            setDriver("");
            setLeg("");
            setReason("");
            setDriverCursor(undefined);
            setLegCursor(undefined);
          }}
        >
          <option value="">Select an action</option>
          {data.actions.map((a) => (
            <option key={a} value={a}>
              {custodyActionLabel(a)}
            </option>
          ))}
        </select>
      </Field>
      {!data.actions.length && (
        <p className="text-sm">
          No warehouse action is currently authorized. Do not substitute a
          generic status update.
        </p>
      )}
      {action && (
        <p className="break-words text-sm">
          Warehouse: {warehouseName ?? "Name unavailable"}
        </p>
      )}
      {needsDriver && (
        <>
          <Field
            label={
              action === "dispatch"
                ? "Nominated linehaul driver"
                : "Nominated local driver"
            }
          >
            <select
              className={control}
              value={driver}
              disabled={disabled || drivers.isPending || !!drivers.error}
              onChange={(e) => setDriver(e.target.value)}
            >
              <option value="">Select currently eligible membership</option>
              {drivers.data?.items.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          {drivers.error && (
            <p role="alert" className="text-sm">
              {cashError(drivers.error)}
            </p>
          )}
          <Button
            variant="outline"
            disabled={!drivers.data?.nextCursor || disabled}
            onClick={() => {
              setDriver("");
              setDriverCursor(drivers.data?.nextCursor ?? undefined);
            }}
          >
            Next driver page
          </Button>
          <p className="text-sm text-muted-foreground">
            The exact nominated membership must accept. An offer moves neither
            parcels nor cash.
          </p>
        </>
      )}
      {action === "dispatch" && (
        <>
          <Field label="Planned internal leg and destination">
            <select
              className={control}
              value={leg}
              disabled={disabled || legs.isPending || !!legs.error}
              onChange={(e) => setLeg(e.target.value)}
            >
              <option value="">Select authoritative planned leg</option>
              {legs.data?.items.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
          {legs.error && (
            <p role="alert" className="text-sm">
              {cashError(legs.error)}
            </p>
          )}
          <Button
            variant="outline"
            disabled={!legs.data?.nextCursor || disabled}
            onClick={() => {
              setLeg("");
              setLegCursor(legs.data?.nextCursor ?? undefined);
            }}
          >
            Next planned-leg page
          </Button>
          <p className="text-sm">
            A missing planned leg requires authorized transport planning. This
            screen cannot invent a destination or provider booking.
          </p>
        </>
      )}
      {(action === "intake" || action === "receive") && (
        <Field label="Reason if outgoing driver is suspended or revoked (10–500 characters)">
          <textarea
            className={control}
            maxLength={500}
            value={reason}
            disabled={disabled}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Required by server for reasoned receiving recovery"
          />
        </Field>
      )}
      <Button
        disabled={disabled || !valid}
        onClick={() => {
          if (!valid || !action || !warehouseId) return;
          void submit({
            payload: {
              orderId: data.orderId,
              action,
              expectedEventId: data.custody?.id ?? null,
              expectedUpdatedAt: data.updatedAt,
              parcelIds: [...data.parcelIds].sort(),
              warehouseId,
              ...(needsDriver ? { driverMembershipId: driver } : {}),
              ...(action === "dispatch"
                ? {
                    legId: leg,
                    destinationWarehouseId: pickedLeg!.destinationWarehouseId,
                  }
                : {}),
              ...(reason.trim() ? { outgoingDriverReason: reason.trim() } : {}),
            },
            display: {
              orderNumber: data.orderNumber,
              target:
                [warehouseName, pickedDriver?.name, pickedLeg?.name]
                  .filter(Boolean)
                  .join(" · ") || "Authorized warehouse",
            },
          });
        }}
      >
        {action ? custodyActionLabel(action) : "Choose an action"}
      </Button>
    </div>
  );
}
