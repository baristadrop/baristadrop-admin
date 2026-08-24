import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/adminAuth';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { getStripeClient } from '@/lib/stripe';
import { withErrorHandler } from '@/lib/errorHandler';

// يستبدل marketplace/telr/create-session بالكامل -- نفس ضمانات الأمان
// بالضبط (الرسم يُحسب دايماً بالسيرفر من سعر الإعلان الحقيقي بقاعدة
// البيانات، أبداً من العميل مباشرة؛ ownership + status check قبل أي دفع).
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

  const fee = Number(listing.price_aed) < 10000 ? 49.99 : 99;

  const stripe = getStripeClient();
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(fee * 100),
    currency: 'aed',
    automatic_payment_methods: { enabled: true },
    metadata: { purpose: 'marketplace_listing', listingId: listing.id },
  });

  await Promise.all([
    supabase.from('marketplace_listings').update({ listing_fee_aed: fee, stripe_payment_intent_id: paymentIntent.id }).eq('id', listing.id),
    supabase.from('stripe_payments').insert({
      purpose: 'marketplace_listing',
      owner_id: user.id,
      amount: fee,
      currency: 'aed',
      stripe_payment_intent_id: paymentIntent.id,
      status: 'pending',
      metadata: { listingId: listing.id },
    }),
  ]);

  return NextResponse.json({
    clientSecret: paymentIntent.client_secret,
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    amount: fee,
  });
});
