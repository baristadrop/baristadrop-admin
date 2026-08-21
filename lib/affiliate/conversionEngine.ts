import type { SupabaseClient } from '@supabase/supabase-js';
import { matchConversionToClick } from './clickMatching';
import type { ConversionStatus, NormalizedConversion } from './types';

const UNIQUE_VIOLATION = '23505';

/** آلة الحالة (3.4 بالخطة) -- التحويلات المسموحة فقط، أي شي غيرها يُرفض
 * بمستوى التطبيق حتى لو محاول القاعدة تسمح بيه (CHECK ما يفرض التسلسل). */
const VALID_TRANSITIONS: Record<ConversionStatus, ConversionStatus[]> = {
  PENDING: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['PAID', 'REVERSED'],
  REJECTED: [],
  CANCELLED: [],
  REVERSED: [],
  PAID: [],
  UNMATCHED: ['PENDING'], // لما تنربط يدوياً بكليك
};

const EVENT_TYPE_FOR_STATUS: Partial<Record<ConversionStatus, string>> = {
  APPROVED: 'CONVERSION_APPROVED',
  REJECTED: 'CONVERSION_REJECTED',
  CANCELLED: 'CONVERSION_CANCELLED',
  REVERSED: 'CONVERSION_REVERSED',
  PENDING: 'STATUS_CHANGED',
};

// خطوة 1: تخزين الحدث الخام دايماً قبل أي منطق -- أثر جنائي حتى لو باقي
// المعالجة فشلت.
export async function recordPostbackEvent(
  supabase: SupabaseClient,
  params: {
    affiliateProgramId: string | null;
    providerCode: string | null;
    clickId: string | null;
    transactionId: string | null;
    rawPayload: unknown;
  }
): Promise<string> {
  const { data, error } = await supabase
    .from('affiliate_postback_events')
    .insert({
      affiliate_program_id: params.affiliateProgramId,
      provider_code: params.providerCode,
      click_id: params.clickId,
      transaction_id: params.transactionId,
      raw_payload: params.rawPayload,
      status: 'received',
    })
    .select('id')
    .single();

  if (error || !data) throw new Error(`failed to record postback event: ${error?.message}`);
  return data.id as string;
}

export async function markPostbackEvent(
  supabase: SupabaseClient,
  postbackEventId: string,
  status: 'processed' | 'rejected' | 'duplicate' | 'error',
  rejectionReason?: string
): Promise<void> {
  await supabase
    .from('affiliate_postback_events')
    .update({ status, rejection_reason: rejectionReason ?? null, processed_at: new Date().toISOString() })
    .eq('id', postbackEventId);
}

export type ProcessConversionResult =
  | { outcome: 'created'; conversionId: string; status: ConversionStatus }
  | { outcome: 'duplicate'; conversionId: string; status: ConversionStatus };

