// Client retry safety only. PostgreSQL and current server authorization remain authority.
export function cashContext(user: any): string {
  const fields = [user?.id, user?.tenantId, user?.tenantMembershipId, user?.companyId, user?.companyMembershipId];
  if (fields.some(v => typeof v !== "string" || !v) || user.membershipId !== user.companyMembershipId) {
    throw new Error("Cash actions require a tenant-bound login. Sign in again and select an authorized membership.");
  }
  return JSON.stringify(fields);
}

// Local consistency check, NOT signature verification or server authorization.
// Prevent independently stored user/token values during login switching from
// sending a saved action with a token belonging to a different context.
export function assertCashToken(token: string | null, context: string) {
  try {
    const part = token?.split(".")[1];
    if (!part || typeof globalThis.atob !== "function") throw new Error();
    const claims = JSON.parse(globalThis.atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    if (claims.tokenType !== "access" || cashContext(claims) !== context) throw new Error();
  } catch {
    throw new Error("Cash token and selected context disagree. Sign in again; request denied.");
  }
}

export function cashDecimal(value: unknown, currency?: string | null): string {
  const text = String(value ?? "");
  return /^\d+(?:\.\d+)?$/.test(text) ? `${text}${currency ? ` ${currency}` : ""}` : "Unavailable";
}

export function custodyEvent(order: any, kind: string): string {
  const rows = order?.cashCollections?.filter((r: any) => r.kind === kind);
  if (rows?.length !== 1 || rows[0].status !== "held") throw new Error("Reload the authoritative held cash snapshot before handoff or settlement.");
  const events = [...(rows[0].events ?? [])].sort((a: any, b: any) =>
    String(b.createdAt).localeCompare(String(a.createdAt)) || String(b.id).localeCompare(String(a.id)));
  const id = events[0]?.id;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Custody event unavailable. This cash action is disabled.");
  return id;
}

export type CashIntent = { context: string; intent: string; path: string; body: any; blocked?: boolean };
export type CashDependencies = {
  context(): Promise<string>;
  read(): Promise<string | null>;
  write(value: string | null): Promise<void>;
  confirm(message: string): Promise<boolean>;
  prepare(): Promise<{ path: string; body: any }>;
  send(record: CashIntent): Promise<any>;
};

export async function executeCashIntent(intent: string, deps: CashDependencies) {
  const context = await deps.context();
  const raw = await deps.read();
  let record: CashIntent;
  if (raw) {
    record = JSON.parse(raw);
    if (record.context !== context) throw new Error("Pending cash action belongs to another login or company context. It will not be replayed.");
    if (record.blocked) {
      if (await deps.confirm("This cash action was rejected. Clear the rejected intent? Reload state and review permissions and the separate settlement checker before starting a new action.")) await deps.write(null);
      throw new Error("Cash action rejected. Reload and review before a new action; no replay was sent.");
    }
    if (record.intent !== intent) throw new Error("An unresolved cash action exists. Return to the original action with its unchanged inputs; do not start a different action.");
    if (!await deps.confirm("The previous cash outcome is uncertain. Manually retry exactly the saved operation and custody snapshot? No amounts or destination will be changed.")) throw new Error("Cash retry cancelled; saved intent retained.");
  } else {
    const prepared = await deps.prepare();
    record = { context, intent, ...prepared };
    // Persistence failure must prevent the initial request.
    await deps.write(JSON.stringify(record));
  }
  if (await deps.context() !== context) throw new Error("Cash identity changed before sending. Saved action will not be replayed.");
  try {
    const result = await deps.send(record);
    // The bulk contract has no per-item status code to establish retryability.
    // Preserve the unresolved identity rather than clearing/replacing partial work.
    await deps.write(result?.failedCount > 0 ? JSON.stringify(record) : null);
    return result;
  } catch (error: any) {
    const status = Number(error?.response?.status ?? 0);
    if (raw && status >= 400 && status < 500) {
      // A retry rejection cannot establish whether the earlier attempt committed.
      // Keep its original identity/body unresolved, including across restarts.
      throw new Error("The earlier cash outcome remains uncertain. This retry was rejected; retain the original operation and reconcile it before any new action.");
    }
    if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
      record.blocked = true;
      await deps.write(JSON.stringify(record));
      throw new Error("Cash action rejected. Reload state and check permissions, ownership and the separate settlement checker. It will not be replayed automatically.");
    }
    throw new Error("Cash outcome uncertain. The original operation is saved; repeat the same action to review a manual retry. Do not change its inputs.");
  }
}
