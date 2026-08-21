import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { parsePagination, paginateQuery } from '@/lib/db/pagination';
import { getProgramBalance } from '@/lib/affiliate/commissionService';
import { withErrorHandler } from '@/lib/errorHandler';

const COLUMNS = 'id, affiliate_program_id, event_type, amount, currency, reference, accounting_date, created_at';

// GET /api/admin/affiliate/ledger?affiliate_program_id=...&event_type=...
// يرجّع صفحة من قيود دفتر الأستاذ + الرصيد المحسوب (عبر calculate_program_balance
// RPC -- migration 0079) بنفس الاستجابة.
export const GET = withErrorHandler(async (request: Request) => {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const programId = searchParams.get('affiliate_program_id');
  if (!programId) return NextResponse.json({ error: 'affiliate_program_id is required' }, { status: 400 });

  const supabase = getAdminClient();
  const pagination = parsePagination(searchParams);

  let query = supabase.from('affiliate_commission_ledger').select(COLUMNS, { count: 'exact' }).eq('affiliate_program_id', programId);
  const eventType = searchParams.get('event_type');
  if (eventType) query = query.eq('event_type', eventType);
  query = query.order('created_at', { ascending: false });

  const [entries, balance] = await Promise.all([paginateQuery(query, pagination), getProgramBalance(supabase, programId)]);
  return NextResponse.json({ ...entries, balance });
});
