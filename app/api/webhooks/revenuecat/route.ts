import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// RevenueCat event types that mean the subscriber currently has access.
const ACTIVE_EVENT_TYPES = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE', 'TRANSFER']);
const EXPIRED_EVENT_TYPES = new Set(['EXPIRATION']);
const CANCELLED_EVENT_TYPES = new Set(['CANCELLATION']);
const BILLING_ISSUE_EVENT_TYPES = new Set(['BILLING_ISSUE']);

// حزم الكريدت الاستهلاكية -- لازم تطابق CREDITS_PACK_3_ID/CREDITS_PACK_8_ID
// بمكتبة mobile/src/lib/revenueCat.ts بالضبط.
const CREDIT_PACK_AMOUNTS: Record<string, { credits: number; priceAed: number }> = {
  credits_3: { credits: 3, priceAed: 9.99 },
  credits_8: { credits: 8, priceAed: 19.99 },
};

function mapStatus(eventType: string, periodType: string | null): string {
  if (BILLING_ISSUE_EVENT_TYPES.has(eventType)) return 'billing_issue';
  if (EXPIRED_EVENT_TYPES.has(eventType)) return 'expired';
  if (CANCELLED_EVENT_TYPES.has(eventType)) return 'cancelled';
  if (ACTIVE_EVENT_TYPES.has(eventType)) return periodType === 'TRIAL' ? 'trial' : 'active';
  return 'active';
}

function mapPlan(productId: string): 'monthly' | 'yearly' {
  return /year|annual/i.test(productId) ? 'yearly' : 'monthly';
}

// Configured in RevenueCat's dashboard (Project Settings -> Integrations ->
// Webhooks -> Authorization header) so only real RevenueCat calls are
// accepted -- not session-based like the admin/*  routes, since this is a
// server-to-server call from RevenueCat, not a logged-in admin.
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const expected = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const event = body?.event;
  if (!event?.app_user_id || !event?.type) {
    return NextResponse.json({ error: 'malformed_event' }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // شراء كريدت (استهلاكي) -- مسار منفصل تماماً عن الاشتراك، ما يلمس
  // premium_subscriptions إطلاقاً (نفس مبدأ الفصل بين الأنظمة بالمشروع).
  if (event.type === 'NON_RENEWING_PURCHASE') {
    const pack = CREDIT_PACK_AMOUNTS[event.product_id ?? ''];
    if (!pack) {
      console.error('[revenuecat-webhook] unknown credit product_id:', event.product_id);
      return NextResponse.json({ error: 'unknown_product' }, { status: 400 });
    }

    // ignoreDuplicates + select() -- لو الحدث نفسه انبعث مرتين (RevenueCat يعيد
    // الإرسال أحياناً)، الصف الثاني ما يُدرج ويرجع data فاضية، فما نكرر
    // add_credits ونضاعف رصيد العميل غلط.
    const { data: inserted, error: insertError } = await supabase
      .from('credit_purchases')
      .upsert(
        {
          user_id: event.app_user_id,
          credits_amount: pack.credits,
          price_aed: pack.priceAed,
          platform: event.store === 'PLAY_STORE' ? 'android' : 'ios',
          product_id: event.product_id,
          revenuecat_transaction_id: event.id,
        },
        { onConflict: 'revenuecat_transaction_id', ignoreDuplicates: true }
      )
      .select('id');

    if (insertError) {
      console.error('[revenuecat-webhook] credit_purchases upsert failed:', insertError.message);
      return NextResponse.json({ error: 'db_write_failed' }, { status: 500 });
    }

    if (inserted && inserted.length > 0) {
      const { error: rpcError } = await supabase.rpc('add_credits', {
        p_user_id: event.app_user_id,
        p_amount: pack.credits,
      });
      if (rpcError) {
        console.error('[revenuecat-webhook] add_credits failed:', rpcError.message);
        return NextResponse.json({ error: 'db_write_failed' }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  }

  const status = mapStatus(event.type, event.period_type ?? null);
  const plan = mapPlan(event.product_id ?? '');
  const platform = event.store === 'PLAY_STORE' ? 'android' : 'ios';

  const { error } = await supabase.from('premium_subscriptions').upsert(
    {
      user_id: event.app_user_id,
      platform,
      product_id: event.product_id ?? null,
      status,
      plan,
      trial_ends_at: event.period_type === 'TRIAL' && event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null,
      current_period_ends_at: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null,
      revenuecat_customer_id: event.app_user_id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    console.error('[revenuecat-webhook] upsert failed:', error.message);
    return NextResponse.json({ error: 'db_write_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
