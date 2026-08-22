import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateCommission, markPayoutReceived, postLedgerEntry } from './commissionService';
import { matchConversionToClick } from './clickMatching';
import { markPostbackEvent, processConversionEvent, transitionConversionStatus } from './conversionEngine';
import { loadProviderCredentials } from './providers/credentials';
import { ProviderFactory } from './providers/factory';
import type { QueuedJob } from './jobs';
import type { NormalizedConversion } from './types';

type ActiveIntegration = { affiliate_program_id: string; provider_code: string; id: string };

async function getActiveIntegrations(supabase: SupabaseClient, excludeCode?: string): Promise<ActiveIntegration[]> {
  let query = supabase
    .from('affiliate_provider_integrations')
    .select('id, affiliate_program_id, provider_code')
    .eq('status', 'active');
  if (excludeCode) query = query.neq('provider_code', excludeCode);
  const { data } = await query;
  return (data ?? []) as ActiveIntegration[];
}

// المهمة الوحيدة اللي تشتغل فعلياً اليوم بدون أي مزوّد خارجي مربوط -- تنظيف
// دوري لسجلات الكليكات المنتهية (خارج نافذة الإسناد، ما إلها قيمة تحتفظ فيها).
export async function runCleanupTrackingData(supabase: SupabaseClient): Promise<string> {
  const { error, count } = await supabase
    .from('affiliate_click_events')
    .delete({ count: 'exact' })
    .lt('expires_at', new Date().toISOString());

  if (error) throw new Error(`cleanup failed: ${error.message}`);
  return `deleted ${count ?? 0} expired click events`;
}

// تحويلات UNMATCHED ممكن كليكها يوصل متأخر (تأخير شبكة/postback) -- هذي
// المهمة تعيد محاولة المطابقة دورياً بدل ما تفضل عالقة UNMATCHED للأبد.
export async function runMatchUnmatchedConversions(supabase: SupabaseClient): Promise<string> {
  // Fix 4: ينتقي أيضاً provider_click_id المخزّن وقت الإنشاء -- بدون هالعمود
  // كانت المهمة تمرر click_id الفارغ دايماً (UNMATCHED يعني click_id=null
  // بالتعريف) وما تقدر تطابق شي أبداً.
  const { data: unmatched } = await supabase
    .from('affiliate_conversions')
    .select('id, affiliate_program_id, provider_conversion_id, click_id, provider_click_id')
    .eq('conversion_status', 'UNMATCHED')
    .limit(200);

  if (!unmatched || unmatched.length === 0) return 'no unmatched conversions';

  let linked = 0;
  for (const row of unmatched) {
    const matched = await matchConversionToClick(supabase, row.affiliate_program_id as string, {
      providerConversionId: row.provider_conversion_id as string,
      saleAmount: 0,
      currency: 'AED',
      conversionTime: new Date().toISOString(),
      clickId: row.click_id as string | null,
      providerClickId: row.provider_click_id as string | null,
    });
    if (!matched) continue;

    await supabase.from('affiliate_conversions').update({ click_id: matched }).eq('id', row.id);
    const result = await transitionConversionStatus(supabase, row.id as string, 'PENDING', { reason: 'auto-matched by MatchUnmatchedConversions job' });
    if (result.ok) linked += 1;
  }
  return `linked ${linked}/${unmatched.length} previously unmatched conversions`;
}

