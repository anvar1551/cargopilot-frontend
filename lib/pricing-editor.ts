import { policyContent, tariffDraft } from "./pricing-workflow";

export type TextRow = Record<string, string>;
export type RowKind =
  | "rate"
  | "transit"
  | "route"
  | "included"
  | "fee"
  | "discount";
export const rowLimits: Record<RowKind, number> = {
  rate: 1000,
  transit: 50,
  route: 100,
  included: 30,
  fee: 30,
  discount: 10,
};
export const transportModes = [
  "ROAD",
  "AIR",
  "SEA",
  "RAIL",
  "COURIER",
  "MULTIMODAL",
];
export const invoiceStates = [
  "pending",
  "assigned",
  "pickup_in_progress",
  "picked_up",
  "at_warehouse",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "exception",
  "return_in_progress",
  "returned",
];
export type RowField = {
  key: string;
  label: string;
  options?: string[];
  optional?: boolean;
};
export const rowFields: Record<RowKind, RowField[]> = {
  rate: [
    { key: "zone", label: "Zone (0–99)" },
    { key: "weightFromKg", label: "Weight from (kg)" },
    { key: "weightToKg", label: "Weight to (kg)" },
    { key: "price", label: "Draft price" },
  ],
  transit: [
    { key: "sequence", label: "Sequence (1..N)" },
    { key: "legCode", label: "Leg code" },
    { key: "label", label: "Leg label", optional: true },
    {
      key: "mode",
      label: "Transport mode",
      options: transportModes,
      optional: true,
    },
    { key: "originCountryCode", label: "Origin country (two letters)" },
    {
      key: "destinationCountryCode",
      label: "Destination country (two letters)",
    },
    { key: "ratePerKg", label: "Draft rate per kg" },
    { key: "minCharge", label: "Minimum charge", optional: true },
    { key: "flatFee", label: "Flat fee", optional: true },
  ],
  route: [
    { key: "origin", label: "Origin city" },
    { key: "originCountry", label: "Origin country (two letters)" },
    { key: "destination", label: "Destination city" },
    { key: "destinationCountry", label: "Destination country (two letters)" },
    { key: "zone", label: "Zone (0–1000)" },
    {
      key: "coverageType",
      label: "Coverage",
      options: ["domestic", "international"],
    },
    { key: "transportMode", label: "Transport mode", options: transportModes },
  ],
  included: [{ key: "service", label: "Included service code" }],
  fee: [
    { key: "service", label: "Fee service code" },
    { key: "amount", label: "Exact fee amount" },
  ],
  discount: [
    { key: "code", label: "Discount code" },
    { key: "type", label: "Discount type", options: ["flat", "percent"] },
    { key: "value", label: "Exact discount value" },
  ],
};
const numeric = (v: string | undefined) => (v?.trim() ? Number(v) : null);
const country = (v: string | undefined) => (v ?? "").trim().toUpperCase();
export function rowValue(kind: RowKind, r: TextRow): unknown {
  if (kind === "rate")
    return {
      zone: numeric(r.zone),
      weightFromKg: numeric(r.weightFromKg),
      weightToKg: numeric(r.weightToKg),
      price: numeric(r.price),
    };
  if (kind === "transit")
    return {
      sequence: numeric(r.sequence),
      legCode: (r.legCode ?? "").trim(),
      label: r.label?.trim() || null,
      mode: r.mode || null,
      originCountryCode: country(r.originCountryCode),
      destinationCountryCode: country(r.destinationCountryCode),
      ratePerKg: numeric(r.ratePerKg),
      minCharge: numeric(r.minCharge),
      flatFee: numeric(r.flatFee),
    };
  if (kind === "route")
    return {
      origin: (r.origin ?? "").trim(),
      destination: (r.destination ?? "").trim(),
      originCountry: country(r.originCountry),
      destinationCountry: country(r.destinationCountry),
      zone: numeric(r.zone),
      coverageType: r.coverageType,
      transportMode: r.transportMode,
    };
  if (kind === "included") return (r.service ?? "").trim();
  if (kind === "fee")
    return {
      service: (r.service ?? "").trim(),
      amount: (r.amount ?? "").trim(),
    };
  return {
    code: (r.code ?? "").trim(),
    type: r.type,
    value: (r.value ?? "").trim(),
  };
}
const rowSchemas = {
  rate: tariffDraft.shape.rates.element,
  transit: tariffDraft.shape.transitLegRates.element,
  route: policyContent.shape.zones.shape.mappings.element,
  included: policyContent.shape.tariff.shape.includedServices.element,
  fee: policyContent.shape.fees.element,
  discount: policyContent.shape.discounts.element,
};
export function rowErrors(kind: RowKind, row: TextRow) {
  const parsed = rowSchemas[kind].safeParse(rowValue(kind, row));
  const errors = parsed.success
    ? []
    : parsed.error.issues.map(
        (i) => `${i.path.join(".") || "Service"}: ${i.message}`,
      );
  if (
    kind === "discount" &&
    row.type === "percent" &&
    !percentInRange(row.value ?? "")
  )
    errors.push("Percentage must be an exact decimal from 0 to 100.");
  return errors;
}
export function percentInRange(v: string) {
  if (!/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(v) || v.length > 40) return false;
  const [whole, fraction = ""] = v.split(".");
  return (
    BigInt(whole) < BigInt(100) ||
    (BigInt(whole) === BigInt(100) && !/[1-9]/.test(fraction))
  );
}
export function normalizeRows(kind: RowKind, rows: TextRow[] | null) {
  if (rows === null) throw Error("Choose rows or explicitly choose none.");
  if (rows.length > rowLimits[kind])
    throw Error(`Maximum ${rowLimits[kind]} ${kind} rows.`);
  return rows.map((r, index) => {
    const errors = rowErrors(kind, r);
    if (errors.length) throw Error(`Row ${index + 1}: ${errors.join("; ")}`);
    return rowSchemas[kind].parse(rowValue(kind, r));
  });
}
export function textRows(rows: Record<string, unknown>[]) {
  return rows.map((r) =>
    Object.fromEntries(
      Object.entries(r).map(([k, v]) => [k, v == null ? "" : String(v)]),
    ),
  );
}
export type PolicyFormState = {
  values: TextRow;
  routes: TextRow[] | null;
  included: TextRow[] | null;
  fees: TextRow[] | null;
  discounts: TextRow[] | null;
  states: string[] | null;
};
export function policyFormValue(s: PolicyFormState) {
  const n = s.values,
    rows = (kind: RowKind, r: TextRow[] | null) =>
      r === null ? null : r.map((v) => rowValue(kind, v));
  return {
    currency: n.currency,
    precision: numeric(n.precision),
    rounding: n.rounding,
    weight: { source: "recorded_order_kg", rule: "as_recorded" },
    zones: {
      source: "structured_address_cities",
      mappings: rows("route", s.routes),
    },
    tariff: {
      strategy: "FIXED_LANE",
      priceType: "bucket",
      includedServices: rows("included", s.included),
    },
    fees: rows("fee", s.fees),
    discounts: rows("discount", s.discounts),
    tax: {
      treatment: n.tax,
      ...(n.tax === "exclusive_percent" ? { rate: n.taxRate } : {}),
      authorityReference: n.taxEvidence,
    },
    calculationOrder: n.order,
    roundingStage: "each_component",
    billing: {
      mode: "manual",
      eligibleOrderStates: s.states,
      dueDays: numeric(n.dueDays),
      numberPrefix: n.prefix,
    },
  };
}
export function normalizedPolicyForm(s: PolicyFormState) {
  for (const [kind, rows] of [
    ["route", s.routes],
    ["included", s.included],
    ["fee", s.fees],
    ["discount", s.discounts],
  ] as const)
    normalizeRows(kind, rows);
  if (
    s.values.tax === "exclusive_percent" &&
    !percentInRange(s.values.taxRate ?? "")
  )
    throw Error("Tax percentage must be between 0 and 100.");
  return policyContent.parse(policyFormValue(s));
}

