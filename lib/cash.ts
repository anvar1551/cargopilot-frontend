import { api } from "./api";
import { getUser } from "./auth";
import { cashContext, custodyEvent, executeCashIntent } from "./cash-intent";

const KEY = "cargopilot_cash_intent_v1";
export type CashReceipt = { id: string; orderNumber: string; status: string;
  assignedDriverId: string | null; codPaidStatus: string | null; serviceChargePaidStatus: string | null;
  cashCollections: Array<{ id: string; kind: string; status: string; currency: string;
    expectedAmount: string; collectedAmount: string; currentHolderType: string;
    currentHolderUserId: string | null; currentHolderWarehouseId: string | null;
    currentHolderLabel: string; events: Array<{ id: string; eventType: string; amount: string; createdAt: string }> }> };
export type CashSingleResult = { success: boolean; message: string; order: CashReceipt };
export type CashBulkResult = { success: boolean; count: number; failedCount: number; orders: CashReceipt[];
  failed: Array<{ orderId: string; kind: string; error: string }> };
type Item = { orderId: string; kind: "cod" | "service_charge"; note?: string | null };
type Target = { toHolderType?: "driver" | "warehouse" | "pickup_point"; toDriverId?: string | null; toWarehouseId?: string | null; note?: string | null };

export async function mutateCash(action: "collect" | "handoff" | "settle", items: Item[], target: Target = {}, bulk = false) {
  if (typeof window === "undefined" || !navigator.locks) throw new Error("Cash actions require durable browser storage and exclusive browser locks. This browser is unsupported.");
  if (!items.length || items.length > 40) throw new Error("Select between 1 and 40 cash items.");
  if (new Set(items.map(i => `${i.orderId}:${i.kind}`)).size !== items.length) throw new Error("Duplicate cash items are not allowed.");
  const safeItems = items.map(i => ({ orderId: i.orderId, kind: i.kind, note: i.note ?? null }));
  const safeTarget = action === "handoff" ? { toHolderType: target.toHolderType, toDriverId: target.toDriverId ?? null, toWarehouseId: target.toWarehouseId ?? null, note: target.note ?? null } : { note: target.note ?? null };
  return navigator.locks.request(KEY, { ifAvailable: true }, async lock => {
    if (!lock) throw new Error("Another cash action is in progress.");
    return executeCashIntent(JSON.stringify({ action, items: safeItems, target: safeTarget, bulk }), {
      context: async () => cashContext(getUser()),
      read: async () => window.localStorage.getItem(KEY),
      write: async value => value === null ? window.localStorage.removeItem(KEY) : window.localStorage.setItem(KEY, value),
      confirm: async message => window.confirm(message),
      prepare: async () => {
        if (action === "settle" && !window.confirm("Settlement must be checked by a separately authorized person who neither collected nor last handled this cash. Continue as the checker?")) throw new Error("Settlement cancelled.");
        const prepared = [];
        for (const item of safeItems) {
          let expectedEventId: string | undefined;
          if (action !== "collect") {
            const snapshot = (await api.get(`/api/orders/${item.orderId}`)).data;
            expectedEventId = custodyEvent(snapshot.order ?? snapshot, item.kind);
          }
          prepared.push({ orderId: item.orderId, kind: item.kind, operationId: crypto.randomUUID(),
            ...(action === "collect" ? { note: item.note ?? target.note ?? null } : { expectedEventId }) });
        }
        return bulk ? { path: `/api/orders/cash/${action}-bulk`, body: { items: prepared, ...safeTarget } } :
          { path: `/api/orders/${safeItems[0].orderId}/cash/${action}`, body: { ...Object.fromEntries(Object.entries(prepared[0]).filter(([key]) => key !== "orderId")), ...safeTarget,
            note: safeItems[0].note ?? target.note ?? null } };
      },
      send: async record => (await api.post(record.path, record.body, { timeout: 15000, cashContext: record.context } as any)).data,
    });
  });
}
