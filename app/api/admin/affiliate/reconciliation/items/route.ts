import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { withErrorHandler } from '@/lib/errorHandler';

const COLUMNS =
  'id, run_id, affiliate_program_id, recon_status, internal_conversion_id, internal_amount, provider_amount, internal_status, provider_status, discrepancy_notes, resolved_at, resolved_by';

// PATCH ?id=... { recon_status?, discrepancy_notes? } -- يحل عنصر تسوية
// واحد (يدويّاً): تحديث حالته و/أو إضافة ملاحظة، مع تسجيل مين ومتى حلّه.
// ملاحظة: هذا يحدّث سجل التسوية نفسه فقط -- ما يعدّل مبلغ التحويل الداخلي
// (affiliate_conversions) تلقائياً، لأن تصحيح مبلغ محاسبي حقيقي يحتاج مرور
// عبر دفتر الأستاذ ذو القيد المزدوج (affiliate_transition_conversion) مو
// UPDATE مباشر -- خارج نطاق هذا الراوت عمداً لتفادي خطأ محاسبي صامت.
export const PATCH = withErrorHandler(async (request: Request) => {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { recon_status?: string; discrepancy_notes?: string };
  const update: Record<string, unknown> = {};
  if (body.recon_status !== undefined) {
    update.recon_status = body.recon_status;
    update.resolved_at = new Date().toISOString();
    update.resolved_by = admin.id;
  }
  if (body.discrepancy_notes !== undefined) update.discrepancy_notes = body.discrepancy_notes;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }

  const supabase = getAdminClient();
  const { data, error } = await supabase.from('affiliate_reconciliation_items').update(update).eq('id', id).select(COLUMNS).single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
});
