import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isValidUuid, isValidOrderAmount, calculateCommission } from '@/lib/affiliateCommission';
import { processConversionEvent } from '@/lib/affiliate/conversionEngine';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
// Phase 9 (AFFILIATE_PLATFORM_IMPLEMENTATION_PLAN.md 9.3) -- مطفّي افتراضياً.
// لما يتفعّل، كل عملية شراء تتسجّل بالنظام القديم (كما هو) + الجديد
// (affiliate_conversions عبر Phase 3's engine) بنفس الوقت، بدون ما يتوقف
// أو يتأثر مسار النظام القديم لو الكتابة الجديدة فشلت.
const DUAL_WRITE_ENABLED = process.env.AFFILIATE_DUAL_WRITE === 'true';

// GIF شفاف 1x1 -- يُرجَّع دايماً للطلبات اللي تجي عن طريق pixel بصفحة "تم
// الطلب" عند الشريك، حتى لو التحقق فشل (الخطأ يُسجَّل بالسيرفر بس، ما لازم
// يظهر بصفحة عامة للعميل النهائي).
const TRANSPARENT_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7', 'base64');

type Business = { roasterId: string | null; supplierId: string | null; commissionPercent: number | null };

/** كل شركة عندها رمز فريد (postback_secret) صار هوية + مصادقة بنفس الوقت --
 * لو الرمز طابق صف، نعرف مين الشركة بدون ما تحتاج ترسل roaster_id/
 * supplier_id بنفسها (تقليل فرصة أي شركة ترسل تأكيد شراء باسم شركة ثانية). */
async function resolveBusiness(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  token: string | null
): Promise<Business | null> {
  if (!isValidUuid(token)) return null;
  const [{ data: roaster }, { data: supplier }] = await Promise.all([
    supabase.from('roasters').select('id, commission_percent').eq('postback_secret', token).maybeSingle(),
    supabase.from('suppliers').select('id, commission_percent').eq('postback_secret', token).maybeSingle(),
  ]);
  if (roaster) return { roasterId: roaster.id as string, supplierId: null, commissionPercent: roaster.commission_percent as number | null };
  if (supplier) return { roasterId: null, supplierId: supplier.id as string, commissionPercent: supplier.commission_percent as number | null };
  return null;
}

async function recordPurchase(params: {
  token: string | null;
  clickId: string | null;
  orderAmount: number;
  orderReference: string | null;
  currency: string;
  rawPayload: unknown;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!isValidUuid(params.clickId)) {
    return { ok: false, status: 400, error: 'missing_or_invalid_click_id' };
  }
  if (!isValidOrderAmount(params.orderAmount)) {
    return { ok: false, status: 400, error: 'invalid_order_amount' };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const business = await resolveBusiness(supabase, params.token);
  if (!business) return { ok: false, status: 401, error: 'unauthorized' };

  // سقف 30 طلب/دقيقة لكل شركة -- يحمي حتى لو تسرب رمز شركة وحد قصف الرابط.
  const { data: withinLimit, error: rateLimitError } = await supabase.rpc('check_webhook_rate_limit', {
    p_token: params.token,
  });
  if (rateLimitError) {
    console.error('[affiliate-purchase-webhook] rate limit check failed:', rateLimitError.message);
  } else if (withinLimit === false) {
    return { ok: false, status: 429, error: 'too_many_requests' };
  }

  const commissionPercent = business.commissionPercent ?? 0;
  const commissionAmount = calculateCommission(params.orderAmount, commissionPercent);

  const { error } = await supabase.from('affiliate_purchases').upsert(
    {
      click_id: params.clickId,
      roaster_id: business.roasterId,
      supplier_id: business.supplierId,
      order_reference: params.orderReference,
      order_amount: params.orderAmount,
      currency: params.currency,
      commission_percent: commissionPercent,
      commission_amount: commissionAmount,
      raw_payload: params.rawPayload,
      confirmed_at: new Date().toISOString(),
    },
    { onConflict: 'click_id' }
  );

  if (error) {
    console.error('[affiliate-purchase-webhook] upsert failed:', error.message);
    return { ok: false, status: 500, error: 'db_write_failed' };
  }

  if (DUAL_WRITE_ENABLED) {
    await dualWriteConversion(supabase, business, params, commissionAmount);
  }

  return { ok: true };
}

// كتابة إضافية (لا تُفشل الطلب أبداً) لبرنامج الأفيليت الجديد -- تبحث عن
// affiliate_program المربوط بنفس الشركة عبر legacy_roaster_id/
// legacy_supplier_id (اللي عبّاه Phase 9's backfill migration). لو ما لقت
// برنامج (شركة جديدة اتسجّلت بعد آخر تشغيل للـ backfill)، تتجاهل بصمت --
// النظام القديم يفضل يشتغل بشكل طبيعي بغض النظر.
async function dualWriteConversion(
  supabase: SupabaseClient,
  business: Business,
  params: { clickId: string | null; orderReference: string | null; orderAmount: number; currency: string; rawPayload: unknown },
  commissionAmount: number
): Promise<void> {
  try {
    const { data: program } = await supabase
      .from('affiliate_programs')
      .select('id')
      .or(
        business.roasterId
          ? `legacy_roaster_id.eq.${business.roasterId}`
          : `legacy_supplier_id.eq.${business.supplierId}`
      )
      .maybeSingle();

    if (!program) return;

    await processConversionEvent(supabase, program.id as string, {
      providerConversionId: params.orderReference ?? `click-${params.clickId}`,
      orderId: params.orderReference,
      saleAmount: params.orderAmount,
      commissionAmount,
      currency: params.currency,
      conversionTime: new Date().toISOString(),
      clickId: null, // كليك النظام القديم (affiliate_clicks) ما يطابق affiliate_click_events -- يُترك بلا مطابقة (UNMATCHED) بدل مطابقة وهمية
      rawEventId: params.orderReference,
    });
  } catch (err) {
    console.error('[affiliate-purchase-webhook] dual-write to v2 failed (legacy write already succeeded, not blocking):', err);
  }
}

// المسار المفضّل -- للشركات اللي تقدر ترسل تأكيد من الباك-إند تبعها مباشرة
// (Shopify order webhook أو نظام مخصص). يرجّع أخطاء JSON حقيقية عشان نظامهم
// يقدر يسجّل/يعيد المحاولة عند الفشل.
export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const result = await recordPurchase({
    token: (body.token as string | undefined) ?? url.searchParams.get('token'),
    clickId: (body.click_id as string | undefined) ?? url.searchParams.get('click_id'),
    orderAmount: Number(body.order_amount ?? url.searchParams.get('order_amount')),
    orderReference: (body.order_reference as string | undefined) ?? url.searchParams.get('order_reference') ?? null,
    currency: (body.currency as string | undefined) ?? 'AED',
    rawPayload: body,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}

// المسار البديل (Pixel) -- لصفحة "تم الطلب" عند الشركات اللي بس تقدر تضيف
// <img> بدون أي كود باك-إند. دايماً 200 + GIF شفاف بغض النظر عن نتيجة
// التحقق، عشان ما يظهر أي خطأ بصفحة عامة يشوفها العميل النهائي.
export async function GET(request: Request) {
  const url = new URL(request.url);

  await recordPurchase({
    token: url.searchParams.get('token'),
    clickId: url.searchParams.get('click_id'),
    orderAmount: Number(url.searchParams.get('order_amount')),
    orderReference: url.searchParams.get('order_reference'),
    currency: url.searchParams.get('currency') ?? 'AED',
    rawPayload: Object.fromEntries(url.searchParams),
  });

  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' },
  });
}
