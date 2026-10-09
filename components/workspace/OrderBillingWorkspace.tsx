"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { hasPermission } from "@/lib/auth";
import { useWorkspaceSession } from "@/lib/workspace";
import { readPricing, pricingError } from "@/lib/pricing-workflow";
import { listWorkspaceCustomers } from "@/lib/customer-workspace";
import PageShell from "@/components/layout/PageShell";
import WorkspaceState from "./WorkspaceState";
import { Button } from "@/components/ui/button";
import {
  Field,
  ExactDetails,
  IntentAction,
  control,
} from "./PricingWorkflowShared";
type Order = {
  id: string;
  orderNumber: string;
  status: string;
  currency: string;
  paymentType: string;
  currentPriceApprovalId: string | null;
  weightKg: number | null;
};
type Price = {
  id: string;
  kind: string;
  total: string;
  currency: string;
  contentHash: string;
  content: {
    components: {
      type: string;
      code?: string;
      amount: string;
      basis?: string;
    }[];
  };
  independent: boolean;
  current: boolean;
  acceptedAt: string | null;
  reason: string;
};
type Preparation = {
  order: Order;
  entity: { id: string; baseCurrency: string };
  billTo: {
    id: string;
    payerCustomerEntityId: string;
    evidence: string;
    reason: string;
  } | null;
  instruction: {
    id: string;
    method: string;
    collectionParty: string;
    evidence: string;
    reason: string;
  } | null;
  obligation: Record<string, unknown> | null;
  prices: { items: Price[]; nextCursor: string | null };
  caution: string;
};
export default function OrderBillingWorkspace() {
  const s = useWorkspaceSession();
  return !s.user || !s.context ? (
    <WorkspaceState
      kind="denied"
      title="Selected company required"
      description="Use an accepted billing operator or independent exception checker membership."
    />
  ) : (
    <Billing
      key={s.epoch}
      context={s.context}
      can={(p) => hasPermission(s.user!, p)}
    />
  );
}
function Billing({
  context,
  can,
}: {
  context: string;
  can: (p: string) => boolean;
}) {
  const permissions = [
      "billing.payers.bind",
      "pricing.orders.accept",
      "pricing.orders.approve",
    ].filter(can),
    [permission, setPermission] = useState(permissions[0] ?? ""),
    [q, setQ] = useState(""),
    [cursor, setCursor] = useState<string[]>([]),
    [orderId, setOrder] = useState(""),
    [priceCursor, setPriceCursor] = useState<string[]>([]),
    [price, setPrice] = useState<Price>(),
    [payer, setPayer] = useState(""),
    [cq, setCq] = useState(""),
    [cp, setCp] = useState(1),
    [party, setParty] = useState(""),
    [evidence, setEvidence] = useState(""),
    [reason, setReason] = useState("");
  const orders = useQuery({
    queryKey: ["billing-orders", context, permission, q, cursor.at(-1)],
    enabled: !!permission,
    retry: false,
    queryFn: () =>
      readPricing<{ items: Order[]; nextCursor: string | null }>(
        context,
        "/workflow",
        { view: "orders", permission, q, cursor: cursor.at(-1) },
      ),
  });
  const state = useQuery({
    queryKey: [
      "billing-order-state",
      context,
      permission,
      orderId,
      priceCursor.at(-1),
    ],
    enabled: !!orderId && !!permission,
    retry: false,
    queryFn: () =>
      readPricing<Preparation>(context, "/workflow", {
        view: "order",
        permission,
        id: orderId,
        cursor: priceCursor.at(-1),
      }),
  });
  const customers = useQuery({
    queryKey: ["billing-payers", context, cq, cp],
    enabled: can("customers.read") && can("billing.payers.bind"),
    retry: false,
    queryFn: () => listWorkspaceCustomers(context, { q: cq, page: cp }),
  });
  const refresh = () => {
    void orders.refetch();
    if (orderId) void state.refetch();
  };
  const data = state.data;
  return (
    <PageShell className="admin-workspace">
      <div className="space-y-6">
        <header className="flex flex-wrap justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Approved configuration → explicit payer → exact price
            </p>
            <h1 className="text-2xl font-semibold">
              Order billing preparation
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Exact service-charge authority only. No invoice issuance, cash
              actions, merchant COD or accounting execution.
            </p>
          </div>
          <Link className="underline" href="/dashboard/manager/pricing">
            Inspect approved configuration →
          </Link>
        </header>
        {!permissions.length ? (
          <WorkspaceState
            kind="denied"
            title="Accepted billing capability required"
            description="Financial delegation, administrator status or order visibility alone is insufficient."
          />
        ) : (
          <>
            <section className="grid min-w-0 gap-4 rounded-xl border p-4 sm:grid-cols-2">
              <Field label="Current authorized action">
                <select
                  className={control}
                  value={permission}
                  onChange={(e) => {
                    setPermission(e.target.value);
                    setOrder("");
                    setCursor([]);
                    setPrice(undefined);
                  }}
                >
                  {permissions.map((p) => (
                    <option key={p} value={p}>
                      {
                        {
                          "billing.payers.bind": "Payer & payment instructions",
                          "pricing.orders.accept":
                            "Standard price / revision proposal",
                          "pricing.orders.approve":
                            "Independent exception / revision approval",
                        }[p]
                      }
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Search owned order number">
                <input
                  className={control}
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setCursor([]);
                  }}
                />
              </Field>
              <Field label="Authorized order">
                <select
                  className={control}
                  value={orderId}
                  onChange={(e) => {
                    setOrder(e.target.value);
                    setPriceCursor([]);
                    setPrice(undefined);
                  }}
                >
                  <option value="">Select a named order</option>
                  {orders.data?.items.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.orderNumber} — {o.status} — {o.currency}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex flex-wrap items-end gap-2">
                <Button
                  variant="outline"
                  disabled={!cursor.length}
                  onClick={() => setCursor((c) => c.slice(0, -1))}
                >
                  Previous orders
                </Button>
                <Button
                  variant="outline"
                  disabled={!orders.data?.nextCursor}
                  onClick={() =>
                    setCursor((c) => [...c, orders.data!.nextCursor!])
                  }
                >
                  Next orders
                </Button>
                <Button variant="outline" onClick={refresh}>
                  Refresh current state
                </Button>
              </div>
              {orders.isFetching && <p role="status">Loading scoped orders…</p>}
              {orders.error && <p role="alert">{pricingError(orders.error)}</p>}
              {orders.data?.items.length === 0 && (
                <p>No authorized orders in this page.</p>
              )}
            </section>
            {state.isFetching && (
              <p role="status">Loading authoritative billing state…</p>
            )}
            {state.error && <p role="alert">{pricingError(state.error)}</p>}
            {data && (
              <div className="admin-columns">
                <section className="min-w-0 space-y-4 rounded-xl border p-4">
                  <h2 className="text-lg font-semibold">
                    {data.order.orderNumber}: payer & CASH instruction
                  </h2>
                  <p className="text-sm">
                    State: {data.order.status}. Currency: {data.order.currency}.
                    Entity base: {data.entity.baseCurrency}. Recorded weight:{" "}
                    {data.order.weightKg ?? "unavailable"} kg.
                  </p>
                  <ExactDetails
                    value={data.billTo}
                    title="Current immutable bill-to record"
                  />
                  <ExactDetails
                    value={data.instruction}
                    title="Current explicit payment instruction"
                  />
                  {can("billing.payers.bind") && (
                    <>
                      <Field label="Find an authorized bill-to customer">
                        <input
                          className={control}
                          value={cq}
                          onChange={(e) => {
                            setCq(e.target.value);
                            setCp(1);
                          }}
                        />
                        <select
                          className={control}
                          value={payer}
                          onChange={(e) => setPayer(e.target.value)}
                        >
                          <option value="">Choose payer explicitly</option>
                          {customers.data?.data.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      {customers.error && (
                        <p role="alert">{pricingError(customers.error)}</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          disabled={cp === 1}
                          onClick={() => setCp((p) => p - 1)}
                        >
                          Previous payers
                        </Button>
                        <Button
                          variant="outline"
                          disabled={
                            !customers.data || cp >= customers.data.pageCount
                          }
                          onClick={() => setCp((p) => p + 1)}
                        >
                          Next payers
                        </Button>
                      </div>
                      <Field label="Payer authorization evidence">
                        <textarea
                          className={control}
                          value={evidence}
                          onChange={(e) => setEvidence(e.target.value)}
                          maxLength={500}
                        />
                      </Field>
                      <Field label="Reason">
                        <textarea
                          className={control}
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          maxLength={1000}
                        />
                      </Field>
                      <IntentAction
                        context={context}
                        kind="payer"
                        retryAllowed={can("billing.payers.bind")}
                        payload={() => ({
                          orderId,
                          payerCustomerEntityId: payer,
                          evidence,
                          reason,
                        })}
                        allowed={!data.billTo && !!payer}
                        label="Bind explicit bill-to payer"
                        onConfirmed={refresh}
                      />
                      <Field label="Explicit CASH collection timing">
                        <select
                          className={control}
                          value={party}
                          onChange={(e) => setParty(e.target.value)}
                        >
                          <option value="">Choose explicitly</option>
                          <option value="SENDER">
                            Sender — collected before picked up
                          </option>
                          <option value="RECIPIENT">
                            Recipient — collected before delivered
                          </option>
                        </select>
                      </Field>
                      <p className="text-sm text-muted-foreground">
                        Only an already CASH order can receive this instruction.
                        Online obligations cannot be converted. Evidence records
                        acting on behalf of the bill-to payer.
                      </p>
                      <IntentAction
                        context={context}
                        kind="instruction"
                        retryAllowed={can("billing.payers.bind")}
                        payload={() => ({
                          orderId,
                          billToId: data.billTo?.id,
                          method: "CASH",
                          collectionParty: party,
                          evidence,
                          reason,
                        })}
                        allowed={
                          !!data.billTo &&
                          !data.instruction &&
                          data.order.paymentType === "CASH" &&
                          !!party
                        }
                        label="Bind immutable CASH instruction"
                        onConfirmed={refresh}
                      />
                    </>
                  )}
                  <ExactDetails
                    value={data.obligation}
                    title="Current exact service-charge obligation & source identities"
                  />
                  <p className="break-words text-sm text-muted-foreground">
                    {data.caution}
                  </p>
                </section>
                <section className="min-w-0 space-y-4 rounded-xl border p-4">
                  <h2 className="text-lg font-semibold">
                    Exact accepted price & approval history
                  </h2>
                  {!can("billing.payers.bind") && (
                    <Field label="Reason">
                      <textarea
                        className={control}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        maxLength={1000}
                      />
                    </Field>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Standard acceptance computes current approved configuration
                    on the server. Approved discounts or changes to a prior
                    accepted basis produce a pending exception/revision
                    requiring another human. No client amount or promo discount
                    is submitted.
                  </p>
                  <IntentAction
                    context={context}
                    kind="price"
                    retryAllowed={can("pricing.orders.accept")}
                    payload={() => ({ orderId, reason })}
                    allowed={can("pricing.orders.accept") && !!data.billTo}
                    label={
                      data.order.currentPriceApprovalId
                        ? "Propose recomputed exact revision"
                        : "Accept standard exact price / propose exception"
                    }
                    onConfirmed={refresh}
                  />
                  {data.prices.items.length === 0 && (
                    <p>No price snapshots on this page.</p>
                  )}
                  {data.prices.items.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={
                        control +
                        " text-left hover:bg-muted focus-visible:outline-2"
                      }
                      onClick={() => setPrice(p)}
                    >
                      <span className="block">
                        {p.total} {p.currency} — {p.kind} —{" "}
                        {p.current
                          ? "current accepted"
                          : p.acceptedAt
                            ? "historical accepted"
                            : "approval required"}
                      </span>
                      <span className="block break-words text-muted-foreground">
                        {p.reason}
                      </span>
                    </button>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={!priceCursor.length}
                      onClick={() => setPriceCursor((c) => c.slice(0, -1))}
                    >
                      Previous prices
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!data.prices.nextCursor}
                      onClick={() =>
                        setPriceCursor((c) => [...c, data.prices.nextCursor!])
                      }
                    >
                      Next prices
                    </Button>
                  </div>
                  {price && (
                    <>
                      <div
                        className="max-w-full overflow-auto rounded-lg border"
                        tabIndex={0}
                        aria-label="Exact price components"
                      >
                        <table className="w-full min-w-[30rem] text-sm">
                          <caption className="p-3 text-left font-medium">
                            {price.total} {price.currency} — exact components
                          </caption>
                          <thead>
                            <tr>
                              <th scope="col" className="p-2 text-left whitespace-nowrap">Component</th>
                              <th scope="col" className="p-2 text-left whitespace-nowrap">Code / basis</th>
                              <th scope="col" className="p-2 text-right whitespace-nowrap">Exact amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {price.content.components.map((c, i) => (
                              <tr key={i}>
                                <td className="p-2 [overflow-wrap:anywhere]">{c.type}</td>
                                <td className="p-2 [overflow-wrap:anywhere]">
                                  {c.code ?? c.basis ?? "—"}
                                </td>
                                <td className="p-2 text-right whitespace-nowrap tabular-nums">
                                  {c.amount}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <ExactDetails
                        value={price}
                        title="Immutable calculation, rounding sources & approval"
                      />
                      <IntentAction
                        context={context}
                        kind="priceApprove"
                        retryAllowed={can("pricing.orders.approve")}
                        payload={() => ({
                          orderId,
                          snapshotId: price.id,
                          contentHash: price.contentHash,
                          reason,
                        })}
                        allowed={
                          can("pricing.orders.approve") &&
                          price.independent &&
                          !price.acceptedAt &&
                          price.kind !== "standard"
                        }
                        label="Independently approve exact exception / revision"
                        onConfirmed={refresh}
                      />
                    </>
                  )}
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