// يعيد حساب عمولة تحويلة محدّدة (زر يدوي بلوحة الأدمن -- Phase 8) ويسجّل
// الفرق كقيد MANUAL_ADJUSTMENT بدفتر الأستاذ بدل ما يعدّل الأرقام القديمة.
export async function runRecalculateCommission(supabase: SupabaseClient, payload: Record<string, unknown>): Promise<string> {
  const conversionId = payload.conversionId as string;
  if (!conversionId) throw new Error('RecalculateCommission requires payload.conversionId');

  const { data: conversion, error } = await supabase
    .from('affiliate_conversions')
    .select('affiliate_program_id, sale_amount, commission_amount, currency, product_id')
    .eq('id', conversionId)
    .single();
  if (error || !conversion) throw new Error(`conversion not found: ${conversionId}`);

  const recalculated = await calculateCommission(supabase, conversion.affiliate_program_id as string, {
    saleAmount: conversion.sale_amount as number,
    providerCommission: undefined,
    productCategory: null,
  });

  const diff = Math.round((recalculated.amount - Number(conversion.commission_amount)) * 100) / 100;
  if (diff === 0) return 'no change';

  await supabase.from('affiliate_conversions').update({ commission_amount: recalculated.amount, updated_at: new Date().toISOString() }).eq('id', conversionId);
  await postLedgerEntry(supabase, {
    affiliateProgramId: conversion.affiliate_program_id as string,
    conversionId,
    eventType: 'MANUAL_ADJUSTMENT',
    amount: diff,
    currency: conversion.currency as string,
    reference: `recalculated commission (${recalculated.source})`,
  });
  return `adjusted commission by ${diff} ${conversion.currency}`;
}

// يعلّم دفعة كمستلمة ويسجّل PAYOUT_RECEIVED بدفتر الأستاذ -- يقفل الفجوة
// اللي خلّيناها مفتوحة بـ Phase 4 (تحويل PAID ما كان يسجّل قيد دفع فعلي
// لعدم وجود مبلغ تسوية حقيقي وقتها؛ هذي المهمة تُستدعى لما إدمن يسجّل دفعة
// حقيقية بـ affiliate_payouts عبر Phase 8's PayoutsTab).
export async function runProcessPayout(supabase: SupabaseClient, payload: Record<string, unknown>): Promise<string> {
  const payoutId = payload.payoutId as string;
  if (!payoutId) throw new Error('ProcessPayout requires payload.payoutId');

  const result = await markPayoutReceived(supabase, payoutId);
  return result.outcome === 'already_processed' ? 'already processed' : `payout ${payoutId} marked received`;
}

// يعالج حدث postback خام مخزَّن مسبقاً (Phase 3's affiliate_postback_events)
// بشكل غير متزامن -- يفكّ ترميزه عبر أدابتر المزوّد المناسب ثم يشغّل أنبوب
// التحويلات الكامل (Phase 3/4). الويبهوك المتزامن الموجود حالياً
// (affiliate-purchase) يعالج فوراً بدون طابور؛ هذا المسار يخدم مزوّدين
// جدد (Phase 6) يحتاجون رد سريع (200) قبل أي معالجة.
export async function runProcessAffiliateWebhook(supabase: SupabaseClient, payload: Record<string, unknown>): Promise<string> {
  const postbackEventId = payload.postbackEventId as string;
  if (!postbackEventId) throw new Error('ProcessAffiliateWebhook requires payload.postbackEventId');

  const { data: event, error } = await supabase
    .from('affiliate_postback_events')
    .select('affiliate_program_id, provider_code, raw_payload, status')
    .eq('id', postbackEventId)
    .single();
  if (error || !event) throw new Error(`postback event not found: ${postbackEventId}`);

  // Fix 1 (حارس دفاعي): لو الحدث خلص فعلاً (رُفض/عُولج/مكرر) قبل ما تشتغل
  // هالمهمة (مثلاً أعيدت جدولتها قبل نشر إصلاح)، ما نعيد معالجته من الصفر.
  if (event.status !== 'received') {
    return `skipped: event already finalized (${event.status})`;
  }

  if (!event.affiliate_program_id || !event.provider_code) {
    await markPostbackEvent(supabase, postbackEventId, 'rejected', 'missing program/provider on event');
    return 'rejected: missing program/provider';
  }

  try {
    const provider = ProviderFactory.forCode(event.provider_code as string);
    const normalized = provider.parseConversion(event.raw_payload);
    const result = await processConversionEvent(supabase, event.affiliate_program_id as string, normalized);
    await markPostbackEvent(supabase, postbackEventId, result.outcome === 'duplicate' ? 'duplicate' : 'processed');
    return `conversion ${result.outcome}: ${result.conversionId}`;
  } catch (err) {
    // Fix 5: payload تالف أو محوّل فشل -- نعلّم الحدث بخطأ موثّق بدل ما يضل
    // 'received' للأبد وتنتهي المهمة ميتة بدون أثر
    const message = err instanceof Error ? err.message : String(err);
    await markPostbackEvent(supabase, postbackEventId, 'error', message);
    throw err; // نعيد رميه عشان جدول الإعادة بالمهمة يشتغل كما صُمّم
  }
}

