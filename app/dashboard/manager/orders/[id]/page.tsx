"use client";

import { useParams } from "next/navigation";
import OrderDetailsView from "@/components/orders/OrderDetailsView";

export default function ManagerOrderDetailsPage() {
  const params = useParams<{ id: string }>();

  return (
    <OrderDetailsView
      orderId={params.id}
      backHref="/dashboard/manager/orders"
      title="Order Details (Manager)"
      showManagerActions
    />
  );
}
