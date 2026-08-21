import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { parsePagination, paginateQuery } from '@/lib/db/pagination';

const COLUMNS =
  'id, name, merchant_id, network_id, tracking_method, conversion_method, commission_model, currency, status, legacy_roaster_id, legacy_supplier_id, created_at';

// GET /api/admin/affiliate/programs?merchant_id=...&network_id=...&status=active
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = getAdminClient();
  const { searchParams } = new URL(request.url);
  const pagination = parsePagination(searchParams);

  let query = supabase.from('affiliate_programs').select(COLUMNS, { count: 'exact' });

  const merchantId = searchParams.get('merchant_id');
  if (merchantId) query = query.eq('merchant_id', merchantId);
  const networkId = searchParams.get('network_id');
  if (networkId) query = query.eq('network_id', networkId);
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

// POST { name, merchant_id, network_id?, commission_model? }
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (!body.name || !body.merchant_id) {
    return NextResponse.json({ error: 'name and merchant_id are required' }, { status: 400 });
  }

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('affiliate_programs')
    .insert({
      name: body.name,
      merchant_id: body.merchant_id,
      network_id: body.network_id ?? null,
      commission_model: (body.commission_model as string) ?? 'percentage',
      currency: (body.currency as string) ?? 'AED',
    })
    .select(COLUMNS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 201 });
}

// PATCH ?id=... { status?, commission_model?, currency?, ... }
export async function PATCH(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const supabase = getAdminClient();
  const { data, error } = await supabase.from('affiliate_programs').update(body).eq('id', id).select(COLUMNS).single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
