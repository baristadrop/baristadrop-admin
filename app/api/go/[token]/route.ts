import { createClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'crypto';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
// Falls back to the service-role key so hashing works out of the box; set a
// dedicated AFFILIATE_IP_HASH_SALT in Netlify env vars to rotate it independently.
const IP_HASH_SALT = process.env.AFFILIATE_IP_HASH_SALT || serviceRoleKey;

const CLICK_WINDOW_DAYS = 30;

function hashValue(value: string): string {
  return createHash('sha256').update(`${value}${IP_HASH_SALT}`).digest('hex');
}

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return request.headers.get('x-real-ip');
}

function deviceType(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return 'tablet';
  if (/mobile|iphone|android/.test(ua)) return 'mobile';
  return 'desktop';
}

// GET /api/go/[token]
// 1. يبحث عن affiliate_link بالتوكن
// 2. يولّد click_id داخلي (CLK-...)
// 3. يسجّل الكليك في affiliate_click_events مع بيانات الإحالة
// 4. يحوّل (302) لرابط الوجهة -- محول المزوّد (Phase 6) لسه ما بُني، فحالياً
//    التحويل يروح مباشرة لـ destination_url (نفس قاعدة "لو فشل المحول، حوّل
//    لل destination_url الخام، لا توقف الكليك أبداً" الموجودة بالخطة)
export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: link } = await supabase
    .from('affiliate_links')
    .select('id, affiliate_program_id, product_id, destination_url, status')
    .eq('token', token)
    .maybeSingle();

  if (!link || link.status !== 'active') {
    return NextResponse.redirect(new URL('/', request.url), { status: 302 });
  }

  const clickId = `CLK-${randomUUID()}`;
  const url = new URL(request.url);
  const userAgent = request.headers.get('user-agent');
  const ip = clientIp(request);
  const clickedAt = new Date();
  const expiresAt = new Date(clickedAt.getTime() + CLICK_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const { error } = await supabase.from('affiliate_click_events').insert({
    click_id: clickId,
    affiliate_program_id: link.affiliate_program_id,
    affiliate_link_id: link.id,
    product_id: link.product_id,
    session_id: url.searchParams.get('session_id'),
    visitor_id: url.searchParams.get('visitor_id'),
    utm_source: url.searchParams.get('utm_source'),
    utm_medium: url.searchParams.get('utm_medium'),
    utm_campaign: url.searchParams.get('utm_campaign'),
    utm_term: url.searchParams.get('utm_term'),
    utm_content: url.searchParams.get('utm_content'),
    referrer: request.headers.get('referer'),
    landing_page: url.searchParams.get('landing_page'),
    ip_hash: ip ? hashValue(ip) : null,
    user_agent_hash: userAgent ? hashValue(userAgent) : null,
    device_type: deviceType(userAgent),
    clicked_at: clickedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    console.error('[affiliate-go] failed to record click event:', error.message);
  }

  // Phase 6 هيضيف هنا: resolveProviderAdapter(link).generateTrackingUrl(...)
  const destination = link.destination_url;

  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: destination,
      'Cache-Control': 'no-store, no-cache',
      'X-Click-Id': clickId,
    },
  });
}
