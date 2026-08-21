import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { parsePagination, paginateQuery } from '@/lib/db/pagination';
import { isValidConversionTransition, transitionConversionStatus } from '@/lib/affiliate/conversionEngine';
import type { ConversionStatus } from '@/lib/affiliate/types';

const COLUMNS =
  'id, affiliate_program_id, click_id, provider_conversion_id, sale_amount, commission_amount, currency, conversion_status, conversion_time';

// GET /api/admin/affiliate/conversions?affiliate_program_id=...&conversion_status=...&date_from=...&date_to=...
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = getAdminClient();
  const { searchParams } = new URL(request.url);
  const pagination = parsePagination(searchParams);

  let query = supabase.from('affiliate_conversions').select(COLUMNS, { count: 'exact' });

  const programId = searchParams.get('affiliate_program_id');
  if (programId) query = query.eq('affiliate_program_id', programId);
  const status = searchParams.get('conversion_status');
  if (status) query = query.eq('conversion_status', status);
  const dateFrom = searchParams.get('date_from');
  if (dateFrom) query = query.gte('conversion_time', dateFrom);
  const dateTo = searchParams.get('date_to');
  if (dateTo) query = query.lte('conversion_time', dateTo);

  query = query.order('conversion_time', { ascending: false });

  try {
    const result = await paginateQuery(query, pagination);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// PATCH ?id=... { conversion_status } -- تحويلة حالة يدوية عبر الأدمن، تمر
// بنفس آلة الحالة والتحقق اللي يستخدمها المحرك (conversionEngine.ts) --
// ما فيه تكرار منطق، هذا الراوت يستدعي نفس الدالة اللي كانت تُستدعى من
// العميل مباشرة قبل هذا التعديل.
export async function PATCH(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { conversion_status?: ConversionStatus; reason?: string };
  if (!body.conversion_status) return NextResponse.json({ error: 'conversion_status is required' }, { status: 400 });

  const supabase = getAdminClient();
  const { data: current, error: fetchError } = await supabase.from('affiliate_conversions').select('conversion_status').eq('id', id).single();
  if (fetchError || !current) return NextResponse.json({ error: 'conversion not found' }, { status: 404 });

  if (!isValidConversionTransition(current.conversion_status as ConversionStatus, body.conversion_status)) {
    return NextResponse.json({ error: `cannot transition from ${current.conversion_status} to ${body.conversion_status}` }, { status: 400 });
  }

  const result = await transitionConversionStatus(supabase, id, body.conversion_status, {
    reason: body.reason ?? `manual admin action by ${admin.email ?? admin.id}`,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const { data } = await supabase.from('affiliate_conversions').select(COLUMNS).eq('id', id).single();
  return NextResponse.json({ data });
}
