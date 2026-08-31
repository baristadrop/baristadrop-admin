import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { parsePagination, paginateQuery } from '@/lib/db/pagination';
import { getProgramBalance, postLedgerEntry } from '@/lib/affiliate/commissionService';
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

// POST { affiliate_program_id, direction: 'credit'|'debit', amount, currency, reference? }
// قيد محاسبي يدوي (تسوية/مكافأة/خصم). event_type دائماً 'MANUAL_ADJUSTMENT'
// (قيد CHECK بالقاعدة -- migration 0074). direction يحدّد إشارة المبلغ:
// credit = موجب، debit = سالب (اصطلاح الدفتر: موجب=دائن، سالب=مدين).
// conversion_id يبقى NULL (القيد مو مربوط بتحويلة معيّنة). calculate_program_balance
// RPC (migration 0079) يضمّ MANUAL_ADJUSTMENT ضمن فئة "expected".
export const POST = withErrorHandler(async (request: Request) => {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    affiliate_program_id?: string;
    direction?: 'credit' | 'debit';
    amount?: number | string;
    currency?: string;
    reference?: string;
  };

  const amount = Number(body.amount);
  if (!body.affiliate_program_id || !body.currency) {
    return NextResponse.json({ error: 'affiliate_program_id and currency are required' }, { status: 400 });
  }
  if (body.direction !== 'credit' && body.direction !== 'debit') {
    return NextResponse.json({ error: "direction must be 'credit' or 'debit'" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  }

  const supabase = getAdminClient();
  const signedAmount = body.direction === 'debit' ? -Math.abs(amount) : Math.abs(amount);

  try {
    await postLedgerEntry(supabase, {
      affiliateProgramId: body.affiliate_program_id,
      conversionId: null,
      eventType: 'MANUAL_ADJUSTMENT',
      amount: signedAmount,
      currency: body.currency,
      reference: body.reference?.trim() || null,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
});
