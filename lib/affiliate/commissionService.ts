import type { SupabaseClient } from '@supabase/supabase-js';
import type { CommissionBalance, CommissionResult, LedgerEventType, NormalizedConversion } from './types';

type CommissionRuleRow = {
  id: string;
  commission_model: 'percentage' | 'fixed' | 'per_item' | 'tiered' | 'category' | 'provider_reported';
  rate: number | null;
  min_commission: number | null;
  max_commission: number | null;
  conditions: Record<string, unknown>;
};

function clamp(amount: number, min: number | null, max: number | null): number {
  let result = amount;
  if (min !== null && result < min) result = min;
  if (max !== null && result > max) result = max;
  return Math.round(result * 100) / 100;
}

/** يطبّق قاعدة العمولة على قيمة البيع. النماذج المدعومة تطابق commission_model
 * المخزّن على القاعدة -- tiered يقرأ شرائحه من conditions.tiers (مصفوفة
 * {min, max, rate} مرتبة تصاعدياً). */
function applyRule(rule: CommissionRuleRow, saleAmount: number): number {
  const rate = rule.rate ?? 0;

  switch (rule.commission_model) {
    case 'percentage':
    case 'category':
      return clamp(saleAmount * (rate / 100), rule.min_commission, rule.max_commission);

    case 'fixed':
    case 'per_item':
      return clamp(rate, rule.min_commission, rule.max_commission);

    case 'tiered': {
      const tiers = (rule.conditions?.tiers as Array<{ min: number; max: number | null; rate: number }> | undefined) ?? [];
      const tier = tiers.find((t) => saleAmount >= t.min && (t.max === null || t.max === undefined || saleAmount <= t.max));
      const tierRate = tier?.rate ?? rate;
      return clamp(saleAmount * (tierRate / 100), rule.min_commission, rule.max_commission);
    }

    case 'provider_reported':
    default:
      return 0;
  }
}

async function getActiveRules(
  supabase: SupabaseClient,
  affiliateProgramId: string,
  productCategory: string | null
): Promise<CommissionRuleRow[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('affiliate_commission_rules')
    .select('id, commission_model, rate, min_commission, max_commission, conditions, product_category, priority')
    .eq('affiliate_program_id', affiliateProgramId)
    .lte('effective_from', today)
    .or(`effective_until.is.null,effective_until.gte.${today}`)
    .order('priority', { ascending: false });

  if (error || !data) return [];

  // قاعدة مخصّصة لفئة المنتج لها أولوية على القاعدة العامة (product_category = null)
  // حتى لو أولويتها المُعلَنة أقل.
  const matching = data.filter((rule) => !rule.product_category || rule.product_category === productCategory);
  return matching.sort((a, b) => {
    const aSpecific = a.product_category ? 1 : 0;
    const bSpecific = b.product_category ? 1 : 0;
    if (aSpecific !== bSpecific) return bSpecific - aSpecific;
    return (b.priority ?? 0) - (a.priority ?? 0);
  });
}

// مبادئ أساسية:
// - لو المزوّد أرسل العمولة الفعلية -- تُعتبر مرجعية للتسوية (لا تُحسَب يدوياً)
// - قيود دفتر الأستاذ append-only (تُدرَج فقط، أبداً UPDATE/DELETE على قيد منشور)
// - أي تغيير بالعمولة ينتج قيد جديد بدفتر الأستاذ
// - Multi-currency: يُخزَّن المبلغ الأصلي + التحويل لعملة البرنامج الأساسية دايماً
export async function calculateCommission(
  supabase: SupabaseClient,
  affiliateProgramId: string,
  conversion: Pick<NormalizedConversion, 'saleAmount' | 'providerCommission' | 'productCategory'>
): Promise<CommissionResult> {
  if (conversion.providerCommission !== undefined && conversion.providerCommission !== null) {
    return { amount: conversion.providerCommission, source: 'provider' };
  }

  const rules = await getActiveRules(supabase, affiliateProgramId, conversion.productCategory ?? null);
  const rule = rules[0];
  if (!rule) return { amount: 0, source: 'default' };

  return { amount: applyRule(rule, conversion.saleAmount), source: 'rule', ruleId: rule.id };
}

