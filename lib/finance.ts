import { api } from "@/lib/api";

export type FinanceCurrency = "UZS" | "USD" | "CNY";
export type PaymentRunStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "executed";
export type PaymentRunLineStatus =
  | "pending"
  | "executed"
  | "allocated"
  | "cancelled";
export type BankStatementStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected";
export type ReconciliationStatus = "unmatched" | "matched" | "ignored";
export type FinanceAccountType =
  | "asset"
  | "liability"
  | "equity"
  | "revenue"
  | "expense";
export type FiscalPeriodStatus = "open" | "restricted" | "closed";
export type JournalStatus = "draft" | "posted" | "reversed";
export type OperationalDocumentStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "cancelled";
export type FinanceSourceEventStatus =
  | "pending"
  | "processing"
  | "posted"
  | "exception";

export type CursorPage<T> = {
  items: T[];
  pageInfo: { hasMore: boolean; nextCursor: string | null };
};

export type FinanceLegalEntity = {
  id: string;
  companyId: string;
  baseCurrency: FinanceCurrency;
  reportingCurrency: FinanceCurrency | null;
  fiscalYearStartMonth: number;
  timezone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FinanceAccount = {
  id: string;
  legalEntityId: string;
  code: string;
  name: string;
  type: FinanceAccountType;
  status: "active" | "inactive";
  parentId: string | null;
  parent?: Pick<FinanceAccount, "id" | "code" | "name"> | null;
  allowPosting: boolean;
  isControlAccount: boolean;
  currency: FinanceCurrency | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FinanceFiscalPeriod = {
  id: string;
  legalEntityId: string;
  fiscalYear: number;
  periodNumber: number;
  name: string;
  startDate: string;
  endDate: string;
  status: FiscalPeriodStatus;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FinancePostingRuleLine = {
  id: string;
  lineNumber: number;
  side: "debit" | "credit";
  accountId: string;
  amountExpression: string;
  descriptionTemplate: string | null;
  account: Pick<FinanceAccount, "id" | "code" | "name" | "type">;
};

export type FinancePostingRule = {
  id: string;
  code: string;
  name: string;
  sourceType: string;
  eventType: string;
  status: "active" | "inactive";
  version: number;
  priority: number;
  validFrom: string | null;
  validTo: string | null;
  lines: FinancePostingRuleLine[];
  createdAt: string;
  updatedAt: string;
};

export type FinanceSetupCatalog = {
  chartTemplates: Array<{
    code: "logistics_standard";
    version: 1;
    name: string;
    accountCount: number;
  }>;
  postingEvents: Record<string, string[]>;
  amountKeys: string[];
};

export type FinanceJournalLine = {
  id: string;
  lineNumber: number;
  accountId: string;
  account: FinanceAccount;
  debitAmount: string;
  creditAmount: string;
  currency: FinanceCurrency;
  fxRate: string;
  debitBase: string;
  creditBase: string;
  description: string | null;
};

export type FinanceJournal = {
  id: string;
  legalEntityId: string;
  documentId: string;
  journalNumber: string;
  status: JournalStatus;
  postingDate: string;
  description: string | null;
  totalDebitBase: string;
  totalCreditBase: string;
  postedAt: string | null;
  reversedAt: string | null;
  reversalOfId: string | null;
  createdAt: string;
  updatedAt: string;
  document: {
    id: string;
    documentNumber: string;
    status: string;
    documentDate: string;
    postingDate: string;
    currency: FinanceCurrency;
    totalAmount: string;
    baseAmount: string;
    fxRate: string;
    description: string | null;
    sourceType: string | null;
    sourceId: string | null;
  };
  lines?: FinanceJournalLine[];
  _count?: { lines: number };
};

export type FinanceSourceEvent = {
  id: string;
  sourceEventId: string;
  sourceType: string;
  eventType: string;
  sourceId: string;
  status: FinanceSourceEventStatus;
  occurredAt: string;
  postingDate: string;
  attempts: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  processedAt: string | null;
  createdAt: string;
  resolvedRule: {
    id: string;
    code: string;
    name: string;
    version: number;
  } | null;
  financeDocument: {
    id: string;
    documentNumber: string;
    status: string;
  } | null;
  financeJournalEntry: {
    id: string;
    journalNumber: string;
    status: string;
  } | null;
};

export type ReceivableAgingItem = {
  id: string;
  sourceInvoiceId: string;
  invoiceNumber: string;
  orderId: string;
  customerEntityId: string | null;
  documentDate: string;
  dueDate: string;
  currency: FinanceCurrency;
  originalAmount: string;
  outstandingAmount: string;
  status: "open" | "partial";
};

export type ReceivablesAgingResponse = {
  asOf: string;
  summary: AgingSummary[];
  items: ReceivableAgingItem[];
  nextCursor: string | null;
};

export type UnappliedCashItem = {
  id: string;
  type: "receipt" | "refund";
  orderId: string;
  customerEntityId: string | null;
  currency: FinanceCurrency;
  originalAmount: string;
  remainingAmount: string;
  status: "open" | "applied";
  occurredAt: string;
  createdAt: string;
};

export type UnappliedCashResponse = {
  summary: Array<{
    currency: FinanceCurrency;
    type: "receipt" | "refund";
    remainingAmount: string;
    count: number;
  }>;
  items: UnappliedCashItem[];
  nextCursor: string | null;
};

export type ProviderSettlementLine = {
  id: string;
  sequence: number;
  type: "payment" | "refund" | "fee" | "adjustment";
  reconciliationStatus: "unmatched" | "matched" | "mismatch" | "ignored";
  reconciliationMessage: string | null;
  amount: string;
  externalTransactionId: string | null;
  paymentIntentId: string | null;
  paymentRefundId: string | null;
  orderId: string | null;
  occurredAt: string | null;
  description: string | null;
};

export type ProviderSettlement = ProviderSettlementSummary & {
  legalEntityId: string;
  providerConfigId: string;
  environment: string;
  externalReference: string | null;
  periodStart: string;
  periodEnd: string;
  grossAmount: string;
  refundAmount: string;
  feeAmount: string;
  adjustmentAmount: string;
  fxRate: string;
  fxRateAsOf: string | null;
  status: OperationalDocumentStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  lines?: ProviderSettlementLine[];
  _count?: { lines: number };
};

export type CarrierBillLine = {
  id: string;
  sequence: number;
  orderId: string;
  orderLegId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
  taxAmount: string;
};

export type CarrierBill = {
  id: string;
  legalEntityId: string;
  billNumber: string;
  carrierProviderId: string;
  carrierCode: string;
  supplierInvoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  currency: FinanceCurrency;
  subtotalAmount: string;
  taxAmount: string;
  totalAmount: string;
  fxRate: string;
  fxRateAsOf: string | null;
  status: OperationalDocumentStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  lines?: CarrierBillLine[];
};

export type TrialBalance = {
  baseCurrency: FinanceCurrency;
  from: string;
  to: string;
  totalDebit: string;
  totalCredit: string;
  balanced: boolean;
  rows: Array<{
    account: Pick<FinanceAccount, "id" | "code" | "name" | "type">;
    debit: string;
    credit: string;
    balance: string;
  }>;
};

export type BankAccount = {
  id: string;
  legalEntityId: string;
  code: string;
  name: string;
  bankName: string;
  accountIdentifierMasked: string;
  currency: FinanceCurrency;
  isActive: boolean;
  metadataJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type AgingSummary = {
  currency: FinanceCurrency;
  current: string;
  days1To30: string;
  days31To60: string;
  days61To90: string;
  daysOver90: string;
  total: string;
};

export type PayableAgingItem = {
  id: string;
  sourceCarrierBillId: string;
  billNumber: string;
  supplierInvoiceNumber: string;
  carrierProviderId: string;
  carrierCode: string;
  documentDate: string;
  dueDate: string;
  currency: FinanceCurrency;
  originalAmount: string;
  outstandingAmount: string;
  status: "open" | "partial";
};

export type PayablesAgingResponse = {
  asOf: string;
  summary: AgingSummary[];
  items: PayableAgingItem[];
  nextCursor: string | null;
};

export type PaymentRunPayable = {
  id: string;
  billNumber: string;
  supplierInvoiceNumber: string;
  dueDate: string;
  currency: FinanceCurrency;
  originalAmount: string;
  outstandingAmount: string;
  status: string;
};

export type PaymentRunLine = {
  id: string;
  sequence: number;
  payableItemId: string;
  carrierProviderId: string;
  carrierCode: string;
  amount: string;
  status: PaymentRunLineStatus;
  accountingSourceEventId: string | null;
  payableItem: PaymentRunPayable;
};

export type PaymentRun = {
  id: string;
  legalEntityId: string;
  bankAccountId: string;
  runNumber: string;
  paymentDate: string;
  currency: FinanceCurrency;
  totalAmount: string;
  fxRate: string;
  fxRateAsOf: string | null;
  status: PaymentRunStatus;
  bankReference: string | null;
  createdByUserId: string;
  submittedByUserId: string | null;
  approvedByUserId: string | null;
  executedByUserId: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  executedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  bankAccount: BankAccount;
  lines?: PaymentRunLine[];
  _count?: { lines: number };
};

export type ProviderSettlementSummary = {
  id: string;
  settlementNumber: string;
  providerCode: string;
  currency: FinanceCurrency;
  netAmount: string;
  status: string;
};

export type BankStatementLine = {
  id: string;
  sequence: number;
  bookingDate: string;
  valueDate: string | null;
  direction: "debit" | "credit";
  amount: string;
  currency: FinanceCurrency;
  externalTransactionId: string | null;
  description: string | null;
  reconciliationStatus: ReconciliationStatus;
  reconciliationTarget: "payment_run" | "provider_settlement" | null;
  reconciliationMessage: string | null;
  paymentRunId: string | null;
  providerSettlementId: string | null;
  paymentRun?: Pick<
    PaymentRun,
    "id" | "runNumber" | "status" | "totalAmount"
  > | null;
  providerSettlement?: Pick<
    ProviderSettlementSummary,
    "id" | "settlementNumber" | "status" | "netAmount"
  > | null;
};

export type BankStatement = {
  id: string;
  legalEntityId: string;
  bankAccountId: string;
  statementNumber: string;
  periodStart: string;
  periodEnd: string;
  currency: FinanceCurrency;
  openingBalance: string;
  totalDebits: string;
  totalCredits: string;
  closingBalance: string;
  status: BankStatementStatus;
  createdByUserId: string;
  submittedByUserId: string | null;
  approvedByUserId: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  bankAccount: BankAccount;
  lines?: BankStatementLine[];
  _count?: { lines: number };
};

type PageParams = { cursor?: string; limit?: number; status?: string };

export async function listBankAccounts(params: PageParams = {}) {
  const response = await api.get<CursorPage<BankAccount>>(
    "/api/finance/bank-accounts",
    { params },
  );
  return response.data;
}

export async function createBankAccount(input: {
  idempotencyKey: string;
  code: string;
  name: string;
  bankName: string;
  accountIdentifier: string;
  currency: FinanceCurrency;
}) {
  const response = await api.post<BankAccount>(
    "/api/finance/bank-accounts",
    input,
  );
  return response.data;
}

export async function changeBankAccountStatus(id: string, isActive: boolean) {
  const response = await api.patch<BankAccount>(
    `/api/finance/bank-accounts/${id}/status`,
    { isActive },
  );
  return response.data;
}

export async function getPayablesAging(params: {
  asOf: string;
  cursor?: string;
  limit?: number;
  currency?: FinanceCurrency;
}) {
  const response = await api.get<PayablesAgingResponse>(
    "/api/finance/payables/aging",
    { params },
  );
  return response.data;
}

export async function listPaymentRuns(params: PageParams = {}) {
  const response = await api.get<CursorPage<PaymentRun>>(
    "/api/finance/payment-runs",
    { params },
  );
  return response.data;
}

export async function getPaymentRun(id: string) {
  const response = await api.get<PaymentRun>(`/api/finance/payment-runs/${id}`);
  return response.data;
}

export async function createPaymentRun(input: {
  bankAccountId: string;
  idempotencyKey: string;
  paymentDate: string;
  currency: FinanceCurrency;
  fxRate: string;
  fxRateAsOf: string;
  lines: Array<{ payableItemId: string; amount: string }>;
}) {
  const response = await api.post<PaymentRun>(
    "/api/finance/payment-runs",
    input,
  );
  return response.data;
}

export async function submitPaymentRun(id: string) {
  const response = await api.post<PaymentRun>(
    `/api/finance/payment-runs/${id}/submit`,
    {},
  );
  return response.data;
}

export async function approvePaymentRun(id: string) {
  const response = await api.post<PaymentRun>(
    `/api/finance/payment-runs/${id}/approve`,
    {},
  );
  return response.data;
}

export async function rejectPaymentRun(id: string, reason: string) {
  const response = await api.post<PaymentRun>(
    `/api/finance/payment-runs/${id}/reject`,
    { reason },
  );
  return response.data;
}

export async function executePaymentRun(
  id: string,
  input: { bankReference: string; executedAt: string },
) {
  const response = await api.post<PaymentRun>(
    `/api/finance/payment-runs/${id}/execute`,
    input,
  );
  return response.data;
}

export async function listProviderSettlements(params: PageParams = {}) {
  const response = await api.get<CursorPage<ProviderSettlementSummary>>(
    "/api/finance/provider-settlements",
    { params },
  );
  return response.data;
}

export async function listBankStatements(params: PageParams = {}) {
  const response = await api.get<CursorPage<BankStatement>>(
    "/api/finance/bank-statements",
    { params },
  );
  return response.data;
}

export async function getBankStatement(id: string) {
  const response = await api.get<BankStatement>(
    `/api/finance/bank-statements/${id}`,
  );
  return response.data;
}

export async function createBankStatement(input: {
  bankAccountId: string;
  statementNumber: string;
  idempotencyKey: string;
  periodStart: string;
  periodEnd: string;
  currency: FinanceCurrency;
  openingBalance: string;
  reportedClosingBalance: string;
  lines: Array<{
    bookingDate: string;
    valueDate?: string | null;
    direction: "debit" | "credit";
    amount: string;
    externalTransactionId?: string | null;
    description?: string | null;
  }>;
}) {
  const response = await api.post<BankStatement>(
    "/api/finance/bank-statements",
    input,
  );
  return response.data;
}

export async function reconcileBankStatementLine(
  statementId: string,
  lineId: string,
  input: {
    targetType: "payment_run" | "provider_settlement";
    targetId: string;
  },
) {
  const response = await api.post<BankStatement>(
    `/api/finance/bank-statements/${statementId}/lines/${lineId}/reconcile`,
    input,
  );
  return response.data;
}

export async function ignoreBankStatementLine(
  statementId: string,
  lineId: string,
  reason: string,
) {
  const response = await api.post<BankStatement>(
    `/api/finance/bank-statements/${statementId}/lines/${lineId}/ignore`,
    { reason },
  );
  return response.data;
}

export async function submitBankStatement(id: string) {
  const response = await api.post<BankStatement>(
    `/api/finance/bank-statements/${id}/submit`,
    {},
  );
  return response.data;
}

export async function approveBankStatement(id: string) {
  const response = await api.post<BankStatement>(
    `/api/finance/bank-statements/${id}/approve`,
    {},
  );
  return response.data;
}

export async function rejectBankStatement(id: string, reason: string) {
  const response = await api.post<BankStatement>(
    `/api/finance/bank-statements/${id}/reject`,
    { reason },
  );
  return response.data;
}

export async function getFinanceLegalEntity() {
  const response = await api.get<FinanceLegalEntity>(
    "/api/finance/legal-entity",
  );
  return response.data;
}

export async function configureFinanceLegalEntity(input: {
  baseCurrency: FinanceCurrency;
  reportingCurrency?: FinanceCurrency | null;
  fiscalYearStartMonth: number;
  timezone: string;
}) {
  const response = await api.put<FinanceLegalEntity>(
    "/api/finance/legal-entity",
    input,
  );
  return response.data;
}

export async function getFinanceSetupCatalog() {
  const response = await api.get<FinanceSetupCatalog>(
    "/api/finance/setup/catalog",
  );
  return response.data;
}

export async function listFinanceAccounts(
  params: { cursor?: string; limit?: number } = {},
) {
  const response = await api.get<CursorPage<FinanceAccount>>(
    "/api/finance/accounts",
    { params },
  );
  return response.data;
}

export async function bootstrapFinanceAccounts() {
  const response = await api.post<{
    installation: unknown;
    accounts: FinanceAccount[];
    idempotent: boolean;
  }>("/api/finance/accounts/bootstrap", {
    templateCode: "logistics_standard",
    templateVersion: 1,
  });
  return response.data;
}

export async function createFinanceAccount(input: {
  code: string;
  name: string;
  type: FinanceAccountType;
  parentId?: string | null;
  allowPosting: boolean;
  isControlAccount: boolean;
  currency?: FinanceCurrency | null;
  description?: string | null;
}) {
  const response = await api.post<FinanceAccount>(
    "/api/finance/accounts",
    input,
  );
  return response.data;
}

export async function listFinancePeriods(
  params: { cursor?: string; limit?: number } = {},
) {
  const response = await api.get<CursorPage<FinanceFiscalPeriod>>(
    "/api/finance/periods",
    { params },
  );
  return response.data;
}

export async function createFinancePeriod(input: {
  fiscalYear: number;
  periodNumber: number;
  name: string;
  startDate: string;
  endDate: string;
}) {
  const response = await api.post<FinanceFiscalPeriod>(
    "/api/finance/periods",
    input,
  );
  return response.data;
}

export async function changeFinancePeriodStatus(
  id: string,
  status: FiscalPeriodStatus,
) {
  const response = await api.patch<FinanceFiscalPeriod>(
    `/api/finance/periods/${id}/status`,
    { status },
  );
  return response.data;
}

export async function listFinancePostingRules(
  params: { cursor?: string; limit?: number } = {},
) {
  const response = await api.get<CursorPage<FinancePostingRule>>(
    "/api/finance/posting-rules",
    { params },
  );
  return response.data;
}

export type PostingRuleInput = {
  code: string;
  name: string;
  sourceType: string;
  eventType: string;
  priority: number;
  conditions?: Record<string, unknown>;
  validFrom?: string | null;
  validTo?: string | null;
  lines: Array<{
    side: "debit" | "credit";
    accountId: string;
    amountKey: string;
    descriptionTemplate?: string | null;
  }>;
};

export async function createFinancePostingRule(input: PostingRuleInput) {
  const response = await api.post<FinancePostingRule>(
    "/api/finance/posting-rules",
    input,
  );
  return response.data;
}

export async function createFinancePostingRuleVersion(
  id: string,
  input: PostingRuleInput,
) {
  const response = await api.post<FinancePostingRule>(
    `/api/finance/posting-rules/${id}/versions`,
    input,
  );
  return response.data;
}

export async function changeFinancePostingRuleStatus(
  id: string,
  status: "active" | "inactive",
) {
  const response = await api.patch<FinancePostingRule>(
    `/api/finance/posting-rules/${id}/status`,
    { status },
  );
  return response.data;
}

export async function listFinanceJournals(
  params: { cursor?: string; limit?: number } = {},
) {
  const response = await api.get<CursorPage<FinanceJournal>>(
    "/api/finance/journals",
    { params },
  );
  return response.data;
}

export async function getFinanceJournal(id: string) {
  const response = await api.get<FinanceJournal>(`/api/finance/journals/${id}`);
  return response.data;
}

export async function createFinanceJournal(input: {
  idempotencyKey: string;
  documentDate: string;
  postingDate: string;
  currency: FinanceCurrency;
  fxRate: string;
  fxRateAsOf?: string | null;
  description?: string | null;
  lines: Array<{
    accountId: string;
    debitAmount: string;
    creditAmount: string;
    description?: string;
  }>;
}) {
  const response = await api.post<FinanceJournal>(
    "/api/finance/journals",
    input,
  );
  return response.data;
}

export async function postFinanceJournal(id: string) {
  const response = await api.post<FinanceJournal>(
    `/api/finance/journals/${id}/post`,
    {},
  );
  return response.data;
}

export async function reverseFinanceJournal(
  id: string,
  input: {
    postingDate: string;
    reason: string;
    idempotencyKey: string;
  },
) {
  const response = await api.post<FinanceJournal>(
    `/api/finance/journals/${id}/reverse`,
    input,
  );
  return response.data;
}

export async function listFinanceSourceEvents(
  params: {
    cursor?: string;
    limit?: number;
    status?: FinanceSourceEventStatus;
  } = {},
) {
  const response = await api.get<CursorPage<FinanceSourceEvent>>(
    "/api/finance/source-events",
    { params },
  );
  return response.data;
}

export async function listFinanceExceptions(
  params: { cursor?: string; limit?: number } = {},
) {
  const response = await api.get<CursorPage<FinanceSourceEvent>>(
    "/api/finance/exceptions",
    { params },
  );
  return response.data;
}

export async function retryFinanceSourceEvent(id: string) {
  const response = await api.post<FinanceSourceEvent>(
    `/api/finance/source-events/${id}/retry`,
    {},
  );
  return response.data;
}

export async function getReceivablesAging(params: {
  asOf: string;
  cursor?: string;
  limit?: number;
  currency?: FinanceCurrency;
  customerEntityId?: string;
}) {
  const response = await api.get<ReceivablesAgingResponse>(
    "/api/finance/receivables/aging",
    { params },
  );
  return response.data;
}

export async function listUnappliedCash(
  params: {
    cursor?: string;
    limit?: number;
    currency?: FinanceCurrency;
    customerEntityId?: string;
    type?: "receipt" | "refund";
    status?: "open" | "applied";
  } = {},
) {
  const response = await api.get<UnappliedCashResponse>(
    "/api/finance/receivables/unapplied-cash",
    { params },
  );
  return response.data;
}

export async function getProviderSettlement(id: string) {
  const response = await api.get<ProviderSettlement>(
    `/api/finance/provider-settlements/${id}`,
  );
  return response.data;
}

export async function createProviderSettlement(input: {
  idempotencyKey: string;
  providerConfigId: string;
  externalReference?: string | null;
  periodStart: string;
  periodEnd: string;
  currency: FinanceCurrency;
  fxRate: string;
  fxRateAsOf?: string | null;
  reportedNetAmount?: string | null;
  lines: Array<{
    type: "payment" | "refund" | "fee" | "adjustment";
    amount: string;
    externalTransactionId?: string | null;
    paymentIntentId?: string | null;
    paymentRefundId?: string | null;
    orderId?: string | null;
    occurredAt?: string | null;
    description?: string | null;
  }>;
}) {
  const response = await api.post<ProviderSettlement>(
    "/api/finance/provider-settlements",
    input,
  );
  return response.data;
}

export async function submitProviderSettlement(id: string) {
  const response = await api.post<ProviderSettlement>(
    `/api/finance/provider-settlements/${id}/submit`,
    {},
  );
  return response.data;
}

export async function approveProviderSettlement(id: string) {
  const response = await api.post<ProviderSettlement>(
    `/api/finance/provider-settlements/${id}/approve`,
    {},
  );
  return response.data;
}

export async function rejectProviderSettlement(id: string, reason: string) {
  const response = await api.post<ProviderSettlement>(
    `/api/finance/provider-settlements/${id}/reject`,
    { reason },
  );
  return response.data;
}

export async function listCarrierBills(params: PageParams = {}) {
  const response = await api.get<CursorPage<CarrierBill>>(
    "/api/finance/carrier-bills",
    { params },
  );
  return response.data;
}

export async function getCarrierBill(id: string) {
  const response = await api.get<CarrierBill>(
    `/api/finance/carrier-bills/${id}`,
  );
  return response.data;
}

export async function createCarrierBill(input: {
  idempotencyKey: string;
  carrierProviderId: string;
  supplierInvoiceNumber: string;
  invoiceDate: string;
  dueDate?: string | null;
  currency: FinanceCurrency;
  fxRate: string;
  fxRateAsOf?: string | null;
  reportedTotalAmount?: string | null;
  lines: Array<{
    orderId: string;
    orderLegId: string;
    description: string;
    quantity: string;
    unitPrice: string;
    taxAmount: string;
  }>;
}) {
  const response = await api.post<CarrierBill>(
    "/api/finance/carrier-bills",
    input,
  );
  return response.data;
}

export async function submitCarrierBill(id: string) {
  const response = await api.post<CarrierBill>(
    `/api/finance/carrier-bills/${id}/submit`,
    {},
  );
  return response.data;
}

export async function approveCarrierBill(id: string) {
  const response = await api.post<CarrierBill>(
    `/api/finance/carrier-bills/${id}/approve`,
    {},
  );
  return response.data;
}

export async function rejectCarrierBill(id: string, reason: string) {
  const response = await api.post<CarrierBill>(
    `/api/finance/carrier-bills/${id}/reject`,
    { reason },
  );
  return response.data;
}

export async function getTrialBalance(params: { from: string; to: string }) {
  const response = await api.get<TrialBalance>(
    "/api/finance/reports/trial-balance",
    { params },
  );
  return response.data;
}
