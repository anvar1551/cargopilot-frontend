"use client";

import { useParams } from "next/navigation";
import OrderDetailsView from "@/components/orders/OrderDetailsView";

export default function WarehouseOrderDetailsPage() {
  const params = useParams<{ id: string }>();

  return (
    <OrderDetailsView
      orderId={params.id}
      backHref="/dashboard/warehouse"
      title="Order Details (Warehouse)"
      showManagerActions={false}
    />
  );
}
