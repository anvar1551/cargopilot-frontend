import { Suspense } from "react";
import WarehouseOperationsWorkspace from "@/components/workspace/WarehouseOperationsWorkspace";
export default function WarehousePage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6">
          Loading warehouse operations…
        </p>
      }
    >
      <WarehouseOperationsWorkspace />
    </Suspense>
  );
}
