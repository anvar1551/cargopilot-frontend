/** Customer/address APIs have no server receipt. This record prevents replay, not duplicates at the server. */
export type MasterIntent = {
  version: 1;
  id: string;
  context: string;
  path: string;
  method: "POST" | "PATCH" | "DELETE";
  body: unknown;
  state: "pending" | "uncertain" | "rejected" | "confirmed";
  resultId?: string;
};
export type MasterWriteDependencies = {
  context(): string | null;
  epoch(): string;
  read(): string | null;
  write(value: string): void;
  lock<T>(work: () => Promise<T>): Promise<T>;
  id(): string;
  send(intent: MasterIntent): Promise<{ id: string }>;
};
export function readMasterIntent(raw: string | null): MasterIntent | null {
  if (!raw) return null;
  const r = JSON.parse(raw) as MasterIntent;
  if (
    r.version !== 1 ||
    !r.id ||
    !r.context ||
    !r.path ||
    !["POST", "PATCH", "DELETE"].includes(r.method) ||
    !["pending", "uncertain", "rejected", "confirmed"].includes(r.state)
  )
    throw Error("Unreadable pending record; do not resend");
  return r;
}
export async function executeMasterWrite(
  input: Pick<MasterIntent, "path" | "method" | "body">,
  d: MasterWriteDependencies,
) {
  const immutableInput = JSON.parse(JSON.stringify(input)) as typeof input;
  const context = d.context(),
    epoch = d.epoch();
  const guard = () => {
    if (!context || d.context() !== context || d.epoch() !== epoch)
      throw Error("Session changed; write suppressed");
  };
  guard();
  return d.lock(async () => {
    guard();
    if (d.read())
      throw Error("Existing pending intent requires review; do not resend");
    const record: MasterIntent = {
      version: 1,
      id: d.id(),
      context: context!,
      ...immutableInput,
      state: "pending",
    };
    const persist = () => {
      guard();
      const raw = JSON.stringify(record);
      if (raw.length > 16_384) throw Error("Intent exceeds local capacity");
      d.write(raw);
      if (d.read() !== raw)
        throw Error("Persistence verification failed; write suppressed");
    };
    persist(); // No request before durable intent, including storage read-back.
    try {
      const result = await d.send(record);
      guard();
      if (!result.id) throw Error("Unconfirmed response");
      record.state = "confirmed";
      record.resultId = result.id;
      persist();
      return result;
    } catch (error) {
      if (
        d.context() === context &&
        d.epoch() === epoch &&
        record.state !== "confirmed"
      ) {
        const status = (error as { response?: { status?: number } }).response
          ?.status;
        record.state = [400, 401, 403, 404, 409, 422].includes(status ?? 0)
          ? "rejected"
          : "uncertain";
        persist();
      }
      throw error;
    }
  });
}
