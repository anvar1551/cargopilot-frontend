"use client";

import { useParams } from "next/navigation";
import OrderDetailsView from "@/components/orders/OrderDetailsView";
import { getUser } from "@/lib/auth";
import { getErpOrderCapabilities } from "@/lib/orders/permissions";

export default function ManagerOrderDetailsPage() {
  const params = useParams<{ id: string }>();
  const user = getUser();

  return (
    <OrderDetailsView
      orderId={params.id}
      backHref="/dashboard/manager/orders"
      title="Order Details"
      capabilities={getErpOrderCapabilities(user)}
    />
  );
}
