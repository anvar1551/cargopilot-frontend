"use client";
import type { ReactNode } from "react";
import OrderSubmissionDialog from "@/components/workspace/OrderSubmissionDialog";
export default function BulkOrderImportDialog(props: {
  customerEntityId?: string | null;
  customerLabel?: string;
  trigger?: ReactNode;
}) {
  return (
    <OrderSubmissionDialog
      kind="import"
      customerId={props.customerEntityId}
      trigger={props.trigger}
      triggerLabel="Import CSV"
    />
  );
}
