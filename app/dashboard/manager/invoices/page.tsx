import InvoiceWorkspace from "@/components/workspace/InvoiceWorkspace";
import { Suspense } from "react";
export default function InvoicesPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6">
          Loading invoices…
        </p>
      }
    >
      <InvoiceWorkspace />
    </Suspense>
  );
}
