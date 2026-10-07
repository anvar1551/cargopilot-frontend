"use client";
import OrderSubmissionDialog from "@/components/workspace/OrderSubmissionDialog";
export default function CreateOrderDialog(props: {
  mode?: "operations" | "customer" | "manager";
  presetCustomerEntityId?: string | null;
  presetCustomerEntityLabel?: string | null;
  lockCustomerEntitySelection?: boolean;
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  return (
    <OrderSubmissionDialog
      customerId={props.presetCustomerEntityId}
      lockCustomer={props.lockCustomerEntitySelection}
      triggerLabel={props.triggerLabel}
      triggerClassName={props.triggerClassName}
    />
  );
}
