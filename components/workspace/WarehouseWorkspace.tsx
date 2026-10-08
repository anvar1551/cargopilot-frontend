"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authContext, authEpoch, hasPermission, getUser } from "@/lib/auth";
import { useWorkspaceSession } from "@/lib/workspace";
import {
  finishWarehouse,
  pendingWarehouse,
  readWarehouseWorkspace,
  warehouseError,
  warehouseFields,
  writeWarehouse,
  type WarehouseFields,
  type WarehouseIntent,
  type WarehouseRow,
} from "@/lib/warehouse-workspace";
import PageShell from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
const empty: WarehouseFields = {
  name: "",
  location: "",
  type: "warehouse",
  region: null,
  latitude: null,
  longitude: null,
};
export default function WarehouseWorkspace() {
  const s = useWorkspaceSession();
  return (
    <PageShell className="admin-workspace">
      <div className="space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Operational locations
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Warehouses
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tenant-owned warehouses and pickup points. Creation and staff access
            are separately authorized.
          </p>
          <Link
            className="mt-3 inline-block text-sm underline"
            href="/dashboard/manager/users"
          >
            Manage approved staff access
          </Link>
        </header>
        {s.context ? (
          <Selected key={s.epoch} context={s.context} />
        ) : (
          <p role="status">
            Sign in and select an authorized company membership.
          </p>
        )}
      </div>
    </PageShell>
  );
}
function Selected({ context }: { context: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState(""),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<string>();
  const canRead = hasPermission(getUser(), "shipment.view"),
    canEdit = hasPermission(getUser(), "shipment.update"),
    canCreate = hasPermission(getUser(), "warehouse.create");
  const authority = useQuery({
    queryKey: ["warehouse-authority", context],
    queryFn: () => readWarehouseWorkspace(context, "authority"),
    enabled: canCreate,
    retry: false,
  });
  const list = useQuery({
    queryKey: ["warehouse-workspace", context, filter, page],
    queryFn: () =>
      readWarehouseWorkspace(context, "list", { search: filter, page }),
    enabled: canRead,
    retry: false,
  });
  const detail = useQuery({
    queryKey: ["warehouse-detail", context, selected],
    queryFn: () => readWarehouseWorkspace(context, "detail", { id: selected! }),
    enabled: canRead && !!selected,
    retry: false,
  });
  const reload = () => {
    void qc.invalidateQueries({ queryKey: ["warehouse-workspace", context] });
    void qc.invalidateQueries({ queryKey: ["warehouse-detail", context] });
  };
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="font-semibold">Controlled provisioning</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The creating company is audit context, not exclusive ownership.
          Creation grants no warehouse scope or delegation ceiling.
        </p>
        <p
          className="mt-3 text-sm"
          role={authority.isError ? "alert" : "status"}
        >
          {!canCreate
            ? "Creation permission unavailable; no administrator upgrade is implied."
            : authority.isPending
              ? "Checking accepted authority…"
              : authority.isError
                ? warehouseError(authority.error)
                : `Accepted ${authority.data?.profileRevision}. Every submission revalidates it.`}
        </p>
        <Button
          variant="outline"
          className="mt-3"
          disabled={!canCreate || authority.isFetching}
          onClick={() => void authority.refetch()}
        >
          Refresh provisioning authority
        </Button>
      </section>
      <WarehouseForm
        context={context}
        kind="create"
        enabled={canCreate && authority.isSuccess}
        onConfirmed={reload}
      />
      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Authorized locations</h2>
        <form
          className="my-4 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setFilter(search.trim());
            setPage(1);
            setSelected(undefined);
          }}
        >
          <Label className="sr-only" htmlFor="warehouse-search">
            Search warehouse names
          </Label>
          <Input
            id="warehouse-search"
            className="max-w-sm"
            maxLength={120}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search warehouse names"
          />
          <Button variant="outline" disabled={!canRead}>
            Search
          </Button>
        </form>
        {!canRead ? (
          <p role="status">
            Listing requires shipment.view and explicit warehouse scopes.
            Creation does not confer access.
          </p>
        ) : list.isPending ? (
          <p role="status">Loading scoped locations…</p>
        ) : list.isError ? (
          <p role="alert">{warehouseError(list.error)}</p>
        ) : !list.data?.length ? (
          <p role="status">
            No accessible locations on this page. Review search or approved
            scopes.
          </p>
        ) : (
          <ul className="space-y-3">
            {list.data.map((w) => (
              <li
                key={w.id}
                className="flex flex-col justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <h3 className="font-medium break-words">{w.name}</h3>
                  <p className="text-sm text-muted-foreground break-words">
                    {w.type === "pickup_point" ? "Pickup point" : "Warehouse"} ·{" "}
                    {w.location}
                    {w.region ? ` · ${w.region}` : ""}
                  </p>
                </div>
                <Button variant="outline" onClick={() => setSelected(w.id)}>
                  View details
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            disabled={page === 1 || list.isFetching || !canRead}
            onClick={() => {
              setPage((p) => p - 1);
              setSelected(undefined);
            }}
          >
            Previous
          </Button>
          <span className="text-sm">Page {page}</span>
          <Button
            variant="outline"
            disabled={
              page >= 10000 ||
              list.isFetching ||
              list.data?.length !== 20 ||
              !canRead
            }
            onClick={() => {
              setPage((p) => p + 1);
              setSelected(undefined);
            }}
          >
            Next
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          20 per page; no total-count contract. Search and pagination are server
          scoped.
        </p>
      </section>
      {selected && (
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Location detail</h2>
          {detail.isPending ? (
            <p role="status">Checking location access…</p>
          ) : detail.isError ? (
            <p role="alert">{warehouseError(detail.error)}</p>
          ) : (
            detail.data && (
              <>
                <dl className="my-4 admin-columns gap-3 text-sm">
                  {Object.entries({
                    Name: detail.data.name,
                    Type: detail.data.type,
                    Location: detail.data.location,
                    Region: detail.data.region ?? "Not set",
                    Latitude: detail.data.latitude ?? "Not set",
                    Longitude: detail.data.longitude ?? "Not set",
                    "Created at": new Date(
                      detail.data.createdAt,
                    ).toLocaleString(),
                  }).map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="break-words font-medium">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-sm text-muted-foreground">
                  Global staff assignments unavailable. Order summaries are
                  separately tenant/company/object scoped, capped at 100, not a
                  total.
                </p>
                <ul className="my-3 space-y-2">
                  {detail.data.orders.map((o) => (
                    <li key={o.id} className="rounded-lg border p-3 text-sm">
                      #{o.orderNumber} · {o.status} ·{" "}
                      {o.serviceType ?? "Unspecified"} · Updated{" "}
                      {new Date(o.updatedAt).toLocaleString()}
                    </li>
                  ))}
                </ul>
                {!detail.data.orders.length && (
                  <p className="my-3 text-sm">No visible operational orders.</p>
                )}
                <WarehouseForm
                  key={selected}
                  context={context}
                  kind="edit"
                  target={detail.data}
                  enabled={canEdit}
                  onConfirmed={reload}
                />
              </>
            )
          )}
        </section>
      )}
      <p className="text-xs text-muted-foreground">
        No delete, assignment or general configuration actions. Staff management
        requires a separately accepted operational ceiling; creation never
        extends it.
      </p>
    </div>
  );
}
function WarehouseForm({
  context,
  kind,
  target,
  enabled,
  onConfirmed,
}: {
  context: string;
  kind: "create" | "edit";
  target?: WarehouseRow;
  enabled: boolean;
  onConfirmed(): void;
}) {
  const [fields, setFields] = useState<WarehouseFields>(
      target
        ? warehouseFields.parse({
            name: target.name,
            type: target.type,
            location: target.location,
            region: target.region,
            latitude: target.latitude,
            longitude: target.longitude,
          })
        : empty,
    ),
    [intent, setIntent] = useState<WarehouseIntent | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const running = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    try {
      const old = pendingWarehouse(context, kind);
      setIntent(old);
      if (old && (kind === "create" || old.id === target?.id))
        setFields(old.payload);
    } catch {
      setError("Stored intent unreadable; sending is blocked.");
    }
    return () => {
      mounted.current = false;
    };
  }, [context, kind, target?.id]);
  const submit = async (retry = false) => {
    if (running.current || !enabled) return;
    running.current = true;
    setBusy(true);
    setError("");
    const epoch = authEpoch();
    try {
      const r = await writeWarehouse(
        context,
        kind,
        retry ? null : fields,
        target?.id,
      );
      if (
        mounted.current &&
        epoch === authEpoch() &&
        context === authContext()
      ) {
        setIntent(r);
        onConfirmed();
      }
    } catch (e) {
      if (
        mounted.current &&
        epoch === authEpoch() &&
        context === authContext()
      ) {
        setError(warehouseError(e));
        try {
          setIntent(pendingWarehouse(context, kind));
        } catch {
          setError("Storage unreadable; preserve it for review.");
        }
      }
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const finish = async () => {
    try {
      await finishWarehouse(context, kind);
      if (!mounted.current || context !== authContext()) return;
      setIntent(null);
      setError("");
      if (kind === "create") setFields(empty);
    } catch {
      setError("Unconfirmed intent cannot be replaced.");
    }
  };
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold">
        {kind === "create"
          ? "Create an operational location"
          : "Edit supported location fields"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {kind === "create"
          ? "Intent is verified in storage before sending. Matching retries retain ID/content and return the original creation snapshot."
          : "Edits have no server retry receipt or version fence. Uncertain edits stay blocked across reload; inspect authoritative detail and obtain review. No automatic replay."}
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
            !enabled || busy || !!intent || error.includes("unreadable")
          }
          className="admin-columns gap-4"
        >
          {(["name", "location", "region"] as const).map((k) => (
            <div key={k} className={k === "location" ? "admin-span-all" : ""}>
              <Label htmlFor={`${kind}-${k}`}>
                {k === "name"
                  ? "Name"
                  : k === "location"
                    ? "Location / address"
                    : "Region (optional)"}
              </Label>
              <Input
                id={`${kind}-${k}`}
                value={fields[k] ?? ""}
                required={k !== "region"}
                maxLength={k === "location" ? 500 : 160}
                onChange={(e) => setFields({ ...fields, [k]: e.target.value })}
              />
            </div>
          ))}
          <div>
            <Label htmlFor={`${kind}-type`}>Node type</Label>
            <select
              id={`${kind}-type`}
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={fields.type}
              onChange={(e) =>
                setFields({
                  ...fields,
                  type: e.target.value as WarehouseFields["type"],
                })
              }
            >
              <option value="warehouse">Warehouse</option>
              <option value="pickup_point">Pickup point</option>
            </select>
          </div>
          <details className="admin-span-all rounded-xl border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Optional geographic coordinates
            </summary>
            <div className="mt-3 admin-columns gap-3">
              {(["latitude", "longitude"] as const).map((k) => (
                <div key={k}>
                  <Label htmlFor={`${kind}-${k}`}>
                    {k === "latitude"
                      ? "Latitude (−90 to 90)"
                      : "Longitude (−180 to 180)"}
                  </Label>
                  <Input
                    id={`${kind}-${k}`}
                    type="number"
                    step="any"
                    min={k === "latitude" ? -90 : -180}
                    max={k === "latitude" ? 90 : 180}
                    value={fields[k] ?? ""}
                    onChange={(e) =>
                      setFields({
                        ...fields,
                        [k]:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </details>
          <Button type="submit" className="admin-span-all sm:justify-self-start">
            {busy
              ? "Awaiting confirmation…"
              : kind === "create"
                ? "Create warehouse"
                : "Save location changes"}
          </Button>
        </fieldset>
      </form>
      {error && (
        <p role="alert" className="mt-3 text-sm">
          {error}
        </p>
      )}
      {!enabled && (
        <p role="status" className="mt-3 text-sm">
          {kind === "create"
            ? "Accepted provisioning authority required."
            : "Editing requires shipment.update and explicit warehouse access."}
        </p>
      )}
      {intent && (
        <div className="mt-4 space-y-3 rounded-xl bg-muted p-4 text-sm">
          <p>
            Local intent: <strong>{intent.state}</strong>
          </p>
          <p className="break-all">Operation ID: {intent.operationId}</p>
          {intent.id && <p className="break-all">Edit target: {intent.id}</p>}
          {intent.result && (
            <p className="break-all">
              Confirmed warehouse: {intent.result.name} · {intent.result.id}
            </p>
          )}
          <p>
            Creation snapshots never overwrite edited detail or grant access.
          </p>
          <div className="flex flex-wrap gap-2">
            {kind === "create" && (
              <Button
                variant="outline"
                disabled={!enabled || busy}
                onClick={() => void submit(true)}
              >
                Verify/retry original creation
              </Button>
            )}
            {(intent.state === "confirmed" ||
              (kind === "edit" && intent.state === "rejected")) && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void finish()}
              >
                Finish confirmed / rejected action
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
