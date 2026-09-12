"use client";

import { useParams } from "next/navigation";
import OrderDetailsView from "@/components/orders/OrderDetailsView";
import { getUser } from "@/lib/auth";
import { getWarehouseOrderCapabilities } from "@/lib/orders/permissions";

export default function WarehouseOrderDetailsPage() {
  const params = useParams<{ id: string }>();
  const user = getUser();

  return (
    <OrderDetailsView
      orderId={params.id}
      backHref="/dashboard/warehouse"
      title="Order Details"
      capabilities={getWarehouseOrderCapabilities(user)}
    />
  );
}
