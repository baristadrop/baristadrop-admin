import { NextResponse } from 'next/server';
import { runReconciliation } from '@/lib/affiliate/reconciliationService';
import { loadProviderCredentials } from '@/lib/affiliate/providers/credentials';
import { ProviderFactory } from '@/lib/affiliate/providers/factory';
import type { ProviderConversionRecord } from '@/lib/affiliate/types';
import { requireAdmin } from '@/lib/adminAuth';
import { getAdminClient } from '@/lib/supabaseAdmin';

// POST { programId, periodStart, periodEnd } -- يشغّل تسوية حقيقية لبرنامج
// معيّن. هذا راوت سيرفر (مو استدعاء مباشر من العميل) لأن جلب تحويلات
// المزوّد يحتاج فك تشفير بيانات الاعتماد (AES key سيرفر فقط -- Phase 6).
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { programId?: string; periodStart?: string; periodEnd?: string };
  if (!body.programId || !body.periodStart || !body.periodEnd) {
    return NextResponse.json({ error: 'programId, periodStart, and periodEnd are required' }, { status: 400 });
  }

  const supabase = getAdminClient();

  const { data: integration } = await supabase
    .from('affiliate_provider_integrations')
    .select('id, provider_code')
    .eq('affiliate_program_id', body.programId)
    .eq('status', 'active')
    .maybeSingle();

  if (!integration) {
    return NextResponse.json({ error: 'no active provider integration for this program -- nothing to reconcile against' }, { status: 400 });
  }

  const provider = ProviderFactory.forCode(integration.provider_code as string);
  if (!provider.capabilities.conversion_api && !provider.capabilities.report_import) {
    return NextResponse.json(
      { error: `${integration.provider_code} has no live API or report source to reconcile against -- capability not supported for this provider type` },
      { status: 400 }
    );
  }

  const start = new Date(body.periodStart);
  const end = new Date(body.periodEnd);
  const credentials = await loadProviderCredentials(supabase, integration.id as string);

  let providerRecords: ProviderConversionRecord[] = [];
  try {
    const conversions = await provider.fetchConversions(start, end, credentials);
    // ملاحظة صادقة: NormalizedConversion ما فيه حقل "حالة" صريح من المزوّد
    // (Awin/CJ ما زالا غير مربوطين فعلياً بحساب حقيقي). نفترض 'APPROVED'
    // لأي سجل رجع من fetchConversions -- تقارير transaction/commission عند
    // أغلب الشبكات أصلاً تسرد صفقات مؤكدة، لكن هذا افتراض مو مضمون 100%
    // حتى يُختبر ضد بيانات حقيقية.
    providerRecords = conversions.map((c) => ({
      providerConversionId: c.providerConversionId,
      amount: c.saleAmount,
      status: 'APPROVED',
      raw: c,
    }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `fetchConversions failed: ${message}` }, { status: 502 });
  }

  try {
    const summary = await runReconciliation(supabase, {
      affiliateProgramId: body.programId,
      providerCode: integration.provider_code as string,
      periodStart: start,
      periodEnd: end,
      providerRecords,
    });
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
