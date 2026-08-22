import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { withErrorHandler } from '@/lib/errorHandler';

const TELR_ORDER_API = 'https://secure.telr.com/gateway/order.json';
const DEEP_LINK_BASE = 'baristadrop://marketplace-payment-return';

// GET /api/webhooks/telr?listingId=...&result=auth|decl|can -- Telr يرجّع
// المتصفح هنا بعد الدفع (تدفق "رجوع + تحقق حالة بالسيرفر"، مو ويبهوك موقّع
// زي RevenueCat). ما نثق بـresult من الرابط وحده أبداً -- نتحقق دايماً من
// حالة الطلب عند Telr نفسها بالسيرفر قبل أي تحديث.
export const GET = withErrorHandler(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const listingId = searchParams.get('listingId');
  const result = searchParams.get('result') ?? 'decl';

  if (!listingId) {
    return NextResponse.redirect(`${DEEP_LINK_BASE}?result=decl`);
  }

  const supabase = getAdminClient();
  const { data: listing } = await supabase
    .from('marketplace_listings')
    .select('id, status, listing_fee_aed, telr_order_ref')
    .eq('id', listingId)
    .maybeSingle();

  // idempotency: لو الإعلان مو موجود أو خلاص انتقل من pending_payment (نفس
  // الرجوع صار مرتين، أو الويبهوك سبق الرجوع) -- ما نعيد المعالجة.
  if (!listing || listing.status !== 'pending_payment' || !listing.telr_order_ref) {
    return NextResponse.redirect(`${DEEP_LINK_BASE}?listingId=${listingId}&result=${result}`);
  }

  if (result !== 'auth') {
    return NextResponse.redirect(`${DEEP_LINK_BASE}?listingId=${listingId}&result=${result}`);
  }

  const storeId = process.env.TELR_STORE_ID;
  const authKey = process.env.TELR_AUTH_KEY;
  if (!storeId || !authKey) {
    return NextResponse.redirect(`${DEEP_LINK_BASE}?listingId=${listingId}&result=decl`);
  }

  // تحقق حالة الطلب الفعلية عند Telr -- شكل الطلب مبني على التوثيق العام،
  // يحتاج تأكيد من لوحة Telr الحقيقية بعد فتح الحساب (نفس ملاحظة create-session).
  const statusResponse = await fetch(TELR_ORDER_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ivp_method: 'check',
      ivp_store: storeId,
      ivp_authkey: authKey,
      order_ref: listing.telr_order_ref,
    }),
  });

  const statusJson = (await statusResponse.json().catch(() => null)) as {
    order?: { status?: { code?: number; text?: string }; transaction?: { ref?: string; amount?: string } };
  } | null;

  const statusCode = statusJson?.order?.status?.code;
  const paidAmount = Number(statusJson?.order?.transaction?.amount ?? 0);
  const isPaid = statusCode === 3; // Telr: 3 = Paid (توثيق عام -- يحتاج تأكيد)
  const amountMatches = Math.abs(paidAmount - Number(listing.listing_fee_aed)) < 0.01;

  if (!isPaid || !amountMatches) {
    return NextResponse.redirect(`${DEEP_LINK_BASE}?listingId=${listingId}&result=decl`);
  }

  await supabase
    .from('marketplace_listings')
    .update({
      status: 'pending_review',
      paid_at: new Date().toISOString(),
      telr_transaction_ref: statusJson?.order?.transaction?.ref ?? null,
    })
    .eq('id', listingId);

  return NextResponse.redirect(`${DEEP_LINK_BASE}?listingId=${listingId}&result=auth`);
});
