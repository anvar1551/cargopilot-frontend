import { CircleAlert, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function WorkspaceState({
  kind,
  title,
  description,
  onRetry,
}: {
  kind: "loading" | "empty" | "error" | "denied";
  title: string;
  description?: string;
  onRetry?: () => void;
}) {
  const Icon =
    kind === "loading"
      ? LoaderCircle
      : kind === "denied"
        ? ShieldCheck
        : CircleAlert;
  return (
    <div
      className="workspace-state"
      role={kind === "error" ? "alert" : "status"}
    >
      <Icon
        aria-hidden="true"
        className={`h-7 w-7 text-muted-foreground ${kind === "loading" ? "motion-safe:animate-spin" : ""}`}
      />
      <h2 className="text-base font-semibold">{title}</h2>
      {description && (
        <p className="max-w-lg text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      )}
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Refresh records
        </Button>
      )}
    </div>
  );
}
