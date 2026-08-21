import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { parseCsv } from '@/lib/affiliate/csv';
import { processConversionEvent } from '@/lib/affiliate/conversionEngine';
import { ProviderFactory } from '@/lib/affiliate/providers/factory';
import { startReportImport } from '@/lib/affiliate/reconciliationService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

async function requireAdmin(request: Request) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return null;
  const asCaller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: userData } = await asCaller.auth.getUser(token);
  if (!userData.user) return null;
  const { data: profile } = await asCaller.from('profiles').select('role').eq('id', userData.user.id).single();
  if (profile?.role !== 'admin') return null;
  return userData.user;
}

// POST multipart/form-data: file (CSV), affiliate_program_id
// يستورد تقرير تحويلات مُصدَّر يدوياً من لوحة المزوّد (Amazon Associates
// Central وغيرها -- المزوّدات اللي ما عندها API حي، report_import=true
// بقدراتها). كل صف يمر بنفس أنبوب Phase 3 (processConversionEvent) عبر
// أدابتر المزوّد نفسه (parseConversion) -- ما فيه منطق تحليل مكرر هنا،
// عشان أي عمود/صيغة خاصة بمزوّد يبقى بمكانه الوحيد (providers/*).
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');
  const affiliateProgramId = formData?.get('affiliate_program_id');

  if (!(file instanceof File) || typeof affiliateProgramId !== 'string' || !affiliateProgramId) {
    return NextResponse.json({ error: 'file and affiliate_program_id are required' }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
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

  try {
    await supabase.from('affiliate_report_imports').update({ status: 'processing' }).eq('id', importId);

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
    const message = err instanceof Error ? err.message : String(err);
    await supabase.from('affiliate_report_imports').update({ status: 'failed', error_log: [{ error: message }] }).eq('id', importId);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
