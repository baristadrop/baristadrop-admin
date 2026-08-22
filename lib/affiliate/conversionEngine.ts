import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateCommission } from './commissionService';
import { matchConversionToClick } from './clickMatching';
import { enqueueJob } from './jobs';
import type { ConversionStatus, NormalizedConversion } from './types';

/** آلة الحالة (3.4 بالخطة) -- التحويلات المسموحة فقط. Fix 9: الفرض الفعلي
 * صار داخل دالة `affiliate_transition_conversion` بقاعدة البيانات (يمنع أي
 * تحديث مباشر يتجاوز هذا التطبيق) -- هذي النسخة تبقى مصدّرة لأن الواجهة
 * (ConversionsTab) والاختبارات تستخدمها كفحص سريع بدون استدعاء شبكة. */
const VALID_TRANSITIONS: Record<ConversionStatus, ConversionStatus[]> = {
  PENDING: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['PAID', 'REVERSED'],
  REJECTED: [],
  CANCELLED: [],
  REVERSED: [],
  PAID: [],
  UNMATCHED: ['PENDING'], // لما تنربط يدوياً بكليك
};

// بصمة الطلب الوارد -- تكفي لتحقيقات إساءة الاستعمال وقوائم حظر IP لاحقاً (Fix 10)
export function forensicFields(request: Request): { source_ip: string | null; request_headers: Record<string, unknown> } {
  return {
    source_ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    request_headers: {
      'content-type': request.headers.get('content-type'),
      'user-agent': request.headers.get('user-agent'),
      signature: request.headers.get('x-signature') ?? request.headers.get('x-awin-signature'),
    },
  };
}

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
    sourceIp?: string | null;
    requestHeaders?: Record<string, unknown> | null;
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
      source_ip: params.sourceIp ?? null,
      request_headers: params.requestHeaders ?? null,
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

