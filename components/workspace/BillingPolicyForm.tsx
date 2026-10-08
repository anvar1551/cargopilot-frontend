"use client";
import { useState } from "react";
import { Field, control } from "./PricingWorkflowShared";
import PricingRows from "./PricingRows";
import {
  invoiceStates,
  normalizedPolicyForm,
  policyFormValue,
  type PolicyFormState,
} from "@/lib/pricing-editor";
export default function BillingPolicyForm({
  onChange,
}: {
  onChange: (json: string, valid: boolean) => void;
}) {
  const [s, setState] = useState<PolicyFormState>({
    values: {},
    routes: null,
    included: null,
    fees: null,
    discounts: null,
    states: null,
  });
  const update = (patch: Partial<PolicyFormState>) => {
    const next = { ...s, ...patch };
    setState(next);
    let valid = false;
    try {
      normalizedPolicyForm(next);
      valid = true;
    } catch {
      /* Incomplete fields remain visible and cannot submit. */
    }
    onChange(JSON.stringify(policyFormValue(next), null, 2), valid);
  };
  const field = (key: string, value: string) =>
    update({ values: { ...s.values, [key]: value } });
  const select = (key: string, label: string, values: string[]) => (
    <Field label={label}>
      <select
        className={control}
        value={s.values[key] ?? ""}
        onChange={(e) => field(key, e.target.value)}
      >
        <option value="">Choose explicitly</option>
        {values.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
    </Field>
  );
  const input = (key: string, label: string) => (
    <Field label={label}>
      <input
        className={control}
        value={s.values[key] ?? ""}
        onChange={(e) => field(key, e.target.value)}
      />
    </Field>
  );
  let issue = "";
  try {
    normalizedPolicyForm(s);
  } catch (e) {
    issue = e instanceof Error ? e.message : "Complete the explicit policy.";
  }
  return (
    <div className="min-w-0 space-y-4">
      <p className="break-words text-sm">
        Calculation preview: {s.values.currency || "currency not chosen"} ·{" "}
        {s.values.rounding || "rounding not chosen"} ·{" "}
        {s.routes?.length ?? "unconfirmed"} routes ·{" "}
        {s.included?.length ?? "unconfirmed"} included services ·{" "}
        {s.fees?.length ?? "unconfirmed"} fees ·{" "}
        {s.discounts?.length ?? "unconfirmed"} discounts. Exact policy evidence
        is shown separately below; this is not an accepted order quote.
      </p>
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
      <PricingRows
        title="Country-qualified routes"
        kind="route"
        value={s.routes}
        onChange={(routes) => update({ routes })}
        max={100}
      />
      <PricingRows
        title="Included services"
        kind="included"
        value={s.included}
        onChange={(included) => update({ included })}
        max={30}
      />
      <details className="min-w-0">
        <summary className="cursor-pointer font-medium">
          Fees, discounts and tax
        </summary>
        <div className="mt-4 space-y-4">
          <PricingRows
            title="Fees"
            kind="fee"
            value={s.fees}
            onChange={(fees) => update({ fees })}
            max={30}
            allowNone
          />
          <PricingRows
            title="Discounts"
            kind="discount"
            value={s.discounts}
            onChange={(discounts) => update({ discounts })}
            max={10}
            allowNone
          />
          {select("tax", "Tax treatment", [
            "exclusive_percent",
            "exempt",
            "not_applicable",
          ])}
          {s.values.tax === "exclusive_percent" &&
            input("taxRate", "Exact tax percentage (0–100)")}
          {input("taxEvidence", "Tax authority / evidence reference")}
        </div>
      </details>
      <details className="min-w-0">
        <summary className="cursor-pointer font-medium">
          Manual billing eligibility
        </summary>
        <div className="mt-4 space-y-4">
          <fieldset className="min-w-0 rounded-lg border p-3">
            <legend className="px-1 font-medium">
              Eligible invoice states — choose explicitly
            </legend>
            <p className="mb-3 text-sm">
              At least one state is required. This does not override collection
              deadlines.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {invoiceStates.map((state) => (
                <label
                  className="flex min-w-0 items-start gap-2 text-sm"
                  key={state}
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={s.states?.includes(state) ?? false}
                    onChange={(e) =>
                      update({
                        states: e.target.checked
                          ? [...(s.states ?? []), state]
                          : (s.states ?? []).filter((v) => v !== state),
                      })
                    }
                  />
                  <span className="break-words">
                    {state.replaceAll("_", " ")}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            {input("dueDays", "Invoice due days (0–365)")}
            {input("prefix", "Invoice number prefix (A–Z, digits, hyphens)")}
          </div>
        </div>
      </details>
      {issue && (
        <details className="min-w-0 rounded-lg border p-3">
          <summary className="cursor-pointer text-sm">
            Policy incomplete or invalid — review required fields
          </summary>
          <p
            className="mt-2 whitespace-pre-wrap break-words text-sm"
            role="status"
          >
            {issue}
          </p>
        </details>
      )}
      <p className="text-sm text-muted-foreground">
        Recorded kilograms, structured country/city evidence, FIXED_LANE
        buckets, per-component rounding and manual billing. No FX, inferred tax,
        accounting or automatic invoices. Fees and discounts retain exact
        decimal text. Empty collections must be explicitly chosen.
      </p>
    </div>
  );
}
