export type CommissionModel = 'percentage' | 'fixed' | 'per_item' | 'tiered' | 'category' | 'provider_reported';

export type LedgerEventType =
  | 'CONVERSION_PENDING'
  | 'CONVERSION_APPROVED'
  | 'CONVERSION_REVERSED'
  | 'CONVERSION_REJECTED'
  | 'PAYOUT_RECEIVED'
  | 'PAYOUT_EXPECTED'
  | 'MANUAL_ADJUSTMENT'
  | 'RECONCILIATION_ADJUSTMENT';

export type ConversionStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'REVERSED'
  | 'PAID'
  | 'UNMATCHED';

/** ناتج parseConversion() لأي محول مزوّد (Phase 6) -- شكل موحّد بغض النظر
 * عن شكل الـ payload الأصلي من المزوّد. */
export type NormalizedConversion = {
  providerConversionId: string;
  providerTransactionId?: string | null;
  orderId?: string | null;
  productId?: string | null;
  saleAmount: number;
  commissionAmount?: number;
  currency: string;
  exchangeRate?: number | null;
  baseAmount?: number | null;
  baseCurrency?: string | null;
  conversionTime: string; // ISO timestamp
  customerReference?: string | null;
  rawEventId?: string | null;
  clickId?: string | null; // internal click_id if provider echoed it back
  providerClickId?: string | null;
  providerCommission?: number | null; // authoritative if the provider reports it directly
  productCategory?: string | null; // for category-based commission rules
};

export type CommissionResult = {
  amount: number;
  source: 'provider' | 'rule' | 'default';
  ruleId?: string;
};

export type ReconciliationStatus =
  | 'MATCHED'
  | 'AMOUNT_MISMATCH'
  | 'STATUS_MISMATCH'
  | 'MISSING_FROM_PROVIDER'
  | 'MISSING_FROM_INTERNAL'
  | 'DUPLICATE'
  | 'UNMATCHED'
  | 'MANUAL_REVIEW';

/** سجل تحويلة من جانب المزوّد -- سواء جاي من adapter.fetchConversions()
 * (Phase 6) أو من استيراد CSV، بشكل موحّد يكفي للمطابقة فقط (مو الشكل
 * الكامل لـ NormalizedConversion). */
export type ProviderConversionRecord = {
  providerConversionId: string;
  amount: number;
  status: string;
  raw?: unknown;
};

export type CommissionBalance = {
  expected: number; // PENDING + APPROVED, not yet paid or reversed
  reversed: number; // negative
  paid: number; // negative (money out of the ledger once received/settled)
  outstanding: number; // expected + reversed + paid
  currency: string;
};
