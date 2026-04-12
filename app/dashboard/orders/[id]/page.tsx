"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { fetchOrderById } from "@/lib/orders";
import { getInvoiceUrl, getLabelUrl } from "@/lib/documents";
import { getUser } from "@/lib/auth";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PageShell from "@/components/layout/PageShell";

function prettyStatus(status: string) {
  return String(status || "").replaceAll("_", " ");
}

export default function SharedOrderDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const user = getUser();

  const {
    data: order,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["order", id],
    queryFn: () => fetchOrderById(id),
    enabled: !!id,
  });

  if (isLoading) return <div className="p-6">Loading order...</div>;
  if (error) return <div className="p-6">Failed to load order</div>;
  if (!order) return <div className="p-6">Order not found</div>;

  const openLabel = async () => {
    const url = await getLabelUrl(order.id);
    window.open(url, "_blank");
  };

  const openInvoice = async () => {
    const invoiceId = order.invoice?.id ?? order.Invoice?.id;
    if (!invoiceId) return;
    const url = await getInvoiceUrl(invoiceId);
    window.open(url, "_blank");
  };

  const role = user?.role;
  const backHref =
    role === "manager"
      ? "/dashboard/manager/orders"
      : role === "warehouse"
        ? "/dashboard/warehouse"
        : role === "driver"
          ? "/dashboard/driver"
          : "/dashboard/customer/orders";

  const invoice = order.invoice ?? order.Invoice;

  return (
    <PageShell>
      <div className="w-full space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Order</h1>
            <p className="text-sm text-muted-foreground">{order.orderNumber ? `Order #${order.orderNumber}` : "Shipment details"}</p>
          </div>

          <Button asChild variant="outline">
            <Link href={backHref}>Back</Link>
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              Details
              <Badge variant="outline" className="capitalize">
                {prettyStatus(order.status)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="font-medium">From:</span> {order.pickupAddress}
            </div>
            <div>
              <span className="font-medium">To:</span> {order.dropoffAddress}
            </div>
            <div>
              <span className="font-medium">Customer:</span> {order.customer?.email ?? "-"}
            </div>
            <div>
              <span className="font-medium">Driver:</span> {order.assignedDriver?.email ?? "-"}
            </div>
            <div>
              <span className="font-medium">Warehouse:</span> {order.currentWarehouse?.name ?? "-"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            {order.tracking?.length ? (
              <ol className="space-y-3">
                {order.tracking.map(
                  (t: {
                    id: string;
                    status?: string | null;
                    timestamp?: string | null;
                    warehouse?: { name?: string | null } | null;
                    region?: string | null;
                  }) => (
                    <li key={t.id} className="text-sm">
                      <div className="font-medium capitalize">{prettyStatus(t.status || "")}</div>
                      <div className="text-muted-foreground">
                        {t.timestamp ? new Date(t.timestamp).toLocaleString() : "-"}
                        {t.warehouse?.name ? ` • ${t.warehouse.name}` : ""}
                        {t.region ? ` • ${t.region}` : ""}
                      </div>
                    </li>
                  ),
                )}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">No tracking yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Documents</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={openLabel} disabled={!order.labelUrl}>
              Shipping label
            </Button>

            <Button
              variant="outline"
              onClick={openInvoice}
              disabled={!invoice?.id || !invoice?.invoiceUrl}
            >
              Invoice
            </Button>

            {invoice?.paymentUrl && invoice?.status !== "paid" ? (
              <Button asChild>
                <a href={invoice.paymentUrl} target="_blank" rel="noreferrer">
                  Pay now
                </a>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {role === "manager" ? (
              <Button variant="outline" onClick={() => router.push("/dashboard/manager/dispatch")}>
                Open task dispatch
              </Button>
            ) : null}
            <div className="text-sm text-muted-foreground">
              Operational updates are task-based now. Use dispatch center / driver task flow.
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

