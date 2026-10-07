"use client";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { authContext, authEpoch, hasPermission } from "@/lib/auth";
import { useWorkspaceSession, workspaceError } from "@/lib/workspace";
import {
  listWorkspaceCustomers,
  listWorkspaceAddresses,
} from "@/lib/customer-workspace";
import {
  createInWorkspace,
  finishCreation,
  pendingCreation,
  previewInWorkspace,
  templateInWorkspace,
} from "@/lib/order-workspace";
import type { CreationIntent } from "@/lib/creation-intent";
import { SERVICE_TYPES } from "@/lib/orders/service-types";
import { formatAddress } from "@/lib/addresses";

export default function OrderSubmissionDialog({
  kind = "order",
  customerId,
  trigger,
  triggerLabel = "Create shipment",
  triggerClassName,
  lockCustomer = false,
}: {
  kind?: CreationIntent["kind"];
  customerId?: string | null;
  trigger?: ReactNode;
  triggerLabel?: string;
  triggerClassName?: string;
  lockCustomer?: boolean;
}) {
  const session = useWorkspaceSession();
  const [open, setOpen] = useState(false);
  if (!session.context || !hasPermission(session.user, "shipment.create"))
    return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className={triggerClassName}>{triggerLabel}</Button>
        )}
      </DialogTrigger>
      {open && (
        <Submission
          key={session.epoch}
          context={session.context}
          kind={kind}
          initialCustomer={customerId ?? ""}
          lockCustomer={lockCustomer}
          close={() => setOpen(false)}
        />
      )}
    </Dialog>
  );
}
function Submission({
  context,
  kind,
  initialCustomer,
  close,
  lockCustomer,
}: {
  context: string;
  kind: CreationIntent["kind"];
  initialCustomer: string;
  close: () => void;
  lockCustomer: boolean;
}) {
  const cache = useQueryClient();
  const session = useWorkspaceSession();
  const pathname = usePathname();
  const detailBase = pathname.startsWith("/dashboard/customer")
    ? "/dashboard/customer/orders"
    : pathname.startsWith("/dashboard/warehouse")
      ? "/dashboard/warehouse/orders"
      : "/dashboard/manager/orders";
  const mounted = useRef(true);
  const fileSequence = useRef(0);
  const [stored, setStored] = useState<CreationIntent | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [storageReady, setStorageReady] = useState(false);
  const [customerId, setCustomerId] = useState(initialCustomer),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState("");
  const [pickup, setPickup] = useState(""),
    [dropoff, setDropoff] = useState(""),
    [senderId, setSenderId] = useState(""),
    [receiverId, setReceiverId] = useState("");
  const [csv, setCsv] = useState(""),
    [fileName, setFileName] = useState("");
  const [template, setTemplate] = useState("");
  const [preview, setPreview] = useState<Awaited<
    ReturnType<typeof previewInWorkspace>
  > | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const readIntent = () => {
    try {
      setStored(pendingCreation(context, kind));
      setStorageReady(true);
    } catch {
      setError("Recovery storage is unavailable. Submission is disabled.");
      setStorageReady(false);
    }
  };
  useEffect(() => {
    readIntent();
    const listener = () => readIntent();
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, [context, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const customers = useQuery({
    queryKey: ["customer-workspace", context, "order-selection", query],
    queryFn: ({ signal }) =>
      listWorkspaceCustomers(context, { q: query, page: 1 }, signal),
    enabled: hasPermission(session.user, "customers.read"),
    retry: false,
  });
  const addresses = useQuery({
    queryKey: ["customer-workspace", context, "order-addresses", customerId],
    queryFn: ({ signal }) =>
      listWorkspaceAddresses(context, customerId, "", signal),
    enabled:
      Boolean(customerId) && hasPermission(session.user, "customers.read"),
    retry: false,
  });
  const frozen = Boolean(stored) || busy || !storageReady;
  async function run(work: () => Promise<void>) {
    const epoch = authEpoch();
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      if (mounted.current && authContext() === context && authEpoch() === epoch)
        setError(workspaceError(e));
    } finally {
      if (
        mounted.current &&
        authContext() === context &&
        authEpoch() === epoch
      ) {
        setBusy(false);
        readIntent();
      }
    }
  }
  async function send(payload: unknown | null) {
    const epoch = authEpoch();
    const receipt = await createInWorkspace(context, kind, payload);
    if (!mounted.current || authContext() !== context || authEpoch() !== epoch)
      return;
    setStored(receipt);
    await Promise.all([
      cache.invalidateQueries({ queryKey: ["orders"] }),
      cache.invalidateQueries({ queryKey: ["orders-cursor"] }),
      cache.invalidateQueries({ queryKey: ["customer-workspace", context] }),
    ]);
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    void run(() =>
      send(
        kind === "import"
          ? { csvText: csv, customerEntityId: customerId || null }
          : {
              customerEntityId: customerId || null,
              sender: {
                name: String(data.get("senderName") ?? "").trim(),
                phone: String(data.get("senderPhone") ?? "").trim(),
              },
              receiver: {
                name: String(data.get("receiverName") ?? "").trim(),
                phone: String(data.get("receiverPhone") ?? "").trim(),
              },
              addresses: {
                pickupAddress: pickup.trim(),
                dropoffAddress: dropoff.trim(),
                destinationCity: String(data.get("city") ?? "").trim(),
                senderAddressId: senderId || null,
                receiverAddressId: receiverId || null,
              },
              shipment: {
                serviceType: data.get("serviceType"),
                weightKg: Number(data.get("weight")),
                pieceTotal: Number(data.get("pieces")),
                currency: data.get("currency"),
                codEnabled: false,
              },
              reference: {
                referenceId: String(data.get("referenceId") ?? "").trim(),
              },
              note: String(data.get("note") ?? "").trim(),
            },
      ),
    );
  }
  function selectAddress(id: string, side: "sender" | "receiver") {
    const a = addresses.data?.find((v) => v.id === id);
    if (side === "sender") {
      setSenderId(id);
      setPickup(a ? formatAddress(a) : "");
    } else {
      setReceiverId(id);
      setDropoff(a ? formatAddress(a) : "");
    }
  }
  return (
    <DialogContent className="max-h-[90dvh] overflow-y-auto bg-white sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>
          {kind === "import" ? "Import shipments" : "Create shipment"}
        </DialogTitle>
        <DialogDescription>
          Selected-company ownership is verified by the server. Creation does
          not accept a financial price or complete downstream processing.
        </DialogDescription>
      </DialogHeader>
      {stored && (
        <section
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm"
          role="status"
        >
          <p className="font-semibold">
            {stored.state === "confirmed"
              ? "Creation confirmed"
              : stored.state === "conflict"
                ? "Conflicting operation — review required"
                : "Unconfirmed result — keep the original intent"}
          </p>
          <p className="mt-2 break-all">Operation {stored.operationId}</p>
          <details className="mt-2">
            <summary className="cursor-pointer">
              Original immutable content
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded border bg-white p-2 text-xs">
              {JSON.stringify(stored.payload, null, 2)}
            </pre>
          </details>
          {stored.state !== "confirmed" && (
            <p className="mt-2">
              {kind === "import"
                ? "Some rows may already be committed. The failed response does not identify them. Resume the original batch; the server skips completed rows."
                : "An order may already exist. Retry only the original request to obtain its authorized receipt."}
            </p>
          )}
          {stored.orders && (
            <ul className="mt-2 space-y-1">
              {stored.orders.map((o, index) => (
                <li key={o.id}>
                  Confirmed {kind === "import" ? `item ${index + 1}` : "order"}:{" "}
                  <Link className="underline" href={`${detailBase}/${o.id}`}>
                    {o.orderNumber ?? o.id}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {stored.state === "confirmed" && (
            <p className="mt-2">
              {stored.orders?.length} confirmed; {stored.replayedRows ?? 0}{" "}
              existing rows returned. Labels, carrier booking and
              pricing-component completion are separate; downstream recovery may
              be required.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {stored.state !== "conflict" && (
              <Button
                disabled={busy}
                variant="outline"
                onClick={() => void run(() => send(null))}
              >
                {stored.state === "confirmed"
                  ? "Verify original receipt"
                  : "Retry original intent"}
              </Button>
            )}
            {stored.state === "confirmed" && (
              <Button
                disabled={busy}
                onClick={() => {
                  try {
                    finishCreation(context, kind);
                    setStored(null);
                    setCsv("");
                    setPreview(null);
                  } catch {
                    setError("Confirmed recovery record could not be cleared.");
                  }
                }}
              >
                Start a new action
              </Button>
            )}
          </div>
        </section>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      <form onSubmit={submit} className="space-y-4">
        <fieldset disabled={frozen} className="space-y-4">
          <div>
            <Label htmlFor="order-customer-search">
              Find customer (optional)
            </Label>
            <Input
              id="order-customer-search"
              value={search}
              maxLength={200}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-1"
            />
            <select
              aria-label="Selected customer"
              disabled={lockCustomer && Boolean(initialCustomer)}
              className="mt-2 h-10 w-full rounded-md border px-3"
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                setSenderId("");
                setReceiverId("");
                setPreview(null);
              }}
            >
              <option value="">Free-text shipment — no customer master</option>
              {initialCustomer &&
                !customers.data?.data.some((c) => c.id === initialCustomer) && (
                  <option value={initialCustomer}>
                    Selected customer {initialCustomer.slice(-8)}
                  </option>
                )}
              {customers.data?.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.companyName ?? ""}
                </option>
              ))}
            </select>
            {customers.error && (
              <p className="mt-1 text-sm">
                Customer selection unavailable; existing object permissions
                apply.
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Search returns at most 20 accessible customers. Structured
              addresses must belong to this customer.
            </p>
          </div>
          {kind === "order" ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {(["sender", "receiver"] as const).map((side) => (
                  <div key={side} className="space-y-2">
                    <Label htmlFor={`${side}-name`}>
                      {side === "sender" ? "Sender" : "Recipient"} name
                    </Label>
                    <Input
                      id={`${side}-name`}
                      name={`${side}Name`}
                      maxLength={200}
                    />
                    <Label htmlFor={`${side}-phone`}>Phone</Label>
                    <Input
                      id={`${side}-phone`}
                      name={`${side}Phone`}
                      maxLength={100}
                    />
                    {customerId && (
                      <select
                        aria-label={`${side} saved address`}
                        className="h-10 w-full rounded-md border px-3"
                        value={side === "sender" ? senderId : receiverId}
                        onChange={(e) => selectAddress(e.target.value, side)}
                      >
                        <option value="">Use free text</option>
                        {addresses.data?.map((a) => (
                          <option key={a.id} value={a.id}>
                            {formatAddress(a)}
                          </option>
                        ))}
                      </select>
                    )}
                    <Label htmlFor={`${side}-address`}>
                      {side === "sender" ? "Pickup" : "Delivery"} address *
                    </Label>
                    <Input
                      id={`${side}-address`}
                      value={side === "sender" ? pickup : dropoff}
                      required
                      minLength={3}
                      maxLength={2048}
                      onChange={(e) => {
                        if (side === "sender") {
                          setPickup(e.target.value);
                          setSenderId("");
                        } else {
                          setDropoff(e.target.value);
                          setReceiverId("");
                        }
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Destination city" name="city" />
                <Field
                  label="Weight (kg)"
                  name="weight"
                  type="number"
                  value="1"
                />
                <Field
                  label="Parcel count"
                  name="pieces"
                  type="number"
                  value="1"
                />
                <div>
                  <Label htmlFor="serviceType">Service</Label>
                  <select
                    id="serviceType"
                    name="serviceType"
                    className="mt-1 h-10 w-full rounded-md border px-3"
                  >
                    {SERVICE_TYPES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="currency">Requested currency</Label>
                  <select
                    id="currency"
                    name="currency"
                    className="mt-1 h-10 w-full rounded-md border px-3"
                  >
                    {["UZS", "USD", "CNY"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <Field label="Reference" name="referenceId" />
              </div>
              <Field label="Operational note" name="note" />
              <p className="text-xs text-muted-foreground">
                Merchant COD and client charges/paid states are unavailable.
                Server quote estimates are not accepted prices; payer and
                payment instructions require their separate approved workflow.
              </p>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  void run(async () => {
                    const epoch = authEpoch();
                    const blob = await templateInWorkspace(context);
                    const content = await blob.text();
                    if (
                      !mounted.current ||
                      authContext() !== context ||
                      authEpoch() !== epoch
                    )
                      return;
                    setTemplate(content);
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "order-import-template-v1.csv";
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  })
                }
              >
                Download CSV template
              </Button>
              {template && (
                <details open className="rounded-md border p-3 text-sm">
                  <summary>
                    Server template — copy if download is unavailable
                  </summary>
                  <textarea
                    aria-label="Server CSV template"
                    readOnly
                    value={template}
                    className="mt-2 h-24 w-full rounded border p-2 font-mono text-xs"
                  />
                </details>
              )}
              <Label htmlFor="import-file">
                CSV file (up to 1 MiB / 100 rows)
              </Label>
              <Input
                id="import-file"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  const sequence = ++fileSequence.current;
                  if (!file) return;
                  const epoch = authEpoch();
                  setPreview(null);
                  if (file.size > 1024 * 1024) {
                    setError("CSV exceeds 1 MiB");
                    return;
                  }
                  void file
                    .text()
                    .then((text) => {
                      if (
                        mounted.current &&
                        fileSequence.current === sequence &&
                        authContext() === context &&
                        authEpoch() === epoch
                      ) {
                        setCsv(text);
                        setFileName(file.name);
                      }
                    })
                    .catch(() => {
                      if (
                        mounted.current &&
                        fileSequence.current === sequence &&
                        authContext() === context &&
                        authEpoch() === epoch
                      )
                        setError(
                          "The CSV file could not be read. Nothing was submitted.",
                        );
                    });
                }}
              />
              {fileName && <p className="text-sm">{fileName}</p>}
              <Label htmlFor="csv-content">Original CSV content</Label>
              <textarea
                id="csv-content"
                className="h-36 w-full rounded-md border p-3 font-mono text-xs"
                value={csv}
                maxLength={1048576}
                onChange={(e) => {
                  ++fileSequence.current;
                  setCsv(e.target.value);
                  setPreview(null);
                }}
              />
              <Button
                type="button"
                disabled={!csv}
                variant="outline"
                onClick={() =>
                  void run(async () => {
                    const v = await previewInWorkspace(context, {
                      csvText: csv,
                      customerEntityId: customerId || null,
                    });
                    if (mounted.current) setPreview(v);
                  })
                }
              >
                Validate original CSV
              </Button>
              {preview && (
                <section
                  role="status"
                  className="rounded-md border p-3 text-sm"
                >
                  <p>
                    {preview.validRows} valid / {preview.totalRows} rows;{" "}
                    {preview.invalidRows} rejected.
                  </p>
                  <ul>
                    {preview.rows.map((r) => (
                      <li key={r.rowNumber}>
                        Row {r.rowNumber}:{" "}
                        {r.valid
                          ? r.summary.receiverName || "Ready"
                          : r.errors.join("; ")}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={close}>
              Close
            </Button>
            <Button
              type="submit"
              disabled={
                kind === "import" && (!preview || preview.invalidRows > 0)
              }
            >
              {busy
                ? "Awaiting confirmation…"
                : kind === "import"
                  ? "Confirm original batch"
                  : "Create shipment"}
            </Button>
          </div>
        </fieldset>
      </form>
    </DialogContent>
  );
}
function Field({
  label,
  name,
  type = "text",
  value,
}: {
  label: string;
  name: string;
  type?: string;
  value?: string;
}) {
  return (
    <div>
      <Label htmlFor={`order-${name}`}>{label}</Label>
      <Input
        id={`order-${name}`}
        name={name}
        type={type}
        defaultValue={value}
        maxLength={2048}
        min={type === "number" ? 1 : undefined}
        step={name === "weight" ? "any" : undefined}
        className="mt-1"
      />
    </div>
  );
}
