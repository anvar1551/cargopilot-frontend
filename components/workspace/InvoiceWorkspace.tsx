"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { hasPermission, authContext, authEpoch } from "@/lib/auth";
import { useWorkspaceSession } from "@/lib/workspace";
import {
  businessText,
  readInvoiceWorkspace,
  pendingInvoice,
  issueInvoice,
  closeInvoiceReceipt,
  invoiceDownload,
  invoiceError,
  type InvoiceIntent,
} from "@/lib/invoice-workspace";
import PageShell from "@/components/layout/PageShell";
import WorkspaceState from "./WorkspaceState";
import { Button } from "@/components/ui/button";
import { Field, control } from "./PricingWorkflowShared";
type Page<T> = { items: T[]; nextCursor: string | null };
type Invoice = {
  id: string;
  orderId: string;
  invoiceNumber: string;
  orderNumber: string;
  companyName: string;
  payer: { name: string; companyName: string | null } | null;
  issuerName: string | null;
  amount: string;
  currency: string;
  status: string;
  issuedAt: string | null;
  dueAt: string | null;
  hasFile: boolean;
  accounting: string;
};
type Order = { id: string; orderNumber: string; status: string };
type Preparation = {
  order: Order;
  companyName: string | null;
  baseCurrency: string;
  payer: Invoice["payer"];
  price: {
    id: string;
    total: string;
    currency: string;
    components: {
      type: string;
      code: string | null;
      basis: string | null;
      amount: string;
    }[];
  } | null;
  existing: { id: string; invoiceNumber: string } | null;
  eligibleStates: string[];
  reasons: string[];
  eligible: boolean;
  accounting: string;
};
const payerName = (payer: Invoice["payer"]) =>
  payer
    ? businessText([payer.name, payer.companyName].filter(Boolean).join(" · "))
    : "Payer unavailable";
const date = (v: string | null) =>
  v ? new Date(v).toLocaleString() : "Not recorded";
