"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

export function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <div className="mt-1 flex items-center gap-2 text-xs text-destructive">
      <AlertCircle className="h-4 w-4" />
      <span>{msg}</span>
    </div>
  );
}

export function IconField({
  icon,
  error,
  children,
}: {
  icon: React.ReactNode;
  error?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cx(
        "group relative flex items-center rounded-2xl border bg-background/70 backdrop-blur",
        "transition-all",
        "focus-within:ring-2 focus-within:ring-primary/25 focus-within:border-primary/50",
        "focus-within:shadow-[0_22px_70px_-40px_rgba(0,0,0,0.55)]",
        "hover:border-border/80",
        error ? "border-destructive/60" : "border-border/60",
      )}
    >
      <div className="pointer-events-none pl-3 text-muted-foreground transition-colors group-focus-within:text-primary">
        {icon}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
