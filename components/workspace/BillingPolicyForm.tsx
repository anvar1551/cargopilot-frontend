"use client";
import { useState } from "react";
import { Field, control } from "./PricingWorkflowShared";
/** Algorithm/source literals are fixed backend contracts; every financial and
 * business-policy value must be entered explicitly, including empty arrays. */
export default function BillingPolicyForm({
  onChange,
}: {
  onChange: (json: string) => void;
}) {
  const [v, setV] = useState<Record<string, string>>({});
  const update = (key: string, value: string) => {
    const n = { ...v, [key]: value };
    setV(n);
    const array = (k: string) => {
      try {
        return JSON.parse(n[k] ?? "");
      } catch {
        return n[k] ?? null;
      }
    };
    const number = (k: string) => (n[k]?.trim() ? Number(n[k]) : null);
    onChange(
      JSON.stringify(
        {
          currency: n.currency,
          precision: number("precision"),
          rounding: n.rounding,
          weight: { source: "recorded_order_kg", rule: "as_recorded" },
          zones: {
            source: "structured_address_cities",
            mappings: array("routes"),
          },
          tariff: {
            strategy: "FIXED_LANE",
            priceType: "bucket",
            includedServices: array("included"),
          },
          fees: array("fees"),
          discounts: array("discounts"),
          tax:
            n.tax === "exclusive_percent"
              ? {
                  treatment: n.tax,
                  rate: n.taxRate,
                  authorityReference: n.taxEvidence,
                }
              : { treatment: n.tax, authorityReference: n.taxEvidence },
          calculationOrder: n.order,
          roundingStage: "each_component",
          billing: {
            mode: "manual",
            eligibleOrderStates: array("states"),
            dueDays: number("dueDays"),
            numberPrefix: n.prefix,
          },
        },
        null,
        2,
      ),
    );
  };
  const select = (key: string, label: string, values: string[]) => (
    <Field label={label}>
      <select
        className={control}
        value={v[key] ?? ""}
        onChange={(e) => update(key, e.target.value)}
      >
        <option value="">Choose explicitly</option>
        {values.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
    </Field>
  );
  const input = (key: string, label: string) => (
    <Field label={label}>
      <input
        className={control}
        value={v[key] ?? ""}
        onChange={(e) => update(key, e.target.value)}
      />
    </Field>
  );
  const array = (key: string, label: string, help: string) => (
    <Field label={label}>
      <textarea
        rows={4}
        className={control + " font-mono"}
        value={v[key] ?? ""}
        onChange={(e) => update(key, e.target.value)}
      />
      <span className="block break-words text-xs font-normal text-muted-foreground">
        {help}
      </span>
    </Field>
  );
  return (
    <div className="min-w-0 space-y-4">
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        {select("currency", "Pricing currency", ["UZS", "USD", "CNY"])}
        {select("precision", "Decimal places", ["0", "1", "2", "3", "4"])}
        {select("rounding", "Rounding rule", [
          "HALF_UP",
          "HALF_EVEN",
          "DOWN",
          "UP",
        ])}
        {select("order", "Discount / tax sequence", [
          "discount_then_tax",
          "tax_then_discount",
        ])}
      </div>
      {array(
        "routes",
        "Country-qualified route → zone mappings",
        "Required JSON rows: origin, destination, originCountry, destinationCountry, zone (including 0), coverageType domestic/international, transportMode ROAD/AIR/SEA/RAIL/COURIER/MULTIMODAL. Identical city names in different countries are distinct routes.",
      )}
      {array(
        "included",
        "Services included in tariff",
        "Explicit JSON string array of included service codes. Included services cannot also be charged as a fee.",
      )}
      <details className="min-w-0 space-y-4">
        <summary className="cursor-pointer font-medium">
          Fees, discounts and tax — all explicit
        </summary>
        <div className="mt-4 space-y-4">
          {array(
            "fees",
            "Additional fees",
            "Explicit [] for none, or rows {service, amount}. Amounts are exact decimal strings.",
          )}
          {array(
            "discounts",
            "Approved discounts",
            "Explicit [] for none, or rows {code, type: flat/percent, value}. Values are decimal strings; percent ≤100. Discounts trigger separate order-price approval.",
          )}
          {select("tax", "Tax treatment", [
            "exclusive_percent",
            "exempt",
            "not_applicable",
          ])}
          {v.tax === "exclusive_percent" &&
            input("taxRate", "Exact tax percentage (0–100)")}
          {input("taxEvidence", "Tax authority / evidence reference")}
        </div>
      </details>
      <details className="min-w-0">
        <summary className="cursor-pointer font-medium">
          Manual billing eligibility
        </summary>
        <div className="mt-4 space-y-4">
          {array(
            "states",
            "Eligible order states",
            "Explicit JSON string array: pending, assigned, pickup_in_progress, picked_up, at_warehouse, in_transit, out_for_delivery, delivered, exception, return_in_progress, returned. No cancelled orders or collection-window override.",
          )}
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            {input("dueDays", "Invoice due days (0–365)")}
            {input("prefix", "Invoice number prefix (A–Z, digits, hyphens)")}
          </div>
        </div>
      </details>
      <p className="text-sm text-muted-foreground">
        Uses recorded kilograms, structured country/city evidence, FIXED_LANE
        bucket pricing, rounding per component and manual billing. No FX,
        inferred tax, accounting or automatic invoice issuance.
      </p>
    </div>
  );
}
