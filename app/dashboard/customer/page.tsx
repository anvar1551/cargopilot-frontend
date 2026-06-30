"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  CreditCard,
  Headphones,
  Mail,
  MapPin,
  Package,
  Phone,
  ReceiptText,
  ShieldCheck,
  Truck,
} from "lucide-react";

import { fetchAddresses, formatAddress, type Address } from "@/lib/addresses";
import { getPrimaryCustomerEntityId, getUser } from "@/lib/auth";
import { getCustomerById, type CustomerEntity } from "@/lib/customers";
import {
  fetchOrders,
  type OrderStatus,
  type OrdersResponse,
} from "@/lib/orders";
import { READ_ONLY_ORDER_CAPABILITIES } from "@/lib/orders/permissions";

import BulkOrderImportDialog from "@/components/orders/BulkOrderImportDialog";
import CreateOrderDialog from "@/components/orders/CreateOrderDialog";
import OrdersTable, {
  type OrderTableRow,
} from "@/components/orders/OrderTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type InvoiceState = {
  invoiceUrl?: string | null;
  paymentUrl?: string | null;
  status?: string | null;
};

type CustomerOrder = {
  id: string;
  orderNumber?: string | number | null;
  status?: OrderStatus | string | null;
  paymentState?: string | null;
  createdAt?: string | null;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  destinationCity?: string | null;
  labelUrl?: string | null;
  invoice?: InvoiceState | null;
  Invoice?: InvoiceState | null;
  senderName?: string | null;
  senderPhone?: string | null;
  receiverName?: string | null;
  receiverPhone?: string | null;
  customer?: {
    name?: string | null;
    email?: string | null;
  } | null;
  customerEntity?: {
    id?: string | null;
    name?: string | null;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    type?: string | null;
  } | null;
};

const FINAL_STATUSES = new Set(["delivered", "returned", "cancelled"]);
const EXCEPTION_STATUSES = new Set(["exception", "return_in_progress"]);

function isFinalStatus(status?: string | null) {
  return FINAL_STATUSES.has(String(status ?? ""));
}

function isExceptionStatus(status?: string | null) {
  return EXCEPTION_STATUSES.has(String(status ?? ""));
}

function hasPaymentPending(order: CustomerOrder) {
  const invoice = order.invoice ?? order.Invoice;
  return Boolean(invoice?.paymentUrl) && invoice?.status !== "paid";
}

function isPaid(order: CustomerOrder) {
  const invoice = order.invoice ?? order.Invoice;
  return (
    invoice?.status === "paid" ||
    String(order.paymentState ?? "").toLowerCase() === "paid"
  );
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function customerDisplayName(
  customer: CustomerEntity | null | undefined,
  fallback: string,
) {
  return customer?.companyName || customer?.name || fallback;
}

function toOrderTableRows(orders: CustomerOrder[]): OrderTableRow[] {
  return orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status ?? null,
    paymentState: order.paymentState ?? null,
    pickupAddress: order.pickupAddress ?? null,
    dropoffAddress: order.dropoffAddress ?? null,
    createdAt: order.createdAt ?? null,
    labelUrl: order.labelUrl ?? null,
    invoice: order.invoice ?? null,
    Invoice: order.Invoice ?? null,
    senderName: order.senderName ?? null,
    senderPhone: order.senderPhone ?? null,
    receiverName: order.receiverName ?? null,
    receiverPhone: order.receiverPhone ?? null,
    customer: order.customer ?? null,
    customerEntity: order.customerEntity ?? null,
  }));
}

