import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { withErrorHandler } from '@/lib/errorHandler';

// شرائح العمولة السعرية لكل برنامج (شركة). تُخزَّن كصف واحد بـ
// affiliate_commission_rules، commission_model='tiered'، والشرائح في
// conditions.tiers كمصفوفة {min,max,rate} — نفس ما يقرأه applyRule()
// بـ commissionService (tiered: يختار الشريحة اللي saleAmount ضمن مداها).
// max=null بآخر شريحة يعني "وما فوق". كل الصفوف تُقرأ وتُحفظ، ما فيه حد.

type TierInput = { min: number | string; max: number | string | null; rate: number | string };
type Tier = { min: number; max: number | null; rate: number };

const RULE_NAME = 'الشرائح السعرية';

function normalizeTiers(raw: unknown): { tiers: Tier[]; error: string | null } {
  if (!Array.isArray(raw)) return { tiers: [], error: 'tiers must be an array' };

  const tiers: Tier[] = [];
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i] as TierInput;
    const min = Number(t.min);
    const rate = Number(t.rate);
    const maxRaw = t.max === '' || t.max === null || t.max === undefined ? null : Number(t.max);

    // صف فارغ تماماً -> نتجاهله بهدوء (المستخدم قد يخلي صفوف فاضية)
    const allEmpty =
      (t.min === '' || t.min === null || t.min === undefined) &&
      (t.max === '' || t.max === null || t.max === undefined) &&
      (t.rate === '' || t.rate === null || t.rate === undefined);
    if (allEmpty) continue;

    if (!Number.isFinite(min) || min < 0) return { tiers: [], error: `الشريحة ${i + 1}: قيمة "من" غير صحيحة` };
    if (maxRaw !== null && (!Number.isFinite(maxRaw) || maxRaw < min)) {
      return { tiers: [], error: `الشريحة ${i + 1}: "إلى" لازم يكون أكبر من "من" (أو فارغ للأخيرة)` };
    }
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      return { tiers: [], error: `الشريحة ${i + 1}: النسبة لازم بين 0 و100` };
    }
    tiers.push({ min, max: maxRaw, rate });
  }

  tiers.sort((a, b) => a.min - b.min);
  return { tiers, error: null };
}

// GET ?affiliate_program_id=... -> { tiers: Tier[] }
export const GET = withErrorHandler(async (request: Request) => {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const programId = searchParams.get('affiliate_program_id');
  if (!programId) return NextResponse.json({ error: 'affiliate_program_id is required' }, { status: 400 });

  const supabase = getAdminClient();
  const { data } = await supabase
    .from('affiliate_commission_rules')
    .select('id, conditions')
    .eq('affiliate_program_id', programId)
    .eq('commission_model', 'tiered')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const tiers = (data?.conditions as { tiers?: Tier[] } | null)?.tiers ?? [];
  return NextResponse.json({ tiers, ruleId: data?.id ?? null });
});

// PUT ?affiliate_program_id=... { tiers: TierInput[] }
// يستبدل كل شرائح البرنامج بصف tiered واحد. حفظ مصفوفة فارغة = حذف الشرائح.
export const PUT = withErrorHandler(async (request: Request) => {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const programId = searchParams.get('affiliate_program_id');
  if (!programId) return NextResponse.json({ error: 'affiliate_program_id is required' }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { tiers?: unknown };
  const { tiers, error } = normalizeTiers(body.tiers);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const supabase = getAdminClient();

  // نبقي صف tiered واحد فقط للبرنامج — نحذف أي صفوف tiered قديمة أولاً.
  await supabase
    .from('affiliate_commission_rules')
    .delete()
    .eq('affiliate_program_id', programId)
    .eq('commission_model', 'tiered');

  if (tiers.length === 0) {
    return NextResponse.json({ ok: true, tiers: [] });
  }

  const { error: insertError } = await supabase.from('affiliate_commission_rules').insert({
    affiliate_program_id: programId,
    name: RULE_NAME,
    commission_model: 'tiered',
    rate: tiers[0].rate, // fallback لو ما طابقت أي شريحة (نادر)
    conditions: { tiers },
    priority: 100,
    product_category: null, // تنطبق على كل منتجات الشركة
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

  // نحدّث حقل البرنامج للعرض فقط (المنطق الفعلي يقرأ من القاعدة)
  await supabase.from('affiliate_programs').update({ commission_model: 'tiered' }).eq('id', programId);

  return NextResponse.json({ ok: true, tiers });
});
