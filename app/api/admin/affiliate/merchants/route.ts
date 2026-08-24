import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { parsePagination, paginateQuery } from '@/lib/db/pagination';
import { withErrorHandler } from '@/lib/errorHandler';

const COLUMNS = 'id, name, legal_name, website_url, country, currency, status, external_reference, timezone, roaster_id, supplier_id, created_at';

// GET /api/admin/affiliate/merchants?status=active&search=...
export const GET = withErrorHandler(async (request: Request) => {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = getAdminClient();
  const { searchParams } = new URL(request.url);
  const pagination = parsePagination(searchParams);

  let query = supabase.from('affiliate_merchants').select(COLUMNS, { count: 'exact' });

  const status = searchParams.get('status');
  if (status) query = query.eq('status', status);
  const search = searchParams.get('search');
  if (search) query = query.or(`name.ilike.%${search}%,legal_name.ilike.%${search}%`);

  query = query.order('name');

  const result = await paginateQuery(query, pagination);
  return NextResponse.json(result);
});

// POST { name, legal_name?, website_url?, country?, currency?, roaster_id?, supplier_id? }
export const POST = withErrorHandler(async (request: Request) => {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (!body.name || typeof body.name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('affiliate_merchants')
    .insert({
      name: body.name,
      legal_name: body.legal_name ?? null,
      country: body.country ?? null,
      currency: (body.currency as string) ?? 'AED',
      roaster_id: body.roaster_id ?? null,
      supplier_id: body.supplier_id ?? null,
      external_reference: (body.external_reference as string) || null,
      timezone: (body.timezone as string) || 'Asia/Dubai',
    })
    .select(COLUMNS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 201 });
});

// PATCH ?id=... { status?, legal_name?, website_url?, country?, currency? }
export const PATCH = withErrorHandler(async (request: Request) => {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const supabase = getAdminClient();
  const { data, error } = await supabase.from('affiliate_merchants').update(body).eq('id', id).select(COLUMNS).single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
});
