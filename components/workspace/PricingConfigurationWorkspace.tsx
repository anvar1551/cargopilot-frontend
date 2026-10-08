"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { hasPermission } from "@/lib/auth";
import { useWorkspaceSession } from "@/lib/workspace";
import {
  readPricing,
  tariffDraft,
  policyContent,
  pricingError,
} from "@/lib/pricing-workflow";
import { listWorkspaceCustomers } from "@/lib/customer-workspace";
import PageShell from "@/components/layout/PageShell";
import WorkspaceState from "./WorkspaceState";
import PricingReferencePanel from "./PricingReferencePanel";
import BillingPolicyForm from "./BillingPolicyForm";
import { Button } from "@/components/ui/button";
import {
  Field,
  ExactDetails,
  IntentAction,
  control,
} from "./PricingWorkflowShared";
type Plan = {
  id: string;
  name: string;
  contentGeneration: number;
  approvedVersionId: string | null;
};
type Version = {
  id: string;
  contentSha256?: string;
  contentHash?: string;
  sourceGeneration?: number;
  revision?: number;
  reason: string;
  content: unknown;
  independent: boolean;
  current?: boolean;
  decision: { decision: string; reason: string } | null;
};
type Page = { items: Version[]; nextCursor: string | null; plan?: Plan };
const services = [
    "DOOR_TO_DOOR",
    "DOOR_TO_POINT",
    "POINT_TO_DOOR",
    "POINT_TO_POINT",
  ],
  modes = ["ROAD", "AIR", "SEA", "RAIL", "COURIER", "MULTIMODAL"];
