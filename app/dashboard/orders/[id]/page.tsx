"use client";

import { useParams } from "next/navigation";

import OrderDetailsView from "@/components/orders/OrderDetailsView";
import { getUser } from "@/lib/auth";
import { getErpOrderCapabilities } from "@/lib/orders/permissions";

function resolveBackHref(capabilities: ReturnType<typeof getErpOrderCapabilities>) {
  if (
    capabilities.canAssignDriver ||
    capabilities.canBookCarrier ||
    capabilities.canDelete ||
    capabilities.canReadPayments ||
    capabilities.canSettleCash
  ) {
    return "/dashboard/manager/orders";
  }

  if (capabilities.canChangeStatus || capabilities.canHandleWarehouseCash) {
    return "/dashboard/warehouse";
  }

  return "/dashboard/customer/orders";
}

export default function SharedOrderDetailsPage() {
  const params = useParams<{ id: string }>();
  const user = getUser();
  const capabilities = getErpOrderCapabilities(user);

  return (
    <OrderDetailsView
      orderId={params.id}
      backHref={resolveBackHref(capabilities)}
      title="Order Details"
      capabilities={capabilities}
    />
  );
}
