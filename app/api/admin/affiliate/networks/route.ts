import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { parsePagination, paginateQuery } from '@/lib/db/pagination';

const COLUMNS = 'id, name, code, website_url, api_base_url, status, integration_type, created_at';

// GET /api/admin/affiliate/networks?status=active
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = getAdminClient();
  const { searchParams } = new URL(request.url);
  const pagination = parsePagination(searchParams);

  let query = supabase.from('affiliate_networks').select(COLUMNS, { count: 'exact' });
  const status = searchParams.get('status');
  if (status) query = query.eq('status', status);
  query = query.order('name');

  try {
    const result = await paginateQuery(query, pagination);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// PATCH ?id=... { status?, website_url?, api_base_url? }
// الشبكات بيانات مرجعية -- ما فيه DELETE حقيقي، الحالة 'deprecated' بدلها.
export async function PATCH(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const supabase = getAdminClient();
  const { data, error } = await supabase.from('affiliate_networks').update(body).eq('id', id).select(COLUMNS).single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
