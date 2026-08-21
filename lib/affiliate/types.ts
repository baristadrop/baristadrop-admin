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
};
