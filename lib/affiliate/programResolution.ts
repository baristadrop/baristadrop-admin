import type { SupabaseClient } from '@supabase/supabase-js';
import type { AffiliateProvider } from './providers/interface';

// يحل برنامج الأفيليت من حدث وارد: يطابق مفتاح المزوّد مع configuration
// التكامل النشط، وإلا يقع على التكامل الوحيد النشط لهذا المزوّد
export async function resolveIntegration(
  supabase: SupabaseClient,
  provider: AffiliateProvider,
  rawPayload: unknown
): Promise<{ id: string; affiliate_program_id: string } | null> {
  const { data: integrations } = await supabase
    .from('affiliate_provider_integrations')
    .select('id, affiliate_program_id, configuration')
    .eq('provider_code', provider.code)
    .eq('status', 'active');

  const rows = integrations ?? [];
  if (rows.length === 0) return null;

  const key = provider.extractProgramKey(rawPayload);
  if (key) {
    const match = rows.find((r) => String((r.configuration as Record<string, unknown>)?.[key.configKey] ?? '') === key.value);
    if (match) return match;
    // مفتاح موجود بالـ payload لكن ما طابق أي تكامل -- حدث مشبوه/مخطئ
    return null;
  }
  return rows.length === 1 ? rows[0] : null; // غامض → لا نخمّن
}