// خطوات 3، 5، 6، 7 من الأنبوب (3.2 بالخطة). خطوة 4 (Normalize) مسؤولية
// المستدعي (محول المزوّد -- Phase 6) -- الدالة هذي تستقبل NormalizedConversion
// جاهزة وما تحلل أي payload خام بنفسها.
export async function processConversionEvent(
  supabase: SupabaseClient,
  affiliateProgramId: string,
  normalized: NormalizedConversion
): Promise<ProcessConversionResult> {
  // خطوة 3 (نصف 1): فحص التكرار -- UNIQUE(program_id, provider_conversion_id)
  const { data: existing } = await supabase
    .from('affiliate_conversions')
    .select('id, conversion_status')
    .eq('affiliate_program_id', affiliateProgramId)
    .eq('provider_conversion_id', normalized.providerConversionId)
    .maybeSingle();

  if (existing) {
    return { outcome: 'duplicate', conversionId: existing.id as string, status: existing.conversion_status as ConversionStatus };
  }

  // Fix 6 (خطوة 3 نصف 2): نفس الحدث الخام ما يتحول مرتين حتى لو اختلف
  // provider_conversion_id (بوستباك + سحب API لنفس البيع).
  if (normalized.rawEventId) {
    const { data: byEvent } = await supabase
      .from('affiliate_conversions')
      .select('id, conversion_status')
      .eq('affiliate_program_id', affiliateProgramId)
      .eq('raw_event_id', normalized.rawEventId)
      .maybeSingle();
    if (byEvent) {
      return { outcome: 'duplicate', conversionId: byEvent.id as string, status: byEvent.conversion_status as ConversionStatus };
    }
  }

  // خطوة 5: مطابقة الكليك
  const clickId = await matchConversionToClick(supabase, affiliateProgramId, normalized);
  const initialStatus: ConversionStatus = clickId ? 'PENDING' : 'UNMATCHED';

  // خطوة 7 (محسوبة قبل الإدراج عشان نخزّن commission_amount الصحيح من أول
  // مرة): لو المزوّد ما أرسل عمولة صريحة، تُطبَّق قواعد العمولة النشطة
  // للبرنامج (Phase 4 -- commissionService.ts).
  const commission = await calculateCommission(supabase, affiliateProgramId, {
    saleAmount: normalized.saleAmount,
    providerCommission: normalized.providerCommission,
    productCategory: normalized.productCategory,
  });

  // خطوة 6+7 (Fix 9): إنشاء التحويلة + حدث CONVERSION_CREATED + قيد
  // CONVERSION_PENDING بمعاملة SQL ذرية واحدة -- بدل 3 كتابات منفصلة كانت
  // تقدر تترك حالة مالية غير متسقة لو فشلت بالنص.
  const { data: rpcResult, error } = await supabase.rpc('affiliate_record_conversion', {
    p_program_id: affiliateProgramId,
    p_click_id: clickId,
    p_provider_conversion_id: normalized.providerConversionId,
    p_provider_transaction_id: normalized.providerTransactionId ?? null,
    p_order_id: normalized.orderId ?? null,
    p_product_id: normalized.productId ?? null,
    p_sale_amount: normalized.saleAmount,
    p_commission_amount: commission.amount,
    p_currency: normalized.currency,
    p_exchange_rate: normalized.exchangeRate ?? null,
    p_base_amount: normalized.baseAmount ?? null,
    p_base_currency: normalized.baseCurrency ?? null,
    p_conversion_status: initialStatus,
    p_conversion_time: normalized.conversionTime,
    p_customer_reference: normalized.customerReference ?? null,
    p_raw_event_id: normalized.rawEventId ?? null,
    p_provider_click_id: normalized.providerClickId ?? null,
    p_normalized_payload: normalized as unknown as Record<string, unknown>,
  });

  if (error) throw new Error(`rpc failed: ${error.message}`);

  const json = rpcResult as { outcome: 'created' | 'duplicate'; conversion_id: string; status?: string };
  if (json.outcome === 'duplicate') {
    return { outcome: 'duplicate', conversionId: json.conversion_id, status: json.status as ConversionStatus };
  }

  // Fix 14: كليك المزوّد ممكن يوصل متأخر -- نجدول إعادة مطابقة بدل انتظار
  // المجدول الدوري فقط. حراسة ضد التكديس: نتحقق ما فيه مهمة من نفس النوع
  // شغّالة/بالانتظار قبل ما نضيف وحدة جديدة.
  if (initialStatus === 'UNMATCHED') {
    const { data: pendingJobs } = await supabase
      .from('affiliate_jobs')
      .select('id')
      .eq('job_type', 'MatchUnmatchedConversions')
      .in('status', ['pending', 'failed', 'running'])
      .limit(1);
    if (!pendingJobs || pendingJobs.length === 0) {
      await enqueueJob(supabase, 'MatchUnmatchedConversions', {}, { runAt: new Date(Date.now() + 30 * 60 * 1000) });
    }
  }

  return { outcome: 'created', conversionId: json.conversion_id, status: initialStatus };
}

export function isValidConversionTransition(from: ConversionStatus, to: ConversionStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// آلة الحالة (3.4) -- Fix 9: الانتقال + الحدث + قيد دفتر الأستاذ (بما فيها
// قيد الموافقة المزدوج المتعادل، Fix 13) صارت بمعاملة SQL ذرية واحدة
// (affiliate_transition_conversion) بدل 2-3 كتابات منفصلة كانت تقدر تترك
// حالة غير متسقة لو فشلت بالنص. الدالة نفسها بقاعدة البيانات ترمي
// invalid_transition_<من>_<إلى> على أي انتقال غير مسموح -- نفس الحراسة
// اللي كانت هنا بـ isValidConversionTransition، بس مفروضة الآن حتى على أي
// كتابة مباشرة تتجاوز هذا الكود.
export async function transitionConversionStatus(
  supabase: SupabaseClient,
  conversionId: string,
  toStatus: ConversionStatus,
  opts?: { reason?: string; providerEventId?: string; rawPayload?: unknown }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.rpc('affiliate_transition_conversion', {
    p_conversion_id: conversionId,
    p_to_status: toStatus,
    p_reason: opts?.reason ?? null,
    p_provider_event_id: opts?.providerEventId ?? null,
    p_raw_payload: opts?.rawPayload ?? null,
  });

  if (error) {
    // conversion_not_found / invalid_transition_* -- كلاهما يرجع {ok:false}
    // بدل رمي استثناء، عشان المستدعين الحاليين (راوت المحادثات، مهمة إعادة
    // المطابقة اللي تلف على عدة تحويلات) يفضلون يشتغلون بنفس السلوك السابق.
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
