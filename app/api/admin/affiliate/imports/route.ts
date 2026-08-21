import { NextResponse } from 'next/server';
import { parseCsv } from '@/lib/affiliate/csv';
import { processConversionEvent } from '@/lib/affiliate/conversionEngine';
import { ProviderFactory } from '@/lib/affiliate/providers/factory';
import { startReportImport } from '@/lib/affiliate/reconciliationService';
import { requireAdmin } from '@/lib/adminAuth';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { withErrorHandler } from '@/lib/errorHandler';

// POST multipart/form-data: file (CSV), affiliate_program_id
// يستورد تقرير تحويلات مُصدَّر يدوياً من لوحة المزوّد (Amazon Associates
// Central وغيرها -- المزوّدات اللي ما عندها API حي، report_import=true
// بقدراتها). كل صف يمر بنفس أنبوب Phase 3 (processConversionEvent) عبر
// أدابتر المزوّد نفسه (parseConversion) -- ما فيه منطق تحليل مكرر هنا،
// عشان أي عمود/صيغة خاصة بمزوّد يبقى بمكانه الوحيد (providers/*).
export const POST = withErrorHandler(async (request: Request) => {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');
  const affiliateProgramId = formData?.get('affiliate_program_id');

  if (!(file instanceof File) || typeof affiliateProgramId !== 'string' || !affiliateProgramId) {
    return NextResponse.json({ error: 'file and affiliate_program_id are required' }, { status: 400 });
  }

  const supabase = getAdminClient();
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { data: integration } = await supabase
    .from('affiliate_provider_integrations')
    .select('id, provider_code')
    .eq('affiliate_program_id', affiliateProgramId)
    .eq('status', 'active')
    .maybeSingle();

  if (!integration) {
    return NextResponse.json({ error: 'no active provider integration for this program' }, { status: 400 });
  }

  const provider = ProviderFactory.forCode(integration.provider_code as string);
  if (!provider.capabilities.report_import) {
    return NextResponse.json({ error: `${integration.provider_code} does not support CSV report import` }, { status: 400 });
  }

  const started = await startReportImport(supabase, { affiliateProgramId, fileName: file.name, fileBuffer });
  if (started.outcome === 'already_imported') {
    return NextResponse.json({ error: 'duplicate file -- already imported', importId: started.importId }, { status: 409 });
  }

  const importId = started.importId;

  await supabase.from('affiliate_report_imports').update({ status: 'processing' }).eq('id', importId);

  try {
    const rows = parseCsv(fileBuffer.toString('utf8'));
    let matched = 0;
    let unmatched = 0;
    let duplicate = 0;
    const errorLog: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const normalized = provider.parseConversion(rows[i]);
        const result = await processConversionEvent(supabase, affiliateProgramId, normalized);
        if (result.outcome === 'duplicate') duplicate += 1;
        else if (result.status === 'UNMATCHED') unmatched += 1;
        else matched += 1;
      } catch (err) {
        errorLog.push({ row: i + 2, error: err instanceof Error ? err.message : String(err) }); // +2: 1-index + header row
      }
    }

    await supabase
      .from('affiliate_report_imports')
      .update({
        status: 'completed',
        rows_processed: rows.length,
        rows_matched: matched,
        rows_unmatched: unmatched,
        rows_duplicate: duplicate,
        imported_at: new Date().toISOString(),
        error_log: errorLog.length > 0 ? errorLog : null,
      })
      .eq('id', importId);

    return NextResponse.json({ importId, rowsProcessed: rows.length, matched, unmatched, duplicate, errors: errorLog.length });
  } catch (err) {
    // فشل غير متوقع (مو فشل صف مفرد -- ذاك متتبَّع بـ errorLog) -- علّم
    // الاستيراد failed عشان ما يعلق على processing للأبد، وخلّي withErrorHandler
    // يكوّن رد الخطأ للعميل.
    await supabase.from('affiliate_report_imports').update({ status: 'failed' }).eq('id', importId);
    throw err;
  }
});
