import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/adminAuth';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { withErrorHandler } from '@/lib/errorHandler';

const TELR_ORDER_API = 'https://secure.telr.com/gateway/order.json';

// أول ربط للتطبيق بباك-إند admin -- مو لأدمن بس، لأي بائع مسجّل دخول يبي
// يدفع رسم إعلانه. الرسم يُحسب هنا دايماً بالسيرفر، أبداً من العميل مباشرة.
export const POST = withErrorHandler(async (request: Request) => {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { listingId?: string };
  if (!body.listingId) return NextResponse.json({ error: 'listingId is required' }, { status: 400 });

  const supabase = getAdminClient();
  const { data: listing, error } = await supabase
    .from('marketplace_listings')
    .select('id, owner_id, status, price_aed')
    .eq('id', body.listingId)
    .single();

  if (error || !listing) return NextResponse.json({ error: 'listing_not_found' }, { status: 404 });
  if (listing.owner_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (listing.status !== 'pending_payment') return NextResponse.json({ error: 'listing_not_pending_payment' }, { status: 409 });

  // يُحسب دايماً بالسيرفر من سعر الإعلان الحقيقي بقاعدة البيانات -- لا يُقبل
  // أي مبلغ من طلب العميل مباشرة.
  const fee = Number(listing.price_aed) < 10000 ? 49.99 : 99;
  const orderRef = `MKT-${listing.id}-${Date.now()}`;

  const storeId = process.env.TELR_STORE_ID;
  const authKey = process.env.TELR_AUTH_KEY;
  if (!storeId || !authKey) {
    return NextResponse.json({ error: 'telr_not_configured' }, { status: 500 });
  }

  const siteUrl = process.env.URL || 'https://admin.baristadrop.com';
  const returnBase = `${siteUrl}/api/webhooks/telr?listingId=${listing.id}`;

  // شكل order.json مبني على توثيق Telr العام -- غير مؤكد على حساب حقيقي بعد
  // (لا يوجد حساب تاجر مفتوح لحظة كتابة هذا الكود). يحتاج تأكيد أسماء
  // الحقول الدقيقة من لوحة Telr الفعلية بعد فتح الحساب.
  const telrResponse = await fetch(TELR_ORDER_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ivp_method: 'create',
      ivp_store: storeId,
      ivp_authkey: authKey,
      ivp_amount: fee.toFixed(2),
      ivp_currency: 'AED',
      ivp_cart: orderRef,
      ivp_desc: 'رسم نشر إعلان -- سوق المعدات المستعملة',
      ivp_test: process.env.TELR_TEST_MODE === '1' ? 1 : 0,
      return_auth: `${returnBase}&result=auth`,
      return_decl: `${returnBase}&result=decl`,
      return_can: `${returnBase}&result=can`,
    }),
  });

  const telrJson = (await telrResponse.json().catch(() => null)) as { order?: { ref?: string; url?: string }; error?: unknown } | null;
  if (!telrResponse.ok || !telrJson?.order?.url) {
    return NextResponse.json({ error: 'telr_session_failed' }, { status: 502 });
  }

  await supabase
    .from('marketplace_listings')
    .update({ listing_fee_aed: fee, telr_order_ref: orderRef })
    .eq('id', listing.id);

  return NextResponse.json({ paymentUrl: telrJson.order.url, telrOrderRef: orderRef });
});
