import type { SupabaseClient } from '@supabase/supabase-js';
import type { NormalizedConversion } from './types';

// أولوية المطابقة (Reference Architecture -- Click Matching Priority):
// 1. الـ click_id الداخلي (تطابق تام على affiliate_click_events.click_id)
// 2. click_id المزوّد (تطابق تام على affiliate_click_events.provider_click_id)
// 3-4. مطابقة حتمية خاصة بالمزوّد (تُفوَّض للمحول -- Phase 6)
//
// ممنوع أي مطابقة تخمينية (نفس التاريخ + نفس المنتج + نفس المبلغ) كمطابقة
// مالية آلية إلا لو المزوّد يضمن التفرّد.
export async function matchConversionToClick(
  supabase: SupabaseClient,
  programId: string,
  normalized: NormalizedConversion
): Promise<string | null> {
  if (normalized.clickId) {
    const { data } = await supabase
      .from('affiliate_click_events')
      .select('click_id')
      .eq('click_id', normalized.clickId)
      .eq('affiliate_program_id', programId)
      .maybeSingle();
    if (data) return data.click_id as string;
  }

  if (normalized.providerClickId) {
    const { data } = await supabase
      .from('affiliate_click_events')
      .select('click_id')
      .eq('provider_click_id', normalized.providerClickId)
      .eq('affiliate_program_id', programId)
      .maybeSingle();
    if (data) return data.click_id as string;
  }

  // ما فيه مطابقة أولوية 3-4 لسه (تحتاج محول مزوّد -- Phase 6) -- يرجع
  // null فتنحفظ التحويلة بحالة UNMATCHED بدل ما تُهمل.
  return null;
}
