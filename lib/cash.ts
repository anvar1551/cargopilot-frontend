export type CashReceipt = {
  id: string;
  orderNumber: string;
  status: string;
  assignedDriverId: string | null;
  codPaidStatus: string | null;
  serviceChargePaidStatus: string | null;
  cashCollections: Array<{
    id: string;
    kind: string;
    status: string;
    currency: string;
    expectedAmount: string;
    collectedAmount: string;
    currentHolderType: string;
    currentHolderUserId: string | null;
    currentHolderWarehouseId: string | null;
    currentHolderLabel: string;
    events: Array<{
      id: string;
      eventType: string;
      amount: string;
      createdAt: string;
    }>;
  }>;
};
export type CashSingleResult = {
  success: boolean;
  message: string;
  order: CashReceipt;
};
export type CashBulkResult = {
  success: boolean;
  count: number;
  failedCount: number;
  orders: CashReceipt[];
  failed: Array<{ orderId: string; kind: string; error: string }>;
};
/** Obsolete holder-ID/Float contracts are contained. Existing v1 stored intents remain untouched. */
export async function mutateCash(..._legacyRequest: unknown[]): Promise<never> {
  void _legacyRequest;
  throw new Error(
    "Legacy cash submission is unavailable. Use Service-charge cash for authoritative preflight, named recipients and explicit offer acceptance. Existing legacy intents require reconciliation and are preserved.",
  );
}