export async function postLedgerEntry(
  supabase: SupabaseClient,
  params: {
    affiliateProgramId: string;
    conversionId?: string | null;
    eventType: LedgerEventType;
    amount: number;
    currency: string;
    exchangeRate?: number | null;
    baseAmount?: number | null;
    baseCurrency?: string | null;
    reference?: string | null;
    accountingDate?: string; // defaults to today at the DB level
  }
): Promise<void> {
  const { error } = await supabase.from('affiliate_commission_ledger').insert({
    affiliate_program_id: params.affiliateProgramId,
    conversion_id: params.conversionId ?? null,
    event_type: params.eventType,
    amount: params.amount,
    currency: params.currency,
    exchange_rate: params.exchangeRate ?? null,
    base_amount: params.baseAmount ?? null,
    base_currency: params.baseCurrency ?? null,
    reference: params.reference ?? null,
    ...(params.accountingDate ? { accounting_date: params.accountingDate } : {}),
  });

  if (error) throw new Error(`failed to post ledger entry: ${error.message}`);
}

// مشتركة بين jobRunners.ts's ProcessPayout (المسار المجدول) وزر "تسجيل
// كمستلمة" اليدوي بـ PayoutsTab -- منطق واحد، مو نسختين.
export async function markPayoutReceived(supabase: SupabaseClient, payoutId: string): Promise<{ outcome: 'received' | 'already_processed' }> {
  const { data: payout, error } = await supabase
    .from('affiliate_payouts')
    .select('affiliate_program_id, amount, currency, status')
    .eq('id', payoutId)
    .single();
  if (error || !payout) throw new Error(`payout not found: ${payoutId}`);
  if (payout.status === 'RECEIVED' || payout.status === 'RECONCILED') return { outcome: 'already_processed' };

  await supabase.from('affiliate_payouts').update({ status: 'RECEIVED', updated_at: new Date().toISOString() }).eq('id', payoutId);
  await postLedgerEntry(supabase, {
    affiliateProgramId: payout.affiliate_program_id as string,
    eventType: 'PAYOUT_RECEIVED',
    amount: -Number(payout.amount), // دفعة مستلمة تصفّر جزء من "المتوقّع" -- قيد سالب
    currency: payout.currency as string,
    reference: `payout ${payoutId} received`,
  });
  return { outcome: 'received' };
}

// المصدر الأساسي -- استعلام SQL واحد (migration 0079) بدل حلقة صفحات
// متسلسلة. الـ fallback تحته يُستخدم بس لو الـ RPC فشل لأي سبب (مثلاً
// migration 0079 ما طُبّقت بعد ببيئة معيّنة) -- بيانات مالية، أفضل نطمن
// نرجع رقم صحيح دايماً بدل ما نفشل بصمت.
export async function getProgramBalance(supabase: SupabaseClient, affiliateProgramId: string): Promise<CommissionBalance> {
  const { data, error } = await supabase.rpc('calculate_program_balance', { p_program_id: affiliateProgramId });

  if (!error && data && data.length > 0) {
    const row = data[0];
    return {
      expected: Number(row.expected),
      reversed: Number(row.reversed),
      paid: Number(row.paid),
      outstanding: Number(row.outstanding),
      currency: row.currency,
    };
  }

  if (error) console.error('[commissionService] calculate_program_balance RPC failed, falling back to pagination:', error.message);
  return getProgramBalanceLegacy(supabase, affiliateProgramId);
}

const LEDGER_PAGE_SIZE = 1000;

async function getProgramBalanceLegacy(supabase: SupabaseClient, affiliateProgramId: string): Promise<CommissionBalance> {
  const totals: Record<LedgerEventType, number> = {
    CONVERSION_PENDING: 0,
    CONVERSION_APPROVED: 0,
    CONVERSION_REVERSED: 0,
    CONVERSION_REJECTED: 0,
    PAYOUT_RECEIVED: 0,
    PAYOUT_EXPECTED: 0,
    MANUAL_ADJUSTMENT: 0,
    RECONCILIATION_ADJUSTMENT: 0,
  };
  let currency = 'AED';

  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('affiliate_commission_ledger')
      .select('event_type, amount, currency')
      .eq('affiliate_program_id', affiliateProgramId)
      .range(from, from + LEDGER_PAGE_SIZE - 1);

    if (error || !data || data.length === 0) break;

    for (const row of data) {
      totals[row.event_type as LedgerEventType] += Number(row.amount);
      currency = row.currency;
    }

    if (data.length < LEDGER_PAGE_SIZE) break;
    from += LEDGER_PAGE_SIZE;
  }

  const expected = totals.CONVERSION_PENDING + totals.CONVERSION_APPROVED + totals.MANUAL_ADJUSTMENT + totals.RECONCILIATION_ADJUSTMENT;
  const reversed = totals.CONVERSION_REVERSED + totals.CONVERSION_REJECTED;
  const paid = totals.PAYOUT_RECEIVED;

  return {
    expected,
    reversed,
    paid,
    outstanding: expected + reversed + paid,
    currency,
  };
}
