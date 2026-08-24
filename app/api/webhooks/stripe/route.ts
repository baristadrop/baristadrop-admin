import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { getStripeClient } from '@/lib/stripe';
import type Stripe from 'stripe';

// Stripe webhooks (على عكس Telr) موقّعة فعلاً -- نتحقق من التوقيع، مو
// نعيد فحص الحالة بطلب ثاني. لازم نقرأ الـbody الخام (مو request.json())
// عشان stripe.webhooks.constructEvent يتحقق من التوقيع بشكل صحيح.
export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[webhooks/stripe] STRIPE_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'not configured' }, { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'missing signature' }, { status: 400 });

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('[webhooks/stripe] signature verification failed', err);
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  const supabase = getAdminClient();

  if (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object as Stripe.PaymentIntent;
    const succeeded = event.type === 'payment_intent.succeeded';

    const { data: payment } = await supabase
      .from('stripe_payments')
      .select('id, status, purpose, metadata')
      .eq('stripe_payment_intent_id', intent.id)
      .maybeSingle();

    // idempotency: Stripe قد يعيد إرسال نفس الحدث -- ما نعيد المعالجة لو
    // خلاص وصلنا لحالة نهائية.
    if (!payment || payment.status !== 'pending') {
      return NextResponse.json({ received: true, skipped: true });
    }

    await supabase
      .from('stripe_payments')
      .update({ status: succeeded ? 'succeeded' : 'failed', updated_at: new Date().toISOString() })
      .eq('id', payment.id);

    if (succeeded && payment.purpose === 'marketplace_listing') {
      const listingId = (payment.metadata as { listingId?: string })?.listingId;
      if (listingId) {
        await supabase
          .from('marketplace_listings')
          .update({ status: 'pending_review', paid_at: new Date().toISOString() })
          .eq('id', listingId)
          .eq('status', 'pending_payment'); // idempotency: ما يعيد لو خلاص انتقلت
      }
    }
  }

  return NextResponse.json({ received: true });
}