export default function InvoiceWorkspace() {
  const s = useWorkspaceSession();
  return !s.user || !s.context ? (
    <WorkspaceState
      kind="denied"
      title="Selected company required"
      description="Sign in with an accepted invoice membership."
    />
  ) : (
    <Workspace
      key={s.epoch}
      context={s.context}
      can={(p) => hasPermission(s.user!, p)}
    />
  );
}
function Workspace({
  context,
  can,
}: {
  context: string;
  can: (p: string) => boolean;
}) {
  const params = useSearchParams(),
    [mode, setMode] = useState<"invoices" | "orders">(
      can("finance.invoices.read") ? "invoices" : "orders",
    ),
    [search, setSearch] = useState(""),
    [cursors, setCursors] = useState<string[]>([]),
    [selected, setSelected] = useState(""),
    [reason, setReason] = useState(""),
    [intent, setIntent] = useState<InvoiceIntent | null>(null),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const live = useRef(true),
    flight = useRef(false),
    epoch = authEpoch(),
    current = () =>
      live.current && context === authContext() && epoch === authEpoch();
  useEffect(() => {
    live.current = true;
    try {
      setIntent(pendingInvoice(context));
      setReady(true);
    } catch (e) {
      setError(invoiceError(e));
    }
    return () => {
      live.current = false;
    };
  }, [context]);
  const allowed = can(
    mode === "invoices" ? "finance.invoices.read" : "finance.invoices.issue",
  );
  const list = useQuery({
    queryKey: ["invoice-workspace", context, mode, search, cursors.at(-1)],
    enabled: allowed,
    retry: false,
    queryFn: () =>
      readInvoiceWorkspace<Page<Invoice | Order>>(context, {
        view: mode,
        q: search,
        limit: 10,
        cursor: cursors.at(-1),
      }),
  });
  const detail = useQuery({
    queryKey: ["invoice-detail", context, mode, selected],
    enabled: allowed && !!selected,
    retry: false,
    queryFn: () =>
      readInvoiceWorkspace<Invoice | Preparation>(context, {
        view: mode === "invoices" ? "invoice" : "order",
        id: selected,
      }),
  });
  const preparation =
      mode === "orders" ? (detail.data as Preparation | undefined) : undefined,
    invoice =
      mode === "invoices" ? (detail.data as Invoice | undefined) : undefined;
  const refresh = () => {
    if (allowed) void list.refetch();
    if (allowed && selected) void detail.refetch();
  };
  const action = async (retry: boolean) => {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setError("");
    try {
      if (!retry && (!preparation?.eligible || !preparation.price))
        throw Error("Refresh and resolve issuance prerequisites first.");
      const result = await issueInvoice(
        context,
        retry
          ? null
          : {
              payload: {
                orderId: preparation!.order.id,
                priceApprovalId: preparation!.price!.id,
                reason,
              },
              display: {
                orderNumber: preparation!.order.orderNumber,
                payerName: payerName(preparation!.payer),
                amount: preparation!.price!.total,
                currency: preparation!.price!.currency,
              },
            },
      );
      if (current()) {
        setIntent(result);
        refresh();
      }
    } catch (e) {
      if (current()) {
        setError(invoiceError(e));
        try {
          setIntent(pendingInvoice(context));
        } catch {
          setReady(false);
        }
      }
    } finally {
      flight.current = false;
      if (current()) setBusy(false);
    }
  };
  const finish = async () => {
    setBusy(true);
    try {
      await closeInvoiceReceipt(context);
      if (current()) {
        setIntent(null);
        refresh();
      }
    } catch (e) {
      if (current()) setError(invoiceError(e));
    } finally {
      if (current()) setBusy(false);
    }
  };
  const download = async () => {
    setBusy(true);
    setError("");
    try {
      const url = await invoiceDownload(context, invoice!.orderId);
      if (current()) window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      if (current()) setError(invoiceError(e));
    } finally {
      if (current()) setBusy(false);
    }
  };
  // A bookmarked order is resolved through fresh scoped discovery/detail, never treated as authority.
  const canIssue = can("finance.invoices.issue");
  const canRead = can("finance.invoices.read");
  useEffect(() => {
    const order = params.get("order");
    const invoice = params.get("invoice");
    if (invoice && canRead && /^[0-9a-f-]{36}$/i.test(invoice)) {
      setMode("invoices");
      setSelected(invoice);
    } else if (order && canIssue && /^[0-9a-f-]{36}$/i.test(order)) {
      setMode("orders");
      setSelected(order);
    }
  }, [params, canIssue, canRead]);
  return (
    <PageShell className="admin-workspace">
      <div className="min-w-0 space-y-6">
        <header className="flex min-w-0 flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Billing / Sales invoices
            </p>
            <h1 className="text-2xl font-semibold">Manual invoices</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Issue from an accepted exact price and explicit payer. Same
              issuing-entity base currency only. Accounting facts remain held;
              cash settlement never marks an invoice paid.
            </p>
          </div>
          {can("billing.payers.bind") ||
          can("pricing.orders.accept") ||
          can("pricing.orders.approve") ? (
            <Link
              className="text-sm underline"
              href="/dashboard/manager/order-billing"
            >
              Prepare payer and price
            </Link>
          ) : (
            <p className="max-w-sm text-sm text-muted-foreground">
              Payer and accepted price must be prepared by a separately
              authorized billing operator.
            </p>
          )}
        </header>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Invoice workspace views"
        >
          <Button
            variant={mode === "invoices" ? "default" : "outline"}
            disabled={!can("finance.invoices.read")}
            onClick={() => {
              setMode("invoices");
              setSelected("");
              setCursors([]);
              setSearch("");
            }}
          >
            Issued invoice register
          </Button>
          <Button
            variant={mode === "orders" ? "default" : "outline"}
            disabled={!can("finance.invoices.issue")}
            onClick={() => {
              setMode("orders");
              setSelected("");
              setCursors([]);
              setSearch("");
            }}
          >
            Prepare manual issuance
          </Button>
          <Button
            variant="outline"
            disabled={!allowed || busy}
            onClick={refresh}
          >
            Refresh current records
          </Button>
        </div>
        {error && (
          <p
            role="alert"
            className="break-words rounded-lg border border-destructive p-4 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {intent && (
          <section
            aria-label="Original invoice request"
            className="min-w-0 space-y-3 rounded-xl border bg-muted/20 p-4"
          >
            <h2 className="font-semibold">
              {intent.state === "confirmed"
                ? "Confirmed historical issuance"
                : "Unconfirmed issuance — retain original request"}
            </h2>
            <p className="break-words text-sm">
              Order {businessText(intent.display.orderNumber)} ·{" "}
              {businessText(intent.display.payerName)} ·{" "}
              <span className="whitespace-nowrap tabular-nums">
                {intent.display.amount} {intent.display.currency}
              </span>
            </p>
            <p className="break-words text-sm">
              Reason: {businessText(intent.payload.reason)}
            </p>
            {intent.result && (
              <p className="text-sm">
                Invoice {businessText(intent.result.invoiceNumber)} ·{" "}
                {businessText(intent.result.status)}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Historical confirmation is separate from current records. Original
              source and request identity are retained internally. Refreshed
              selections cannot retarget this request.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy || !ready || !can("finance.invoices.issue")}
                onClick={() => void action(true)}
              >
                Retry original issuance
              </Button>
              {intent.state === "confirmed" && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void finish()}
                >
                  Keep confirmation reviewed; start new action
                </Button>
              )}
            </div>
          </section>
        )}
        {!allowed ? (
          <WorkspaceState
            kind="denied"
            title="Invoice authority required"
            description="An accepted company/entity-bound invoice profile is required. Administrator status is insufficient."
          />
        ) : (
          <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <section className="min-w-0 space-y-4 rounded-xl border p-4">
              <h2 className="font-semibold">
                {mode === "invoices" ? "Invoice register" : "Owned orders"}
              </h2>
              <Field
                label={
                  mode === "invoices"
                    ? "Find invoice or order number"
                    : "Find order number"
                }
              >
                <input
                  className={control}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCursors([]);
                  }}
                />
              </Field>
              {list.isPending ? (
                <p role="status">Loading current records…</p>
              ) : list.error ? (
                <p
                  role="alert"
                  className="break-words text-sm text-destructive"
                >
                  {invoiceError(list.error)}
                </p>
              ) : (
                <>
                  <ul className="space-y-2">
                    {list.data?.items.map((row) => (
                      <li key={row.id}>
                        <button
                          className="w-full min-w-0 rounded-lg border p-3 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                          aria-pressed={selected === row.id}
                          onClick={() => setSelected(row.id)}
                        >
                          {"invoiceNumber" in row ? (
                            <>
                              <span className="block break-words font-medium">
                                {businessText(row.invoiceNumber)}
                              </span>
                              <span className="block break-words text-sm">
                                Order {businessText(row.orderNumber)} ·{" "}
                                {payerName(row.payer)}
                              </span>
                              <span className="block text-sm tabular-nums">
                                {row.amount} {row.currency} ·{" "}
                                {businessText(row.status)}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="block break-words font-medium">
                                Order {businessText(row.orderNumber)}
                              </span>
                              <span className="text-sm">
                                {businessText(row.status)}
                              </span>
                            </>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {list.data?.items.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No records in this selected context.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={!cursors.length}
                      onClick={() => setCursors((v) => v.slice(0, -1))}
                    >
                      Previous page
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!list.data?.nextCursor}
                      onClick={() =>
                        setCursors((v) => [...v, list.data!.nextCursor!])
                      }
                    >
                      Next page
                    </Button>
                  </div>
                </>
              )}
            </section>
            <section
              className="min-w-0 space-y-4 rounded-xl border p-4"
              aria-label="Invoice details"
            >
              {!selected ? (
                <p className="text-sm text-muted-foreground">
                  Select a named record to inspect its authoritative details.
                </p>
              ) : detail.isPending ? (
                <p role="status">Loading authorized details…</p>
              ) : detail.error ? (
                <p
                  role="alert"
                  className="break-words text-sm text-destructive"
                >
                  {invoiceError(detail.error)}
                </p>
              ) : invoice ? (
                <>
                  <h2 className="break-words text-xl font-semibold">
                    {businessText(invoice.invoiceNumber)}
                  </h2>
                  <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
                    {Object.entries({
                      Company: businessText(invoice.companyName),
                      Order: businessText(invoice.orderNumber),
                      "Bill-to payer": payerName(invoice.payer),
                      "Exact total": invoice.amount + " " + invoice.currency,
                      Status: businessText(invoice.status),
                      "Issued by": businessText(invoice.issuerName),
                      Issued: date(invoice.issuedAt),
                      Due: date(invoice.dueAt),
                    }).map(([label, value]) => (
                      <div key={label} className="min-w-0">
                        <dt className="text-sm text-muted-foreground">
                          {label}
                        </dt>
                        <dd className="break-words font-medium [overflow-wrap:anywhere]">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="text-sm">{invoice.accounting}</p>
                  {invoice.hasFile && can("payments.intents.read") ? (
                    <Button disabled={busy} onClick={() => void download()}>
                      Open authorized invoice PDF
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {invoice.hasFile
                        ? "PDF signing requires separate authorized document access. This profile does not grant it automatically."
                        : "No generated PDF is available. Issuance does not fabricate a file."}
                    </p>
                  )}
                </>
              ) : preparation ? (
                <>
                  <h2 className="break-words text-xl font-semibold">
                    Order {businessText(preparation.order.orderNumber)}
                  </h2>
                  <p className="break-words">
                    {businessText(preparation.companyName)} ·{" "}
                    {payerName(preparation.payer)}
                  </p>
                  <p className="text-sm">
                    Current state: {businessText(preparation.order.status)} ·
                    Issuing base currency: {preparation.baseCurrency}
                  </p>
                  <p className="text-lg font-semibold tabular-nums">
                    {preparation.price
                      ? preparation.price.total +
                        " " +
                        preparation.price.currency
                      : "Accepted price unavailable"}
                  </p>
                  {preparation.price && (
                    <div
                      className="max-w-full overflow-auto rounded-lg border"
                      tabIndex={0}
                      aria-label="Accepted exact invoice components"
                    >
                      <table className="w-full min-w-[28rem] text-sm">
                        <caption className="p-3 text-left">
                          Accepted source components
                        </caption>
                        <thead>
                          <tr>
                            <th scope="col" className="p-2 text-left">
                              Component
                            </th>
                            <th scope="col" className="p-2 text-left">
                              Basis
                            </th>
                            <th scope="col" className="p-2 text-right">
                              Exact amount
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {preparation.price.components.map((c, i) => (
                            <tr key={i}>
                              <td className="p-2 [overflow-wrap:anywhere]">
                                {businessText(c.type)}
                              </td>
                              <td className="p-2 [overflow-wrap:anywhere]">
                                {businessText(c.code ?? c.basis, "—")}
                              </td>
                              <td className="p-2 text-right whitespace-nowrap tabular-nums">
                                {c.amount}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="text-sm">
                    Eligible policy states:{" "}
                    {preparation.eligibleStates
                      .map((v) => businessText(v))
                      .join(", ") || "Unavailable"}
                  </p>
                  {preparation.reasons.length ? (
                    <ul
                      className="list-inside list-disc space-y-2 text-sm"
                      aria-label="Issuance prerequisites"
                    >
                      {preparation.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm">
                      Current prerequisites satisfied. The server checks them
                      again at issuance.
                    </p>
                  )}
                  {preparation.existing && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setMode("invoices");
                        setSelected(preparation.existing!.id);
                      }}
                    >
                      Open {businessText(preparation.existing.invoiceNumber)}
                    </Button>
                  )}
                  <Field label="Reason for manual issuance">
                    <textarea
                      className={control}
                      maxLength={1000}
                      value={reason}
                      disabled={!!intent || busy}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </Field>
                  {!intent && (
                    <Button
                      disabled={
                        !ready ||
                        busy ||
                        !preparation.eligible ||
                        !reason.trim() ||
                        !can("finance.invoices.issue")
                      }
                      onClick={() => void action(false)}
                    >
                      {busy ? "Awaiting confirmation…" : "Issue manual invoice"}
                    </Button>
                  )}
                  <p className="text-sm text-muted-foreground">
                    No automatic retry. No FX, corrections, payment updates,
                    consolidated invoicing or accounting execution.
                  </p>
                </>
              ) : null}
            </section>
          </div>
        )}
      </div>
    </PageShell>
  );
}
