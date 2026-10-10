"use client";

import { useParams } from "next/navigation";
import OrderDetailsView from "@/components/orders/OrderDetailsView";
import { READ_ONLY_ORDER_CAPABILITIES } from "@/lib/orders/permissions";

export default function CustomerOrderDetailsPage() {
  const params = useParams<{ id: string }>();
  return (
    <OrderDetailsView
      orderId={params.id}
      backHref="/dashboard/customer/orders"
      title="Order Details"
      capabilities={READ_ONLY_ORDER_CAPABILITIES}
    />
  );
}
