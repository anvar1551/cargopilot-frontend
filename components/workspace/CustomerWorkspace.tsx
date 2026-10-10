"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  Check,
  MapPin,
  Plus,
  Search,
  UserRound,
} from "lucide-react";
import { authContext, authEpoch, hasPermission } from "@/lib/auth";
import { useWorkspaceSession, workspaceError } from "@/lib/workspace";
import {
  addressInput,
  customerInput,
  dismissCustomerIntent,
  listWorkspaceAddresses,
  listWorkspaceCustomers,
  pendingCustomerIntent,
  readWorkspaceCustomer,
  writeCustomerWorkspace,
  type WorkspaceAddress,
  type WorkspaceCustomer,
} from "@/lib/customer-workspace";
import type { MasterIntent } from "@/lib/master-write";
import { formatAddress } from "@/lib/addresses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PageShell from "@/components/layout/PageShell";
import WorkspaceState from "./WorkspaceState";
import OrderSubmissionDialog from "./OrderSubmissionDialog";

// Owned master data is tenant-level; selected company still gates every backend operation.
export default function CustomerWorkspace({
  customerId,
}: {
  customerId?: string;
}) {
  const session = useWorkspaceSession();
  if (!session.context || !session.user)
    return (
      <PageShell>
        <WorkspaceState
          kind="denied"
          title="Select an authorized membership"
          description="Sign in to the company you intend to work in."
        />
      </PageShell>
    );
  if (!hasPermission(session.user, "customers.read"))
    return (
      <PageShell>
        <WorkspaceState
          kind="denied"
          title="Customer access required"
          description="Your selected membership has no customer read permission."
        />
      </PageShell>
    );
  return (
    <Workspace
      key={session.epoch}
      context={session.context}
      customerId={customerId}
      canWrite={hasPermission(session.user, "customers.write")}
    />
  );
}
function Workspace({
  context,
  customerId,
  canWrite,
}: {
  context: string;
  customerId?: string;
  canWrite: boolean;
}) {
  const cache = useQueryClient(),
    router = useRouter();
  const [pending, setPending] = useState<MasterIntent | null>(null),
    [localError, setLocalError] = useState("");
  const [dialog, setDialog] = useState<{
    kind: "customer" | "address" | "delete";
    customer?: WorkspaceCustomer;
    address?: WorkspaceAddress;
    path?: string;
    label?: string;
  } | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  function showDialog(next: NonNullable<typeof dialog>) {
    opener.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setDialog(next);
  }
  function reloadIntent() {
    try {
      setPending(pendingCustomerIntent(context));
      setLocalError("");
    } catch {
      setLocalError(
        "Local recovery storage is unavailable. Changes are disabled until storage is restored.",
      );
    }
  }
  useEffect(() => {
    const sync = () => {
      try {
        setPending(pendingCustomerIntent(context));
        setLocalError("");
      } catch {
        setLocalError(
          "Local recovery storage is unavailable. Changes are disabled until storage is restored.",
        );
      }
    };
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [context]);
  async function save(
    path: string,
    method: MasterIntent["method"],
    body: unknown,
  ) {
    const epoch = authEpoch();
    const current = () => authEpoch() === epoch && authContext() === context;
    try {
      const result = await writeCustomerWorkspace(context, {
        path,
        method,
        body,
      });
      if (!current()) throw Error("Session changed; result suppressed");
      try {
        dismissCustomerIntent(context);
      } catch {
        /* Confirmed record remains visible; never send again. */
      }
      reloadIntent();
      setDialog(null);
      await cache.invalidateQueries({
        queryKey: ["customer-workspace", context],
      });
      if (!current()) throw Error("Session changed; result suppressed");
      if (method === "POST" && path === "/api/customers")
        router.push(`/dashboard/manager/customers/${result.id}`);
      if (method === "DELETE" && path === `/api/customers/${customerId}`)
        router.push("/dashboard/manager/customers");
    } finally {
      if (current()) reloadIntent();
    }
  }
  const blocked = Boolean(pending || localError),
    writeEnabled = canWrite && !blocked;
  return (
    <PageShell className="workspace-enter">
      <div className="mx-auto max-w-[1440px] space-y-6">
        {pending && (
          <section
            role="status"
            className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
          >
            <p className="font-semibold">
              {pending.state === "confirmed"
                ? "Change confirmed"
                : pending.state === "rejected"
                  ? "Change rejected"
                  : "Unresolved change — do not repeat"}
            </p>
            <p className="mt-1">
              {pending.state === "confirmed"
                ? "The server confirmed this record. Review it before continuing."
                : pending.state === "rejected"
                  ? "The server rejected the request. Review the fields or your access before a new action."
                  : "A previous result was not durably confirmed. Refresh and check the affected record; this action will not be replayed."}
            </p>
            <p className="mt-1 text-xs">
              Local reference {pending.id} · {pending.method} {pending.path}
            </p>
            {["confirmed", "rejected"].includes(pending.state) && (
              <Button
                className="mt-3"
                variant="outline"
                onClick={() => {
                  try {
                    dismissCustomerIntent(context);
                    reloadIntent();
                  } catch {
                    setLocalError("Recovery storage is unavailable.");
                  }
                }}
              >
                Acknowledge and continue
              </Button>
            )}
          </section>
        )}
        {localError && (
          <p
            role="alert"
            className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm"
          >
            {localError}
          </p>
        )}
        {customerId ? (
          <CustomerRecord
            context={context}
            id={customerId}
            canWrite={writeEnabled}
            editCustomer={(c) => showDialog({ kind: "customer", customer: c })}
            editAddress={(a) => showDialog({ kind: "address", address: a })}
            addAddress={() => showDialog({ kind: "address" })}
            remove={(path, label) =>
              showDialog({ kind: "delete", path, label })
            }
            save={save}
          />
        ) : (
          <CustomerDirectory
            context={context}
            canWrite={writeEnabled}
            add={() => showDialog({ kind: "customer" })}
          />
        )}
        {dialog && (
          <MasterForm
            dialog={dialog}
            customerId={customerId}
            blocked={blocked}
            save={save}
            close={() => setDialog(null)}
            restoreFocus={() => {
              if (authContext() === context && opener.current?.isConnected)
                opener.current.focus();
            }}
          />
        )}
      </div>
    </PageShell>
  );
}
function CustomerDirectory({
  context,
  canWrite,
  add,
}: {
  context: string;
  canWrite: boolean;
  add: () => void;
}) {
  const [search, setSearch] = useState(""),
    [q, setQ] = useState(""),
    [type, setType] = useState<"" | "PERSON" | "COMPANY">(""),
    [page, setPage] = useState(1);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useQuery({
    queryKey: ["customer-workspace", context, "list", q, type, page],
    queryFn: ({ signal }) =>
      listWorkspaceCustomers(
        context,
        { q, type: type || undefined, page },
        signal,
      ),
    retry: false,
  });
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">
            Customer operations
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Customers
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Profiles and structured addresses for your authorized customer
            records.
          </p>
        </div>
        {canWrite && (
          <Button className="h-10" onClick={add}>
            <Plus aria-hidden="true" />
            New customer
          </Button>
        )}
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        <Summary
          label="Matching records"
          value={query.data?.total?.toLocaleString() ?? "—"}
        />
        <Summary label="Access boundary" value="Tenant-owned masters" />
        <Summary label="Workspace" value="Selected membership" />
      </div>
      <section
        className="workspace-surface overflow-hidden"
        aria-label="Customer directory"
      >
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative min-w-48 flex-1">
            <Search
              aria-hidden="true"
              className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"
            />
            <Input
              aria-label="Search customers"
              maxLength={200}
              className="h-10 pl-9"
              placeholder="Search name, email or tax ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Customer type"
            className="h-10 rounded-md border bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary"
            value={type}
            onChange={(e) => {
              setType(e.target.value as typeof type);
              setPage(1);
            }}
          >
            <option value="">All customer types</option>
            <option value="PERSON">Individuals</option>
            <option value="COMPANY">Companies</option>
          </select>
          <Button
            variant="outline"
            className="h-10"
            onClick={() => void query.refetch()}
          >
            Refresh
          </Button>
        </div>
        {query.isPending ? (
          <WorkspaceState kind="loading" title="Loading customer records" />
        ) : query.isError ? (
          <WorkspaceState
            kind="error"
            title="Customers could not be loaded"
            description={workspaceError(query.error)}
            onRetry={() => void query.refetch()}
          />
        ) : !query.data.data.length ? (
          <WorkspaceState
            kind="empty"
            title={q ? "No matching customers" : "No customer records yet"}
            description={
              q
                ? "Try a different name or clear the filters."
                : "Create an authorized customer profile to start its address book."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <caption className="sr-only">Authorized customer records</caption>
              <thead className="bg-slate-50 text-xs text-muted-foreground">
                <tr>
                  {["Customer", "Contact", "Addresses", "Orders", ""].map(
                    (h, i) => (
                      <th key={i} scope="col" className="px-5 py-3 font-medium">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {query.data.data.map((c) => (
                  <tr key={c.id} className="border-t hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <Link
                        className="flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-primary"
                        href={`/dashboard/manager/customers/${c.id}`}
                      >
                        <span className="rounded-lg bg-blue-50 p-2 text-primary">
                          {c.type === "COMPANY" ? (
                            <Building2 className="h-4 w-4" />
                          ) : (
                            <UserRound className="h-4 w-4" />
                          )}
                        </span>
                        <span>
                          <span className="font-semibold text-foreground">
                            {c.companyName || c.name}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {c.type === "COMPANY" ? c.name : "Individual"}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <p>{c.email || "No email"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {c.phone || "No phone"}
                      </p>
                    </td>
                    <td className="px-5 py-4 tabular-nums">
                      {c._count?.addresses ?? "—"}
                    </td>
                    <td className="px-5 py-4 tabular-nums">
                      {c._count?.orders ?? "—"}
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        aria-label={`Open ${c.companyName || c.name}`}
                        href={`/dashboard/manager/customers/${c.id}`}
                        className="inline-flex rounded-md p-2 text-primary focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 text-xs text-muted-foreground">
          <span role="status">
            {query.isFetching
              ? "Updating records…"
              : `Page ${page} · 20 records per page`}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || query.isFetching}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={
                !query.data || page >= query.data.pageCount || query.isFetching
              }
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </footer>
      </section>
    </>
  );
}
function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="workspace-surface px-5 py-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-base font-semibold">{value}</p>
    </div>
  );
}
function CustomerRecord({
  context,
  id,
  canWrite,
  editCustomer,
  editAddress,
  addAddress,
  remove,
  save,
}: {
  context: string;
  id: string;
  canWrite: boolean;
  editCustomer: (c: WorkspaceCustomer) => void;
  editAddress: (a: WorkspaceAddress) => void;
  addAddress: () => void;
  remove: (path: string, label: string) => void;
  save: (
    path: string,
    method: MasterIntent["method"],
    body: unknown,
  ) => Promise<void>;
}) {
  const [search, setSearch] = useState(""),
    [q, setQ] = useState(""),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const busy = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useQuery({
    queryKey: ["customer-workspace", context, "detail", id],
    queryFn: ({ signal }) => readWorkspaceCustomer(context, id, signal),
    retry: false,
  });
  const addresses = useQuery({
    queryKey: ["customer-workspace", context, "addresses", id, q],
    queryFn: ({ signal }) => listWorkspaceAddresses(context, id, q, signal),
    enabled: !!query.data,
    retry: false,
  });
  async function setDefault(addressId: string | null) {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      await save(`/api/customers/${id}`, "PATCH", {
        defaultAddressId: addressId,
      });
    } catch (e) {
      setError(workspaceError(e));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  return (
    <>
      <Link
        href="/dashboard/manager/customers"
        className="inline-flex items-center gap-2 rounded-md text-sm text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        All customers
      </Link>
      {query.isPending ? (
        <WorkspaceState kind="loading" title="Loading customer profile" />
      ) : query.isError ? (
        <WorkspaceState
          kind="error"
          title="Customer unavailable"
          description={workspaceError(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <>
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-primary">
                {query.data.type === "COMPANY"
                  ? "Company customer"
                  : "Individual customer"}
              </span>
              <h1 className="mt-3 break-words text-3xl font-semibold tracking-tight">
                {query.data.companyName || query.data.name}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Customer profile and address book
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canWrite && (
                <Button
                  variant="outline"
                  className="h-10"
                  onClick={() => editCustomer(query.data)}
                >
                  Edit profile
                </Button>
              )}
              <Button
                variant="outline"
                className="h-10"
                onClick={() => {
                  void query.refetch();
                  void addresses.refetch();
                }}
              >
                Refresh
              </Button>
            </div>
          </header>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(240px,1fr)_minmax(0,2fr)]">
            <section className="workspace-surface p-5">
              <h2 className="font-semibold">Profile</h2>
              <dl className="mt-5 space-y-4">
                {[
                  ["Contact", query.data.name],
                  ["Email", query.data.email],
                  ["Phone", query.data.phone],
                  ["Alternate phone", query.data.altPhone1],
                  ["Alternate phone 2", query.data.altPhone2],
                  ["Tax ID", query.data.taxId],
                  [
                    "Created",
                    new Date(query.data.createdAt).toLocaleDateString(),
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-1 break-words text-sm">
                      {value || "Not provided"}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-6 border-t pt-4 text-xs text-muted-foreground">
                <p>
                  {query.data._count?.orders ?? "—"} scoped orders ·{" "}
                  {query.data._count?.addresses ?? "—"} saved addresses
                </p>
                <p className="mt-2">
                  {query.data._count?.users ?? "—"} linked users
                </p>
                <p className="mt-2">
                  Customer masters belong to the tenant. Your current
                  permissions and object scopes still apply.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <OrderSubmissionDialog customerId={id}/>
                  <OrderSubmissionDialog kind="import" customerId={id} triggerLabel="Import CSV"/>
                </div>
              </div>
              {canWrite && (
                <Button
                  variant="ghost"
                  className="mt-4 text-destructive"
                  onClick={() =>
                    remove(
                      `/api/customers/${id}`,
                      query.data.companyName || query.data.name,
                    )
                  }
                >
                  Delete customer
                </Button>
              )}
            </section>
            <section className="workspace-surface overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
                <h2 className="flex items-center gap-2 font-semibold">
                  <MapPin className="h-4 w-4 text-primary" />
                  Address book
                </h2>
                {canWrite && (
                  <Button size="sm" onClick={addAddress}>
                    <Plus className="h-4 w-4" />
                    Add address
                  </Button>
                )}
              </div>
              <div className="border-b px-5 py-3">
                <Input
                  aria-label="Search addresses"
                  maxLength={200}
                  placeholder="Search this customer's addresses"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Up to 50 matching addresses. Refine the search for larger
                  address books.
                </p>
              </div>
              {addresses.isPending ? (
                <WorkspaceState kind="loading" title="Loading address book" />
              ) : addresses.isError ? (
                <WorkspaceState
                  kind="error"
                  title="Addresses unavailable"
                  description={workspaceError(addresses.error)}
                  onRetry={() => void addresses.refetch()}
                />
              ) : !addresses.data.length ? (
                <WorkspaceState
                  kind="empty"
                  title="No saved addresses"
                  description="Add a structured address for future order and pricing references."
                />
              ) : (
                <ul className="divide-y">
                  {addresses.data.map((a) => (
                    <li key={a.id} className="p-5">
                      <div className="flex flex-wrap justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">
                            {a.city || "Address"}
                            {a.country ? `, ${a.country}` : ""}
                          </p>
                          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                            {formatAddress(a)}
                          </p>
                          {query.data.defaultAddress?.id === a.id && (
                            <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                              <Check className="h-3 w-3" />
                              Default address
                            </span>
                          )}
                        </div>
                        {canWrite && (
                          <div className="flex flex-wrap gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => editAddress(a)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={saving}
                              onClick={() =>
                                void setDefault(
                                  query.data.defaultAddress?.id === a.id
                                    ? null
                                    : a.id,
                                )
                              }
                            >
                              {query.data.defaultAddress?.id === a.id
                                ? "Clear default"
                                : "Set default"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() =>
                                remove(
                                  `/api/addresses/${a.id}`,
                                  formatAddress(a),
                                )
                              }
                            >
                              Delete
                            </Button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}
    </>
  );
}
function MasterForm({
  dialog,
  customerId,
  blocked,
  save,
  close,
  restoreFocus,
}: {
  dialog: {
    kind: "customer" | "address" | "delete";
    customer?: WorkspaceCustomer;
    address?: WorkspaceAddress;
    path?: string;
    label?: string;
  };
  customerId?: string;
  blocked: boolean;
  save: (
    path: string,
    method: MasterIntent["method"],
    body: unknown,
  ) => Promise<void>;
  close: () => void;
  restoreFocus: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [type, setType] = useState(dialog.customer?.type ?? "PERSON");
  const submitting = useRef(false);
  const editing = Boolean(dialog.customer || dialog.address),
    isCustomer = dialog.kind === "customer",
    deleting = dialog.kind === "delete";
  const title = deleting
    ? "Delete record"
    : `${editing ? "Edit" : "New"} ${isCustomer ? "customer" : "address"}`;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || blocked) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      if (deleting) {
        await save(dialog.path!, "DELETE", undefined);
        return;
      }
      const data = new FormData(event.currentTarget),
        text = (key: string) => String(data.get(key) ?? "").trim(),
        optional = (key: string) => text(key) || null;
      if (isCustomer) {
        const parsed = customerInput.safeParse({
          type,
          name: text("name"),
          email: optional("email"),
          phone: optional("phone"),
          companyName: type === "COMPANY" ? optional("companyName") : null,
          taxId: type === "COMPANY" ? optional("taxId") : null,
          altPhone1: optional("altPhone1"),
          altPhone2: optional("altPhone2"),
        });
        if (!parsed.success) {
          setError(
            parsed.error.issues
              .map((i) => `${i.path.join(" ")}: ${i.message}`)
              .join(". "),
          );
          return;
        }
        await save(
          dialog.customer
            ? `/api/customers/${dialog.customer.id}`
            : "/api/customers",
          editing ? "PATCH" : "POST",
          parsed.data,
        );
      } else {
        const parsed = addressInput.safeParse({
          country: text("country"),
          city: text("city"),
          addressLine1: text("addressLine1"),
          addressLine2: optional("addressLine2"),
          postalCode: optional("postalCode"),
          landmark: optional("landmark"),
          addressType: text("addressType"),
        });
        if (!parsed.success) {
          setError(
            "Country, city and address line are required. Check the field lengths.",
          );
          return;
        }
        if (!customerId) throw Error("Missing customer");
        await save(
          dialog.address
            ? `/api/addresses/${dialog.address.id}`
            : "/api/addresses",
          editing ? "PATCH" : "POST",
          editing
            ? parsed.data
            : { ...parsed.data, customerEntityId: customerId, isSaved: true },
        );
      }
    } catch (e) {
      setError(workspaceError(e));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  const fields = isCustomer
    ? ([
        ["name", "Contact name", true],
        ["email", "Email", false],
        ["phone", "Primary phone", false],
        ["altPhone1", "Alternate phone 1", false],
        ["altPhone2", "Alternate phone 2", false],
      ] as const)
    : ([
        ["country", "Country", true],
        ["city", "City", true],
        ["addressLine1", "Address line", true],
        ["addressLine2", "Address line 2", false],
        ["postalCode", "Postal code", false],
        ["landmark", "Landmark", false],
      ] as const);
  const values = (dialog.customer ?? dialog.address ?? {}) as Record<
    string,
    unknown
  >;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
    >
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocus();
        }}
        showCloseButton={!busy}
        className="max-h-[90dvh] overflow-y-auto bg-white sm:max-w-xl"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {deleting
              ? "Deletion is subject to server ownership and operational-reference checks. It cannot be undone here."
              : "Ownership comes from your selected membership. Changes are saved only after server confirmation."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <fieldset disabled={busy || blocked} className="space-y-4">
            {deleting ? (
              <p className="break-words rounded-lg bg-red-50 p-3 text-sm">
                {dialog.label}
              </p>
            ) : (
              <>
                {isCustomer && (
                  <div>
                    <Label htmlFor="master-type">Customer type</Label>
                    <select
                      id="master-type"
                      className="mt-1 h-10 w-full rounded-md border px-3"
                      value={type}
                      onChange={(e) => setType(e.target.value as typeof type)}
                    >
                      <option value="PERSON">Individual</option>
                      <option value="COMPANY">Company</option>
                    </select>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  {fields.map(([key, label, required]) => (
                    <div
                      key={key}
                      className={key === "addressLine1" ? "sm:col-span-2" : ""}
                    >
                      <Label htmlFor={`master-${key}`}>
                        {label}
                        {required ? " *" : ""}
                      </Label>
                      <Input
                        id={`master-${key}`}
                        name={key}
                        required={required}
                        type={
                          key === "email"
                            ? "email"
                            : key.includes("Phone") || key === "phone"
                              ? "tel"
                              : "text"
                        }
                        maxLength={key === "addressLine1" ? 300 : 200}
                        defaultValue={String(values[key] ?? "")}
                        className="mt-1 h-10"
                      />
                    </div>
                  ))}
                </div>
                {isCustomer && type === "COMPANY" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      ["companyName", "Company name"],
                      ["taxId", "Tax ID"],
                    ].map(([key, label]) => (
                      <div key={key}>
                        <Label htmlFor={`master-${key}`}>{label} *</Label>
                        <Input
                          id={`master-${key}`}
                          name={key}
                          required
                          defaultValue={String(values[key] ?? "")}
                          className="mt-1 h-10"
                        />
                      </div>
                    ))}
                  </div>
                )}
                {!isCustomer && (
                  <div>
                    <Label htmlFor="master-addressType">Address type</Label>
                    <select
                      id="master-addressType"
                      name="addressType"
                      defaultValue={
                        dialog.address?.addressType ?? "RESIDENTIAL"
                      }
                      className="mt-1 h-10 w-full rounded-md border px-3"
                    >
                      <option value="RESIDENTIAL">Residential</option>
                      <option value="BUSINESS">Business</option>
                    </select>
                  </div>
                )}
              </>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              >
                {error}
              </p>
            )}
            {blocked && (
              <p role="alert" className="text-sm text-amber-800">
                An unresolved action prevents another write. Close this form and
                review its recovery notice.
              </p>
            )}
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-10"
                variant={deleting ? "destructive" : "default"}
              >
                {busy
                  ? "Saving…"
                  : deleting
                    ? "Confirm deletion"
                    : "Save changes"}
              </Button>
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