// يسحب تحويلات المزوّدين النشطين اللي عندهم conversion_api/transaction_api
// (Awin/CJ) للفترة الأخيرة. حالياً كل البرامج المفعّلة "direct" (بدون شبكة
// وسيطة)، فهذي تشتغل بدون أي عمل فعلي حتى يُربط أول برنامج شبكة حقيقي --
// السقالة صحيحة وجاهزة لذلك اليوم.
export async function runSyncProviderConversions(supabase: SupabaseClient, sinceDays: number): Promise<string> {
  const integrations = await getActiveIntegrations(supabase, 'direct');
  if (integrations.length === 0) return 'no active network-backed integrations to sync';

  const start = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const end = new Date();
  let totalFetched = 0;
  let totalProcessed = 0;

  for (const integration of integrations) {
    const provider = ProviderFactory.forCode(integration.provider_code);
    if (!provider.capabilities.conversion_api) continue;

    const credentials = await loadProviderCredentials(supabase, integration.id);
    let conversions: NormalizedConversion[] = [];
    try {
      conversions = await provider.fetchConversions(start, end, credentials);
    } catch (err) {
      console.error(`[affiliate-jobs] fetchConversions failed for ${integration.provider_code}:`, err);
      continue;
    }

    totalFetched += conversions.length;
    for (const normalized of conversions) {
      const result = await processConversionEvent(supabase, integration.affiliate_program_id, normalized);
      if (result.outcome === 'created') totalProcessed += 1;
    }
  }

  return `fetched ${totalFetched}, created ${totalProcessed} new conversions across ${integrations.length} integration(s)`;
}

export async function runJob(supabase: SupabaseClient, job: QueuedJob): Promise<string> {
  switch (job.job_type) {
    case 'CleanupTrackingData':
      return runCleanupTrackingData(supabase);
    case 'MatchUnmatchedConversions':
      return runMatchUnmatchedConversions(supabase);
    case 'RecalculateCommission':
      return runRecalculateCommission(supabase, job.payload);
    case 'ProcessPayout':
      return runProcessPayout(supabase, job.payload);
    case 'ProcessAffiliateWebhook':
      return runProcessAffiliateWebhook(supabase, job.payload);
    case 'SyncProviderConversions':
      return runSyncProviderConversions(supabase, 7);
    case 'SyncProviderConversionsFull':
      return runSyncProviderConversions(supabase, 7); // نفس نافذة الـ7 أيام الافتراضية -- الفرق الحقيقي (نطاق أوسع/تايمنق ليلي) يُضبط من المجدول الخارجي، مو المنطق هنا
    case 'ReconcileProvider':
      return 'reconciliation trigger requires a manual programId/period -- not auto-scheduled yet (no live network program to reconcile)';
    case 'ImportAffiliateReport':
      // ما يُجدوَل أبداً -- استيراد CSV يصير متزامن كامل جوّا
      // /api/admin/affiliate/imports's POST handler وقت الرفع مباشرة (ملف
      // صغير نسبياً، ما يستاهل تعقيد queue+storage bucket لتخزين الملف
      // بينهما). هذا الفرع موجود بس لاكتمال المطابقة مع JobType.
      throw new Error('ImportAffiliateReport is never enqueued -- processed synchronously by the imports API route');
    default:
      throw new Error(`unknown job type: ${job.job_type}`);
  }
}
