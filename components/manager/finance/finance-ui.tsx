"use client";

import axios from "axios";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function financeErrorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : fallback;
  }
  const payload = error.response?.data as
    | { message?: string; error?: string; details?: { message?: string } }
    | undefined;
  return (
    payload?.details?.message ?? payload?.message ?? payload?.error ?? fallback
  );
}

export function formatMoney(
  value: string | number | null | undefined,
  currency: string,
) {
  const raw = String(value ?? "0").trim();
  const match = raw.match(/^([+-]?)(\d+)(?:\.(\d+))?$/);
  if (!match) return `${raw} ${currency}`.trim();
  const grouped = match[2].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const minimumDecimals = currency === "UZS" ? 0 : 2;
  const fraction = (match[3] ?? "")
    .slice(0, 4)
    .replace(/0+$/, "")
    .padEnd(minimumDecimals, "0");
  return `${match[1]}${grouped}${fraction ? `.${fraction}` : ""} ${currency}`.trim();
}

function decimalUnits(value: string | number, scale: number) {
  const match = String(value)
    .trim()
    .match(/^([+-]?)(\d+)(?:\.(\d+))?$/);
  if (!match || (match[3]?.length ?? 0) > scale) return null;
  const units =
    BigInt(match[2]) * BigInt(10) ** BigInt(scale) +
    BigInt((match[3] ?? "").padEnd(scale, "0"));
  return match[1] === "-" ? -units : units;
}

export function isPositiveDecimal(value: string | number, scale = 4) {
  const units = decimalUnits(value, scale);
  return units !== null && units > BigInt(0);
}

export function decimalLessThanOrEqual(
  left: string | number,
  right: string | number,
  scale = 4,
) {
  const leftUnits = decimalUnits(left, scale);
  const rightUnits = decimalUnits(right, scale);
  return leftUnits !== null && rightUnits !== null && leftUnits <= rightUnits;
}

export function decimalEquals(
  left: string | number,
  right: string | number,
  scale = 4,
) {
  const leftUnits = decimalUnits(left, scale);
  const rightUnits = decimalUnits(right, scale);
  return leftUnits !== null && rightUnits !== null && leftUnits === rightUnits;
}

export function sumDecimals(values: Array<string | number>, scale = 4) {
  const total = values.reduce<bigint>(
    (sum, value) => sum + (decimalUnits(value, scale) ?? BigInt(0)),
    BigInt(0),
  );
  const negative = total < BigInt(0);
  const absolute = negative ? -total : total;
  const factor = BigInt(10) ** BigInt(scale);
  const integer = absolute / factor;
  const fraction = (absolute % factor)
    .toString()
    .padStart(scale, "0")
    .replace(/0+$/, "");
  return `${negative ? "-" : ""}${integer}${fraction ? `.${fraction}` : ""}`;
}

export function formatDate(
  value: string | null | undefined,
  includeTime = false,
) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

const STATUS_STYLES: Record<string, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  executed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  allocated: "border-emerald-200 bg-emerald-50 text-emerald-700",
  matched: "border-emerald-200 bg-emerald-50 text-emerald-700",
  posted: "border-emerald-200 bg-emerald-50 text-emerald-700",
  open: "border-emerald-200 bg-emerald-50 text-emerald-700",
  closed: "border-slate-300 bg-slate-100 text-slate-700",
  reversed: "border-violet-200 bg-violet-50 text-violet-700",
  submitted: "border-blue-200 bg-blue-50 text-blue-700",
  processing: "border-blue-200 bg-blue-50 text-blue-700",
  partial: "border-amber-200 bg-amber-50 text-amber-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  restricted: "border-amber-200 bg-amber-50 text-amber-700",
  unmatched: "border-amber-200 bg-amber-50 text-amber-700",
  mismatch: "border-rose-200 bg-rose-50 text-rose-700",
  exception: "border-rose-200 bg-rose-50 text-rose-700",
  draft: "border-slate-200 bg-slate-50 text-slate-700",
  ignored: "border-slate-200 bg-slate-50 text-slate-600",
  inactive: "border-slate-200 bg-slate-50 text-slate-500",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700",
};

export function FinanceStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "capitalize",
        STATUS_STYLES[status.toLowerCase()] ?? STATUS_STYLES.draft,
      )}
    >
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

export function FinancePager({
  page,
  canNext,
  canPrevious,
  onNext,
  onPrevious,
}: {
  page: number;
  canNext: boolean;
  canPrevious: boolean;
  onNext: () => void;
  onPrevious: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-t px-1 pt-4 text-sm text-slate-500">
      <span>Page {page}</span>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPrevious}
          disabled={!canPrevious}
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={!canNext}
        >
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function FinanceEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed bg-slate-50/60 px-6 text-center">
      <span className="mb-3 rounded-2xl border bg-white p-3 text-slate-400 shadow-sm">
        <Inbox className="h-6 w-6" />
      </span>
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  tone = "slate",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "slate" | "teal" | "amber" | "blue";
}) {
  const tones = {
    slate: "from-slate-50 to-white text-slate-900",
    teal: "from-teal-50 to-white text-teal-950",
    amber: "from-amber-50 to-white text-amber-950",
    blue: "from-blue-50 to-white text-blue-950",
  };
  return (
    <div
      className={cn(
        "rounded-2xl border bg-gradient-to-br p-4 shadow-sm",
        tones[tone],
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-bold tracking-tight">{value}</p>
      {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
    </div>
  );
}