function Select({
  label,
  value,
  onChange,
  values,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  values: string[];
}) {
  return (
    <Field label={label}>
      <select
        className={control}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Choose explicitly</option>
        {values.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
    </Field>
  );
}
export default function PricingConfigurationWorkspace() {
  const s = useWorkspaceSession();
  return !s.user || !s.context ? (
    <WorkspaceState
      kind="denied"
      title="Selected membership required"
      description="Sign in with current pricing authority."
    />
  ) : (
    <Configuration
      key={s.epoch}
      context={s.context}
      can={(p) => hasPermission(s.user!, p)}
    />
  );
}
function Configuration({
  context,
  can,
}: {
  context: string;
  can: (p: string) => boolean;
}) {
  const [tab, setTab] = useState<"tariff" | "policy">("tariff"),
    [selected, setSelected] = useState(""),
    [cursor, setCursor] = useState<string[]>([]),
    [version, setVersion] = useState<Version>(),
    [reason, setReason] = useState(""),
    [decision, setDecision] = useState(""),
    [draftError, setDraftError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({
      status: "draft",
    }),
    [rates, setRates] = useState(""),
    [legs, setLegs] = useState(""),
    [customer, setCustomer] = useState(""),
    [template, setTemplate] = useState(""),
    [customerSearch, setCustomerSearch] = useState(""),
    [customerPage, setCustomerPage] = useState(1),
    [planCursor, setPlanCursor] = useState<string[]>([]),
    [templateCursor, setTemplateCursor] = useState<string[]>([]),
    [policy, setPolicy] = useState("");
  const list = useQuery({
    queryKey: ["pricing-plans", context, planCursor.at(-1)],
    enabled: can("pricing.read"),
    retry: false,
    queryFn: () =>
      readPricing<{ data: Plan[]; pageInfo: { nextCursor: string | null } }>(
        context,
        "/tariff-plans",
        { limit: 20, cursor: planCursor.at(-1) },
      ),
  });
  const templates = useQuery({
    queryKey: ["pricing-templates", context, templateCursor.at(-1)],
    enabled: can("pricing.read"),
    retry: false,
    queryFn: () =>
      readPricing<{
        items: { id: string; name: string; code: string }[];
        nextCursor: string | null;
      }>(context, "/workflow", {
        view: "templates",
        permission: "pricing.read",
        cursor: templateCursor.at(-1),
      }),
  });
  const customers = useQuery({
    queryKey: ["pricing-customers", context, customerSearch, customerPage],
    enabled: can("customers.read"),
    retry: false,
    queryFn: () =>
      listWorkspaceCustomers(context, {
        q: customerSearch,
        page: customerPage,
      }),
  });
  const history = useQuery({
    queryKey: ["pricing-history", context, tab, selected, cursor.at(-1)],
    enabled: can("pricing.read") && (tab === "policy" || !!selected),
    retry: false,
    queryFn: () =>
      readPricing<Page>(context, "/workflow", {
        view: tab === "policy" ? "policies" : "tariffs",
        permission: "pricing.read",
        ...(tab === "tariff" ? { id: selected } : {}),
        cursor: cursor.at(-1),
      }),
  });
  const refresh = () => {
    void list.refetch();
    void history.refetch();
  };
  const edit = async () => {
    setDraftError("");
    try {
      const d = await readPricing<Record<string, unknown>>(
        context,
        "/tariff-plans/" + selected,
      );
      if (d.approvedVersionId)
        throw Error("Published plans are immutable; author a new draft.");
      setFields(
        Object.fromEntries(
          [
            "name",
            "code",
            "description",
            "status",
            "serviceType",
            "priceType",
            "pricingStrategy",
            "coverageType",
            "transportMode",
            "originCountryCode",
            "destinationCountryCode",
            "currency",
            "priority",
            "isDefault",
          ].map((k) => [k, String(d[k] ?? "")]),
        ),
      );
      setCustomer(String(d.customerEntityId ?? ""));
      setTemplate(String(d.routeTemplateId ?? ""));
      setRates(
        JSON.stringify(
          (d.rates as Record<string, unknown>[]).map((r) => ({
            zone: r.zone,
            weightFromKg: Number(r.weightFromKg),
            weightToKg: Number(r.weightToKg),
            price: Number(r.price),
          })),
          null,
          2,
        ),
      );
      setLegs(
        JSON.stringify(
          (d.transitPricingConfig as { legs?: unknown[] } | null)?.legs ?? [],
          null,
          2,
        ),
      );
    } catch (e) {
      setDraftError(pricingError(e));
    }
  };
  const draft = () =>
    tariffDraft.parse({
      ...fields,
      code: fields.code || null,
      description: fields.description || null,
      originCountryCode: fields.originCountryCode || null,
      destinationCountryCode: fields.destinationCountryCode || null,
      priority: fields.priority ? Number(fields.priority) : undefined,
      isDefault: fields.isDefault ? fields.isDefault === "true" : undefined,
      customerEntityId: customer || null,
      routeTemplateId: template || null,
      rates: rates ? JSON.parse(rates) : [],
      transitLegRates: legs ? JSON.parse(legs) : [],
    });
  const set = (k: string, v: string) => setFields((f) => ({ ...f, [k]: v }));
  const fieldNames: Record<string, string> = {
    name: "Tariff name",
    code: "Code",
    description: "Description",
    priority: "Priority",
    originCountryCode: "Origin country (international only)",
    destinationCountryCode: "Destination country (international only)",
    serviceType: "Service",
    priceType: "Rate type",
    pricingStrategy: "Calculation strategy",
    coverageType: "Coverage",
    transportMode: "Transport mode",
    isDefault: "Default precedence",
    currency: "Currency",
    status: "Draft status",
  };
  return (
    <PageShell className="admin-workspace">
      <div className="space-y-6">
        <header className="flex flex-wrap justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Configure → independently approve → prepare orders
            </p>
            <h1 className="text-2xl font-semibold">
              Approved pricing configuration
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Drafts and quotes are not accepted selling prices. Publication
              preserves exact content and different-human approval.
            </p>
          </div>
          <Link className="underline" href="/dashboard/manager/order-billing">
            Prepare order billing →
          </Link>
        </header>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={tab === "tariff" ? "default" : "outline"}
            onClick={() => {
              setTab("tariff");
              setCursor([]);
              setVersion(undefined);
            }}
          >
            Tariffs
          </Button>
          <Button
            variant={tab === "policy" ? "default" : "outline"}
            onClick={() => {
              setTab("policy");
              setCursor([]);
              setVersion(undefined);
            }}
          >
            Calculation & billing policies
          </Button>
          <Button variant="outline" onClick={refresh}>
            Refresh current state
          </Button>
        </div>
        {!can("pricing.read") && (
          <WorkspaceState
            kind="denied"
            title="Pricing access required"
            description="Accepted business-action capabilities are checked by the server; role names confer no authority."
          />
        )}
        {tab === "tariff" ? (
          <div className="admin-columns">
            <section className="min-w-0 space-y-4 rounded-xl border p-4">
              <h2 className="text-lg font-semibold">Tariff drafts</h2>
              {list.isPending && <p role="status">Loading scoped plans…</p>}
              {list.error && <p role="alert">{pricingError(list.error)}</p>}
              <Field label="Owned plan">
                <select
                  className={control}
                  value={selected}
                  onChange={(e) => {
                    setSelected(e.target.value);
                    setCursor([]);
                    setVersion(undefined);
                  }}
                >
                  <option value="">Select a named plan</option>
                  {list.data?.data.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} —{" "}
                      {p.approvedVersionId ? "published" : "unpublished"}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={!planCursor.length}
                  onClick={() => setPlanCursor((c) => c.slice(0, -1))}
                >
                  Previous plans
                </Button>
                <Button
                  variant="outline"
                  disabled={!list.data?.pageInfo.nextCursor}
                  onClick={() =>
                    setPlanCursor((c) => [
                      ...c,
                      list.data!.pageInfo.nextCursor!,
                    ])
                  }
                >
                  Next plans
                </Button>
                <Button
                  variant="outline"
                  disabled={!selected || !can("pricing.write")}
                  onClick={() => void edit()}
                >
                  Load unpublished draft
                </Button>
              </div>
              {draftError && <p role="alert">{draftError}</p>}
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                {[
                  "name",
                  "code",
                  "description",
                  "priority",
                  "originCountryCode",
                  "destinationCountryCode",
                ].map((k) => (
                  <Field key={k} label={fieldNames[k]}>
                    <input
                      className={control}
                      value={fields[k] ?? ""}
                      onChange={(e) => set(k, e.target.value)}
                    />
                  </Field>
                ))}
                {Object.entries({
                  status: ["draft", "active", "archived"],
                  serviceType: services,
                  priceType: ["bucket", "linear"],
                  pricingStrategy: ["FIXED_LANE", "LEG_TRANSIT"],
                  coverageType: ["domestic", "international"],
                  transportMode: modes,
                  currency: ["UZS", "USD", "CNY"],
                  isDefault: ["false", "true"],
                }).map(([k, values]) => (
                  <Select
                    key={k}
                    label={fieldNames[k]}
                    value={fields[k] ?? ""}
                    values={values}
                    onChange={(v) => set(k, v)}
                  />
                ))}
              </div>
              <Field label="Route template (optional; owned names only)">
                <select
                  className={control}
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                >
                  <option value="">No route-template restriction</option>
                  {templates.data?.items.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} — {t.code}
                    </option>
                  ))}
                </select>
              </Field>
              {templates.error && (
                <p role="alert">{pricingError(templates.error)}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={!templateCursor.length}
                  onClick={() => setTemplateCursor((c) => c.slice(0, -1))}
                >
                  Previous templates
                </Button>
                <Button
                  variant="outline"
                  disabled={!templates.data?.nextCursor}
                  onClick={() =>
                    setTemplateCursor((c) => [
                      ...c,
                      templates.data!.nextCursor!,
                    ])
                  }
                >
                  Next templates
                </Button>
              </div>
              <Field label="Customer restriction (optional; separate customer access required)">
                <input
                  aria-label="Search tariff customers"
                  className={control}
                  value={customerSearch}
                  disabled={!can("customers.read")}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setCustomerPage(1);
                  }}
                />
                <select
                  className={control}
                  value={customer}
                  disabled={!can("customers.read")}
                  onChange={(e) => setCustomer(e.target.value)}
                >
                  <option value="">No customer restriction</option>
                  {customers.data?.data.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              {customer &&
                !customers.data?.data.some((c) => c.id === customer) && (
                  <p className="break-all text-sm">
                    Retained existing customer reference: {customer}. Server
                    revalidation remains required.
                  </p>
                )}
              {customers.error && (
                <p role="alert">{pricingError(customers.error)}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={customerPage === 1}
                  onClick={() => setCustomerPage((p) => p - 1)}
                >
                  Previous customers
                </Button>
                <Button
                  variant="outline"
                  disabled={
                    !customers.data || customerPage >= customers.data.pageCount
                  }
                  onClick={() => setCustomerPage((p) => p + 1)}
                >
                  Next customers
                </Button>
              </div>
              <Field label="Weight/zone rate rows (JSON)">
                <textarea
                  rows={7}
                  className={control + " font-mono"}
                  value={rates}
                  placeholder={
                    '[{"zone":0,"weightFromKg":0.01,"weightToKg":10,"price":100}]'
                  }
                  onChange={(e) => setRates(e.target.value)}
                />
              </Field>
              <details>
                <summary className="cursor-pointer">
                  Transit draft fields
                </summary>
                <Field label="Transit leg rates (JSON array)">
                  <textarea
                    rows={6}
                    className={control + " font-mono"}
                    value={legs}
                    onChange={(e) => setLegs(e.target.value)}
                  />
                </Field>
                <p className="text-sm">
                  sequence, legCode, label, mode, originCountryCode,
                  destinationCountryCode, ratePerKg, minCharge, flatFee. Transit
                  and linear drafts remain supported; accepted publication
                  remains FIXED_LANE/bucket only.
                </p>
              </details>
              <IntentAction
                context={context}
                kind="draftCreate"
                payload={() => ({ draft: draft() })}
                allowed={can("pricing.write")}
                label="Create unpublished draft"
                onConfirmed={refresh}
              />
              {selected && (
                <>
                  <IntentAction
                    context={context}
                    kind="draftUpdate"
                    payload={() => ({ planId: selected, draft: draft() })}
                    allowed={
                      can("pricing.write") &&
                      !history.data?.plan?.approvedVersionId
                    }
                    label="Save selected unpublished draft"
                    onConfirmed={refresh}
                  />
                  <IntentAction
                    context={context}
                    kind="draftDelete"
                    payload={() => ({ planId: selected })}
                    allowed={
                      can("pricing.write") &&
                      !history.data?.plan?.approvedVersionId
                    }
                    label="Delete selected unpublished draft"
                    onConfirmed={refresh}
                  />
                </>
              )}
            </section>
            <section className="min-w-0 space-y-4 rounded-xl border p-4">
              <h2 className="text-lg font-semibold">
                Immutable proposals & publication history
              </h2>
              <Field label="Proposal / decision reason">
                <textarea
                  className={control}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
              {selected && (
                <IntentAction
                  context={context}
                  kind="tariffPropose"
                  retryAllowed={can("pricing.tariffs.propose")}
                  payload={() => ({
                    planId: selected,
                    expectedGeneration: history.data?.plan?.contentGeneration,
                    reason,
                  })}
                  allowed={
                    can("pricing.tariffs.propose") && !!history.data?.plan
                  }
                  label="Propose exact current generation"
                  onConfirmed={refresh}
                />
              )}
              <History
                history={history.data}
                error={history.error}
                pending={history.isFetching}
                selected={version}
                select={setVersion}
                cursor={cursor}
                setCursor={setCursor}
              />
              {version && (
                <>
                  <Select
                    label="Independent decision"
                    value={decision}
                    values={["approved", "rejected"]}
                    onChange={setDecision}
                  />
                  <IntentAction
                    context={context}
                    kind="tariffDecide"
                    retryAllowed={can("pricing.tariffs.approve")}
                    payload={() => ({
                      planId: selected,
                      versionId: version.id,
                      contentSha256: version.contentSha256,
                      decision,
                      reason,
                    })}
                    allowed={
                      can("pricing.tariffs.approve") &&
                      version.independent &&
                      !version.decision
                    }
                    label="Record independent decision"
                    onConfirmed={refresh}
                  />
                </>
              )}
            </section>
          </div>
        ) : (
          <div className="admin-columns">
            <section className="min-w-0 space-y-4 rounded-xl border p-4">
              <h2 className="text-lg font-semibold">
                Explicit calculation & billing policy
              </h2>
              <p className="text-sm text-muted-foreground">
                Every configuration value is deliberate; no tax, discount,
                currency or invoice-state defaults are submitted.
              </p>
              <details>
                <summary className="cursor-pointer">
                  Required fields and supported values
                </summary>
                <p className="mt-2 break-words text-sm">
                  currency; precision 0–4; rounding HALF_UP/HALF_EVEN/DOWN/UP;
                  weight source recorded_order_kg/rule as_recorded; zones source
                  structured_address_cities and country-qualified mappings;
                  tariff FIXED_LANE/bucket/includedServices; explicit fees and
                  discounts arrays; tax treatment plus authorityReference (rate
                  for exclusive_percent); calculationOrder
                  discount_then_tax/tax_then_discount; roundingStage
                  each_component; billing
                  manual/eligibleOrderStates/dueDays/numberPrefix. Approved
                  discounts require independent price approval. Informational
                  promotions do not change prices.
                </p>
              </details>
              <BillingPolicyForm onChange={setPolicy} />
              <ExactDetails
                value={policy ? JSON.parse(policy) : null}
                title="Exact proposed policy preview (incomplete until all required fields are supplied)"
              />
              <Field label="Reason">
                <textarea
                  className={control}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
              <IntentAction
                context={context}
                kind="policyPropose"
                payload={() => ({
                  content: policyContent.parse(JSON.parse(policy)),
                  reason,
                })}
                allowed={can("billing.policies.propose")}
                label="Propose immutable policy"
                onConfirmed={refresh}
              />
            </section>
            <section className="min-w-0 space-y-4 rounded-xl border p-4">
              <h2 className="text-lg font-semibold">
                Policy inspection & independent decision
              </h2>
              <History
                history={history.data}
                error={history.error}
                pending={history.isFetching}
                selected={version}
                select={setVersion}
                cursor={cursor}
                setCursor={setCursor}
              />
              {version && (
                <>
                  <Select
                    label="Independent decision"
                    value={decision}
                    values={["approved", "rejected"]}
                    onChange={setDecision}
                  />
                  <IntentAction
                    context={context}
                    kind="policyDecide"
                    retryAllowed={can("billing.policies.approve")}
                    payload={() => ({
                      versionId: version.id,
                      contentHash: version.contentHash,
                      decision,
                      reason,
                    })}
                    allowed={
                      can("billing.policies.approve") &&
                      version.independent &&
                      !version.decision
                    }
                    label="Record independent policy decision"
                    onConfirmed={refresh}
                  />
                </>
              )}
            </section>
          </div>
        )}
        {can("pricing.read") && <PricingReferencePanel context={context} />}
        <p className="text-sm text-muted-foreground">
          Shared region/zone/SLA mutations are contained; route mapping is
          explicit in approved policy. No accounting, FX, vouchers or merchant
          COD. UI visibility never authorizes writes.
        </p>
      </div>
    </PageShell>
  );
}
function History({
  history,
  error,
  pending,
  selected,
  select,
  cursor,
  setCursor,
}: {
  history?: Page;
  error: unknown;
  pending: boolean;
  selected?: Version;
  select: (v: Version) => void;
  cursor: string[];
  setCursor: (f: (v: string[]) => string[]) => void;
}) {
  return (
    <div className="min-w-0 space-y-3">
      {pending && <p role="status">Loading authoritative history…</p>}
      {!!error && <p role="alert">{pricingError(error)}</p>}
      {history?.items.length === 0 && <p>No proposals in this page.</p>}
      <div className="space-y-2">
        {history?.items.map((v) => (
          <button
            type="button"
            key={v.id}
            className={
              control + " text-left hover:bg-muted focus-visible:outline-2"
            }
            onClick={() => select(v)}
          >
            <span className="block break-all">
              Generation / revision {v.sourceGeneration ?? v.revision} —{" "}
              {v.current || history.plan?.approvedVersionId === v.id
                ? "active"
                : (v.decision?.decision ?? "pending")}
            </span>
            <span className="block break-words text-muted-foreground">
              {v.reason}
            </span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={!cursor.length}
          onClick={() => setCursor((c) => c.slice(0, -1))}
        >
          Previous history
        </Button>
        <Button
          variant="outline"
          disabled={!history?.nextCursor}
          onClick={() => setCursor((c) => [...c, history!.nextCursor!])}
        >
          Next history
        </Button>
      </div>
      {selected && (
        <ExactDetails
          value={selected}
          title="Exact immutable proposal, maker, fingerprint & decision"
        />
      )}
    </div>
  );
}