function MetricCard({
  title,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string | number;
  hint: string;
  icon: typeof Package;
  tone: string;
}) {
  return (
    <Card className="rounded-3xl border-slate-200/80 shadow-sm shadow-black/5">
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function AddressCard({ address }: { address: Address }) {
  const rendered =
    formatAddress(address) ||
    [address.street, address.city, address.country]
      .filter(Boolean)
      .join(", ") ||
    "Saved address";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-black/5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
          <MapPin className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-slate-950">
              {address.city || address.country || "Address"}
            </p>
            {address.addressType ? (
              <Badge variant="outline">{address.addressType}</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-600">{rendered}</p>
          {address.latitude != null && address.longitude != null ? (
            <p className="mt-2 text-xs text-slate-400">
              {address.latitude.toFixed(5)}, {address.longitude.toFixed(5)}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LoadingWorkspace() {
  return (
    <div className="w-full space-y-6 p-4 sm:p-6 lg:p-8">
      <Skeleton className="h-56 rounded-[2rem]" />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-3xl" />
        ))}
      </div>
      <Skeleton className="h-[480px] rounded-3xl" />
    </div>
  );
}

export default function CustomerDashboard() {
  const user = useMemo(() => getUser(), []);
  const customerEntityId = getPrimaryCustomerEntityId(user);

  const ordersQuery = useQuery<OrdersResponse>({
    queryKey: ["orders", "customer-workspace"],
    queryFn: () => fetchOrders({ limit: 100, mode: "cursor" }),
  });

  const customerQuery = useQuery({
    queryKey: ["customer", customerEntityId],
    queryFn: () => getCustomerById(customerEntityId!),
    enabled: Boolean(customerEntityId),
    staleTime: 60_000,
  });

  const addressesQuery = useQuery({
    queryKey: ["addresses", "customer-workspace", customerEntityId ?? "self"],
    queryFn: ({ signal }) =>
      fetchAddresses(
        customerEntityId ? { customerEntityId, limit: 12 } : { limit: 12 },
        signal,
      ),
    staleTime: 60_000,
  });

  const orders = useMemo(
    () => (ordersQuery.data?.orders ?? []) as CustomerOrder[],
    [ordersQuery.data],
  );
  const recentOrders = useMemo(() => orders.slice(0, 8), [orders]);
  const orderRows = useMemo(
    () => toOrderTableRows(recentOrders),
    [recentOrders],
  );

  const activeOrders = orders.filter(
    (order) => !isFinalStatus(order.status),
  ).length;
  const deliveredOrders = orders.filter(
    (order) => order.status === "delivered",
  ).length;
  const paymentPending = orders.filter(hasPaymentPending).length;
  const exceptions = orders.filter((order) =>
    isExceptionStatus(order.status),
  ).length;
  const paidOrders = orders.filter(isPaid).length;
  const customer = customerQuery.data ?? null;
  const displayName = customerDisplayName(customer, user?.name || "Customer");

  if (ordersQuery.isLoading) return <LoadingWorkspace />;

  return (
    <div className="w-full space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-200/70 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-900 p-6 text-white shadow-sm shadow-black/10 lg:p-8">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.28),transparent_44%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.14),transparent_42%)]" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <Badge className="mb-4 border-white/20 bg-white/10 text-slate-100 hover:bg-white/15">
              Customer ERP Workspace
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {displayName}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200/90">
              Customer profile, shipment pipeline, address book, payment
              exposure, and support context in one operational workspace.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-200/80">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                {customer?.type ?? "Customer"}
              </span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                {customer?.email || user?.email || "No email"}
              </span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                {customer?.phone || "No phone"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <CreateOrderDialog
              triggerLabel="New shipment"
              presetCustomerEntityId={customerEntityId}
              presetCustomerEntityLabel={displayName}
              lockCustomerEntitySelection
              triggerClassName="rounded-2xl bg-white px-5 text-slate-950 hover:bg-slate-100"
            />
            {customerEntityId ? (
              <BulkOrderImportDialog
                customerEntityId={customerEntityId}
                customerLabel={displayName}
                trigger={
                  <Button
                    variant="outline"
                    className="rounded-2xl border-white/25 bg-white/10 px-5 text-white hover:bg-white/20 hover:text-white"
                  >
                    Bulk import
                  </Button>
                }
              />
            ) : null}
            <Button
              asChild
              variant="outline"
              className="rounded-2xl border-white/25 bg-white/10 px-5 text-white hover:bg-white/20 hover:text-white"
            >
              <Link href="/dashboard/customer/orders">All orders</Link>
            </Button>
          </div>
        </div>
      </section>

      {!customerEntityId ? (
        <Card className="rounded-3xl border-amber-200 bg-amber-50 text-amber-900">
          <CardContent className="flex items-start gap-3 p-5 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Customer entity is not linked</p>
              <p className="mt-1 text-amber-800/80">
                This account can open the portal, but address book and bulk
                import need a customer entity scope or direct customerEntityId.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Active shipments"
          value={activeOrders}
          hint="Not in final status"
          icon={Truck}
          tone="bg-blue-50 text-blue-700"
        />
        <MetricCard
          title="Delivered"
          value={deliveredOrders}
          hint="Closed successfully"
          icon={ShieldCheck}
          tone="bg-emerald-50 text-emerald-700"
        />
        <MetricCard
          title="Payment pending"
          value={paymentPending}
          hint={`${paidOrders} paid in loaded scope`}
          icon={CreditCard}
          tone="bg-amber-50 text-amber-700"
        />
        <MetricCard
          title="Needs attention"
          value={exceptions}
          hint="Exception or return flow"
          icon={AlertTriangle}
          tone="bg-rose-50 text-rose-700"
        />
      </div>

      <Tabs defaultValue="shipments" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl border bg-white p-1 shadow-sm shadow-black/5 md:grid-cols-5">
          <TabsTrigger
            value="profile"
            className="rounded-xl py-2 data-[state=active]:bg-slate-950 data-[state=active]:text-white"
          >
            Profile
          </TabsTrigger>
          <TabsTrigger
            value="shipments"
            className="rounded-xl py-2 data-[state=active]:bg-slate-950 data-[state=active]:text-white"
          >
            Shipments
          </TabsTrigger>
          <TabsTrigger
            value="payments"
            className="rounded-xl py-2 data-[state=active]:bg-slate-950 data-[state=active]:text-white"
          >
            Payments
          </TabsTrigger>
          <TabsTrigger
            value="addresses"
            className="rounded-xl py-2 data-[state=active]:bg-slate-950 data-[state=active]:text-white"
          >
            Addresses
          </TabsTrigger>
          <TabsTrigger
            value="support"
            className="rounded-xl py-2 data-[state=active]:bg-slate-950 data-[state=active]:text-white"
          >
            Support
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="rounded-3xl border-slate-200/80 shadow-sm shadow-black/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-cyan-700" />
                  Customer profile
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <Info label="Display name" value={displayName} />
                <Info label="Type" value={customer?.type ?? "-"} />
                <Info
                  label="Email"
                  value={customer?.email || user?.email || "-"}
                />
                <Info label="Phone" value={customer?.phone || "-"} />
                <Info label="Tax ID" value={customer?.taxId || "-"} />
                <Info label="Created" value={formatDate(customer?.createdAt)} />
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-slate-200/80 shadow-sm shadow-black/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ReceiptText className="h-5 w-5 text-cyan-700" />
                  Commercial context
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-600">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-medium text-slate-950">
                    Pricing and tariffs
                  </p>
                  <p className="mt-1">
                    Customer-specific tariff assignment will appear here when
                    the pricing API exposes customer plan lookup.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-medium text-slate-950">
                    Account ownership
                  </p>
                  <p className="mt-1">
                    This workspace is scoped by customer entity, not old app
                    role logic.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="shipments" className="space-y-4">
          <Card className="rounded-3xl border-slate-200/80 shadow-sm shadow-black/5">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Shipment pipeline</CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  Recent customer shipments with read-only ERP-safe actions.
                </p>
              </div>
              <Button asChild variant="outline" className="rounded-2xl">
                <Link href="/dashboard/customer/orders">
                  Open full order list
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {ordersQuery.isError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  Failed to load shipments.
                </div>
              ) : (
                <OrdersTable
                  data={orderRows}
                  capabilities={READ_ONLY_ORDER_CAPABILITIES}
                  detailsBasePath="/dashboard/customer/orders"
                  hideSearch
                  hideQuickFilters
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <MetricCard
              title="Payment pending"
              value={paymentPending}
              hint="Orders with active payment link"
              icon={CreditCard}
              tone="bg-amber-50 text-amber-700"
            />
            <MetricCard
              title="Paid orders"
              value={paidOrders}
              hint="Loaded customer scope"
              icon={ReceiptText}
              tone="bg-emerald-50 text-emerald-700"
            />
            <MetricCard
              title="Total loaded"
              value={orders.length}
              hint="Current dashboard query"
              icon={Package}
              tone="bg-slate-100 text-slate-700"
            />
          </div>
          <Card className="rounded-3xl border-slate-200/80 shadow-sm shadow-black/5">
            <CardHeader>
              <CardTitle>Payment actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {orders
                .filter(hasPaymentPending)
                .slice(0, 5)
                .map((order) => (
                  <Link
                    key={order.id}
                    href={`/dashboard/customer/orders/${order.id}`}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50"
                  >
                    <div>
                      <p className="font-medium text-slate-950">
                        #{order.orderNumber || order.id.slice(0, 8)}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {order.pickupAddress || "-"} {"->"}{" "}
                        {order.dropoffAddress || "-"}
                      </p>
                    </div>
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                      Pay now
                    </Badge>
                  </Link>
                ))}
              {paymentPending === 0 ? (
                <p className="rounded-2xl border border-dashed p-6 text-sm text-slate-500">
                  No pending customer payment actions.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="addresses" className="space-y-4">
          <Card className="rounded-3xl border-slate-200/80 shadow-sm shadow-black/5">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Address book</CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  Saved pickup and delivery addresses used during shipment
                  creation.
                </p>
              </div>
              <CreateOrderDialog
                triggerLabel="Save through shipment"
                presetCustomerEntityId={customerEntityId}
                presetCustomerEntityLabel={displayName}
                lockCustomerEntitySelection
                triggerClassName="rounded-2xl"
              />
            </CardHeader>
            <CardContent>
              {addressesQuery.isLoading ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <Skeleton className="h-28 rounded-2xl" />
                  <Skeleton className="h-28 rounded-2xl" />
                </div>
              ) : addressesQuery.data?.length ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {addressesQuery.data.map((address) => (
                    <AddressCard key={address.id} address={address} />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">
                  No saved addresses yet. Create a shipment and enable address
                  saving to build the address book.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="support" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
            <Card className="rounded-3xl border-slate-200/80 shadow-sm shadow-black/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Headphones className="h-5 w-5 text-cyan-700" />
                  Support context
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-600">
                <p>
                  Use support for pickup problems, delivery timing, payment
                  questions, invoice requests, and address corrections.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <a
                    href="tel:+998000000000"
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 hover:bg-slate-50"
                  >
                    <Phone className="h-4 w-4 text-cyan-700" /> Call support
                  </a>
                  <a
                    href="mailto:support@cargopilot.com"
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 hover:bg-slate-50"
                  >
                    <Mail className="h-4 w-4 text-cyan-700" /> Email support
                  </a>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-slate-200/80 shadow-sm shadow-black/5">
              <CardHeader>
                <CardTitle>Attention queue</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {orders
                  .filter((order) => isExceptionStatus(order.status))
                  .slice(0, 4)
                  .map((order) => (
                    <Link
                      key={order.id}
                      href={`/dashboard/customer/orders/${order.id}`}
                      className="block rounded-2xl border border-rose-100 bg-rose-50/70 p-4 hover:bg-rose-50"
                    >
                      <p className="font-medium text-rose-950">
                        #{order.orderNumber || order.id.slice(0, 8)}
                      </p>
                      <p className="mt-1 text-sm text-rose-800/80">
                        Status:{" "}
                        {String(order.status ?? "exception").replaceAll(
                          "_",
                          " ",
                        )}
                      </p>
                    </Link>
                  ))}
                {exceptions === 0 ? (
                  <p className="rounded-2xl border border-dashed p-6 text-sm text-slate-500">
                    No exception shipments in the loaded scope.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 break-words font-medium text-slate-950">{value}</p>
    </div>
  );
}
