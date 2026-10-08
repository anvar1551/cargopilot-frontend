"use client";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Field, control } from "./PricingWorkflowShared";
import {
  rowFields,
  rowErrors,
  type RowKind,
  type TextRow,
} from "@/lib/pricing-editor";
export default function PricingRows({
  title,
  kind,
  value,
  onChange,
  max,
  allowNone = false,
}: {
  title: string;
  kind: RowKind;
  value: TextRow[] | null;
  onChange: (rows: TextRow[]) => void;
  max: number;
  allowNone?: boolean;
}) {
  const prefix = useId();
  return (
    <fieldset className="min-w-0 space-y-3 rounded-lg border p-3">
      <legend className="px-1 font-medium">{title}</legend>
      {value === null ? (
        <p className="text-sm">
          Choose Add row
          {allowNone ? " or explicitly None" : "; at least one row is required"}
          .
        </p>
      ) : value.length === 0 ? (
        <p className="text-sm">
          Explicitly no rows. The selected strategy may require rows.
        </p>
      ) : null}
      {(value ?? []).map((row, index) => {
        const errors = rowErrors(kind, row),
          errorId = `${prefix}-${index}`;
        return (
          <fieldset
            key={index}
            className="min-w-0 space-y-3 rounded-md border p-3"
          >
            <legend className="px-1 text-sm">
              {title} · row {index + 1}
            </legend>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              {rowFields[kind].map((f) => (
                <Field
                  key={f.key}
                  label={f.label + (f.optional ? " (optional)" : "")}
                >
                  {f.options ? (
                    <select
                      className={control}
                      aria-describedby={errors.length ? errorId : undefined}
                      value={row[f.key] ?? ""}
                      onChange={(e) =>
                        onChange(
                          (value ?? []).map((r, i) =>
                            i === index ? { ...r, [f.key]: e.target.value } : r,
                          ),
                        )
                      }
                    >
                      <option value="">
                        {f.optional ? "Not specified" : "Choose explicitly"}
                      </option>
                      {f.options.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className={control}
                      aria-describedby={errors.length ? errorId : undefined}
                      value={row[f.key] ?? ""}
                      onChange={(e) =>
                        onChange(
                          (value ?? []).map((r, i) =>
                            i === index ? { ...r, [f.key]: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  )}
                </Field>
              ))}
            </div>
            {errors.length > 0 && (
              <ul
                id={errorId}
                className="list-disc space-y-1 pl-5 text-sm text-destructive"
              >
                {errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
            <Button
              type="button"
              variant="outline"
              aria-label={`Remove ${title} row ${index + 1}`}
              onClick={() =>
                onChange((value ?? []).filter((_, i) => i !== index))
              }
            >
              Remove row {index + 1}
            </Button>
          </fieldset>
        );
      })}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={(value?.length ?? 0) >= max}
          onClick={() => onChange([...(value ?? []), {}])}
        >
          Add {title.toLowerCase()} row
        </Button>
        {allowNone && (
          <Button type="button" variant="outline" onClick={() => onChange([])}>
            None — no {title.toLowerCase()}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Maximum {max} rows. Values are explicit; no price or percentage is
        inferred.
      </p>
    </fieldset>
  );
}
