import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { parsePagination, paginateQuery } from '@/lib/db/pagination';
import { withErrorHandler } from '@/lib/errorHandler';

const COLUMNS = 'id, affiliate_program_id, product_id, name, destination_url, token, status, created_at';

// GET /api/admin/affiliate/links?affiliate_program_id=...&status=active
// يرجّع click_count محسوب باستعلام واحد مجمّع بدل استعلام منفصل لكل رابط.
export const GET = withErrorHandler(async (request: Request) => {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = getAdminClient();
  const { searchParams } = new URL(request.url);
  const pagination = parsePagination(searchParams);

  let query = supabase.from('affiliate_links').select(COLUMNS, { count: 'exact' });
  const programId = searchParams.get('affiliate_program_id');
  if (programId) query = query.eq('affiliate_program_id', programId);
  const status = searchParams.get('status');
  if (status) query = query.eq('status', status);
  query = query.order('name');

  const result = await paginateQuery<Record<string, unknown>>(query, pagination);

  if (result.data.length > 0) {
    const linkIds = result.data.map((l) => l.id as string);
    const { data: clickRows } = await supabase.from('affiliate_click_events').select('affiliate_link_id').in('affiliate_link_id', linkIds);
    const counts: Record<string, number> = {};
    for (const id of linkIds) counts[id] = 0;
    for (const row of clickRows ?? []) {
      counts[row.affiliate_link_id as string] = (counts[row.affiliate_link_id as string] ?? 0) + 1;
    }
    result.data = result.data.map((link) => ({ ...link, click_count: counts[link.id as string] ?? 0 }));
  }

  return NextResponse.json(result);
});

// POST { affiliate_program_id, name, destination_url, product_id? }
// token يتولّد تلقائياً من عمود القاعدة الافتراضي -- ما نرسله.
export const POST = withErrorHandler(async (request: Request) => {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (!body.affiliate_program_id || !body.name || !body.destination_url) {
    return NextResponse.json({ error: 'affiliate_program_id, name, and destination_url are required' }, { status: 400 });
  }

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('affiliate_links')
    .insert({
      affiliate_program_id: body.affiliate_program_id,
      name: body.name,
      destination_url: body.destination_url,
      product_id: body.product_id ?? null,
    })
    .select(COLUMNS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 201 });
});

// PATCH ?id=... { status? }
export const PATCH = withErrorHandler(async (request: Request) => {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const supabase = getAdminClient();
  const { data, error } = await supabase.from('affiliate_links').update(body).eq('id', id).select(COLUMNS).single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
});
