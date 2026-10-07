/** Durable client intent; PostgreSQL receipts, not this storage, prevent duplicates. */
export type CreationIntent = {
  version: 1;
  context: string;
  operationId: string;
  kind: "order" | "import";
  payload: Record<string, unknown>;
  state: "pending" | "uncertain" | "conflict" | "confirmed";
  orders?: Array<{ id: string; orderNumber?: string | number | null }>;
  replayedRows?: number;
  downstreamRecoveryRequired?: boolean;
};
export type IntentIO = {
  context(): string | null;
  epoch(): string;
  read(): string | null;
  write(raw: string): void;
  lock<T>(work: () => Promise<T>): Promise<T>;
  uuid(): string;
  send(
    intent: CreationIntent,
  ): Promise<
    Pick<
      CreationIntent,
      "orders" | "replayedRows" | "downstreamRecoveryRequired"
    >
  >;
};
export function canonicalIntent(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalIntent).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalIntent(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function readCreationIntent(raw: string | null): CreationIntent | null {
  if (!raw) return null;
  if (raw.length > 2_000_000) throw Error("Unreadable creation intent");
  const i = JSON.parse(raw) as CreationIntent;
  if (
    i.version !== 1 ||
    !i.context ||
    !/^[0-9a-f-]{36}$/i.test(i.operationId) ||
    !["order", "import"].includes(i.kind) ||
    !["pending", "uncertain", "conflict", "confirmed"].includes(i.state) ||
    !i.payload ||
    typeof i.payload !== "object"
  )
    throw Error("Unreadable creation intent");
  return i;
}
export async function submitCreationIntent(
  kind: CreationIntent["kind"],
  payload: Record<string, unknown> | null,
  d: IntentIO,
) {
  const context = d.context(),
    epoch = d.epoch();
  const guard = () => {
    if (!context || d.context() !== context || d.epoch() !== epoch)
      throw Error("Session changed; creation suppressed");
  };
  guard();
  const snapshot = payload
    ? (JSON.parse(canonicalIntent(payload)) as Record<string, unknown>)
    : null;
  return d.lock(async () => {
    guard();
    let i = readCreationIntent(d.read());
    if (i && (i.context !== context || i.kind !== kind))
      throw Error("Intent context mismatch");
    if (
      i &&
      snapshot &&
      canonicalIntent(snapshot) !== canonicalIntent(i.payload)
    )
      throw Error("Conflicting intent; original content must be retained");
    if (i?.state === "conflict")
      throw Error("Conflicting server receipt requires review");
    if (!i) {
      if (!snapshot) throw Error("No original intent");
      i = {
        version: 1,
        context: context!,
        operationId: d.uuid(),
        kind,
        payload: snapshot,
        state: "pending",
      };
    }
    const intent = i;
    const persist = () => {
      guard();
      const raw = JSON.stringify(intent);
      if (raw.length > 2_000_000) throw Error("Intent exceeds storage bound");
      d.write(raw);
      if (d.read() !== raw) throw Error("Persistence verification failed");
    };
    // Even a confirmed result is re-authorized through the backend on explicit retry.
    intent.state = "pending";
    persist();
    try {
      const result = await d.send(
        JSON.parse(JSON.stringify(intent)) as CreationIntent,
      );
      guard();
      if (!result.orders?.length) throw Error("Confirmation missing");
      Object.assign(intent, result, { state: "confirmed" });
      persist();
      return intent;
    } catch (e) {
      if (
        d.context() === context &&
        d.epoch() === epoch &&
        (intent as CreationIntent).state !== "confirmed"
      ) {
        intent.state =
          (e as { response?: { status?: number } }).response?.status === 409
            ? "conflict"
            : "uncertain";
        persist();
      }
      throw e;
    }
  });
}
