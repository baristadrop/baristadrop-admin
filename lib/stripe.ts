import Stripe from 'stripe';

let client: Stripe | null = null;

// عميل Stripe واحد مشترك -- نفس نمط getAdminClient() لـ Supabase، بدل ما
// كل راوت ينشئ نسخة لحاله.
export function getStripeClient(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
    client = new Stripe(key);
  }
  return client;
}