// خطوات 3، 5، 6 من الأنبوب (3.2 بالخطة). خطوة 4 (Normalize) مسؤولية
// المستدعي (محول المزوّد -- Phase 6)، وخطوة 7 (حساب العمولة الحقيقي عبر
// دفتر الأستاذ) مسؤولية Phase 4 -- هنا commission_amount يُخزَّن كما جاء
// بالـ normalized (افتراضي 0) وتحدّثه Phase 4 لاحقاً.
export async function processConversionEvent(
  supabase: SupabaseClient,
  affiliateProgramId: string,
  normalized: NormalizedConversion
): Promise<ProcessConversionResult> {
  // خطوة 3: فحص التكرار -- UNIQUE(program_id, provider_conversion_id)
  const { data: existing } = await supabase
    .from('affiliate_conversions')
    .select('id, conversion_status')
    .eq('affiliate_program_id', affiliateProgramId)
    .eq('provider_conversion_id', normalized.providerConversionId)
    .maybeSingle();

  if (existing) {
    return { outcome: 'duplicate', conversionId: existing.id as string, status: existing.conversion_status as ConversionStatus };
  }

  // خطوة 5: مطابقة الكليك
  const clickId = await matchConversionToClick(supabase, affiliateProgramId, normalized);
  const initialStatus: ConversionStatus = clickId ? 'PENDING' : 'UNMATCHED';

  // خطوة 6: إنشاء التحويلة + حدث CONVERSION_CREATED
  const { data: inserted, error } = await supabase
    .from('affiliate_conversions')
    .insert({
      affiliate_program_id: affiliateProgramId,
      click_id: clickId,
      provider_conversion_id: normalized.providerConversionId,
      provider_transaction_id: normalized.providerTransactionId ?? null,
      order_id: normalized.orderId ?? null,
      product_id: normalized.productId ?? null,
      sale_amount: normalized.saleAmount,
      commission_amount: normalized.commissionAmount ?? 0,
      currency: normalized.currency,
      exchange_rate: normalized.exchangeRate ?? null,
      base_amount: normalized.baseAmount ?? null,
      base_currency: normalized.baseCurrency ?? null,
      conversion_status: initialStatus,
      conversion_time: normalized.conversionTime,
      customer_reference: normalized.customerReference ?? null,
      raw_event_id: normalized.rawEventId ?? null,
    })
    .select('id')
    .single();

  if (error) {
    // سباق نادر: تحويلتان لنفس provider_conversion_id بنفس اللحظة تقريباً --
    // القيد الفريد بالقاعدة يمسكها حتى لو فحص التكرار فوق فاتها.
    if (error.code === UNIQUE_VIOLATION) {
      const { data: raceWinner } = await supabase
        .from('affiliate_conversions')
        .select('id, conversion_status')
        .eq('affiliate_program_id', affiliateProgramId)
        .eq('provider_conversion_id', normalized.providerConversionId)
        .single();
      if (raceWinner) {
        return { outcome: 'duplicate', conversionId: raceWinner.id as string, status: raceWinner.conversion_status as ConversionStatus };
      }
    }
    throw new Error(`failed to insert conversion: ${error.message}`);
  }

  const conversionId = inserted.id as string;

  await supabase.from('affiliate_conversion_events').insert({
    conversion_id: conversionId,
    event_type: 'CONVERSION_CREATED',
    status_before: null,
    status_after: initialStatus,
    amount: normalized.saleAmount,
    commission: normalized.commissionAmount ?? 0,
    currency: normalized.currency,
    raw_payload: normalized as unknown as Record<string, unknown>,
  });

  return { outcome: 'created', conversionId, status: initialStatus };
}

export function isValidConversionTransition(from: ConversionStatus, to: ConversionStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// آلة الحالة (3.4) -- يرفض أي تحويلة غير مسموحة بدل ما يطبّقها بصمت.
export async function transitionConversionStatus(
  supabase: SupabaseClient,
  conversionId: string,
  toStatus: ConversionStatus,
  opts?: { reason?: string; providerEventId?: string; rawPayload?: unknown }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: conversion, error: fetchError } = await supabase
    .from('affiliate_conversions')
    .select('conversion_status, sale_amount, commission_amount, currency')
    .eq('id', conversionId)
    .single();

  if (fetchError || !conversion) return { ok: false, error: 'conversion_not_found' };

  const fromStatus = conversion.conversion_status as ConversionStatus;
  if (!isValidConversionTransition(fromStatus, toStatus)) {
    return { ok: false, error: `invalid_transition_${fromStatus}_to_${toStatus}` };
  }

  const timestampColumn =
    toStatus === 'APPROVED' ? 'approved_at' : toStatus === 'REVERSED' ? 'reversed_at' : toStatus === 'PAID' ? 'paid_at' : null;

  const { error: updateError } = await supabase
    .from('affiliate_conversions')
    .update({
      conversion_status: toStatus,
      updated_at: new Date().toISOString(),
      ...(timestampColumn ? { [timestampColumn]: new Date().toISOString() } : {}),
    })
    .eq('id', conversionId);

  if (updateError) return { ok: false, error: updateError.message };

  await supabase.from('affiliate_conversion_events').insert({
    conversion_id: conversionId,
    event_type: EVENT_TYPE_FOR_STATUS[toStatus] ?? 'STATUS_CHANGED',
    provider_event_id: opts?.providerEventId ?? null,
    status_before: fromStatus,
    status_after: toStatus,
    amount: conversion.sale_amount,
    commission: conversion.commission_amount,
    currency: conversion.currency,
    raw_payload: opts?.rawPayload ?? (opts?.reason ? { reason: opts.reason } : null),
  });

  return { ok: true };
}
