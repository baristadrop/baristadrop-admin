import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { parsePagination, paginateQuery } from '@/lib/db/pagination';
import { markPayoutReceived } from '@/lib/affiliate/commissionService';
import { withErrorHandler } from '@/lib/errorHandler';

const COLUMNS = 'id, affiliate_program_id, amount, currency, status, payout_date, period_start, period_end, payment_reference, created_at';

// GET /api/admin/affiliate/payouts?affiliate_program_id=...&status=...
export const GET = withErrorHandler(async (request: Request) => {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = getAdminClient();
  const { searchParams } = new URL(request.url);
  const pagination = parsePagination(searchParams);

  let query = supabase.from('affiliate_payouts').select(COLUMNS, { count: 'exact' });
  const programId = searchParams.get('affiliate_program_id');
  if (programId) query = query.eq('affiliate_program_id', programId);
  const status = searchParams.get('status');
  if (status) query = query.eq('status', status);
  query = query.order('payout_date', { ascending: false });

  const result = await paginateQuery(query, pagination);
  return NextResponse.json(result);
});

// POST { affiliate_program_id, amount, currency?, payout_date?, payment_reference? }
export const POST = withErrorHandler(async (request: Request) => {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const amount = Number(body.amount);
  if (!body.affiliate_program_id || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'affiliate_program_id and a positive amount are required' }, { status: 400 });
  }

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('affiliate_payouts')
    .insert({
      affiliate_program_id: body.affiliate_program_id,
      amount,
      currency: (body.currency as string) ?? 'AED',
      payout_date: body.payout_date ?? new Date().toISOString().slice(0, 10),
      period_start: body.period_start ?? null,
      period_end: body.period_end ?? null,
      payment_reference: body.payment_reference ?? null,
    })
    .select(COLUMNS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 201 });
});

// PATCH ?id=... { status } -- تعليم كـ'RECEIVED' يمر عبر markPayoutReceived()
// (يسجّل قيد PAYOUT_RECEIVED بدفتر الأستاذ تلقائياً)؛ أي حالة ثانية تحديث مباشر.
export const PATCH = withErrorHandler(async (request: Request) => {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { status?: string; period_start?: string; period_end?: string };
  const supabase = getAdminClient();

  if (body.status === 'RECEIVED') {
    try {
      await markPayoutReceived(supabase, id);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
    }
  } else if (body.status) {
    const { error } = await supabase.from('affiliate_payouts').update({ status: body.status }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else if (body.period_start !== undefined || body.period_end !== undefined) {
    const { error } = await supabase
      .from('affiliate_payouts')
      .update({ period_start: body.period_start ?? null, period_end: body.period_end ?? null })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data } = await supabase.from('affiliate_payouts').select(COLUMNS).eq('id', id).single();
  return NextResponse.json({ data });
});
