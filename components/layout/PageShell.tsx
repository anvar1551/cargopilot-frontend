import * as React from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Full-width page container.
 * - Uses full width on large screens.
 * - Keeps comfortable padding.
 * - Avoids max-width "boxed" layout.
 */
export default function PageShell({ children, className }: Props) {
  return (
    <div className={cn("w-full px-3 py-4 sm:px-6 sm:py-6 lg:px-8", className)}>
      {children}
    </div>
  );
}