/** Component-owned fence: not persisted; selection never modifies a pending intent. */
export function createTariffEditor(context: string) {
  let selected = "",
    revision = 0,
    alive = true,
    loaded: { id: string; name: string } | null = null,
    newDraft = true;
  return {
    select(id: string) {
      selected = id;
      loaded = null;
      newDraft = !id;
      revision++;
    },
    begin() {
      if (!alive || !selected) throw Error("Select an unpublished plan first.");
      loaded = null;
      return { context, id: selected, revision: ++revision };
    },
    current(t: { context: string; id: string; revision: number }) {
      return (
        alive &&
        t.context === context &&
        t.id === selected &&
        t.revision === revision
      );
    },
    accept(
      t: { context: string; id: string; revision: number },
      plan: { id: string; name: string },
    ) {
      if (!this.current(t) || plan.id !== t.id) return false;
      loaded = { id: plan.id, name: plan.name };
      newDraft = false;
      return true;
    },
    update(id: string, draft: unknown) {
      if (!alive || newDraft || !loaded || loaded.id !== id || selected !== id)
        throw Error("Load this exact selected draft before saving.");
      return { planId: loaded.id, draft: tariffDraft.parse(draft) };
    },
    create(draft: unknown) {
      if (!alive || !newDraft || selected || loaded)
        throw Error("Choose Start new draft before creating.");
      return { draft: tariffDraft.parse(draft) };
    },
    invalidate() {
      alive = false;
      loaded = null;
      revision++;
    },
    activate() {
      alive = true;
      revision++;
    },
  };
}
