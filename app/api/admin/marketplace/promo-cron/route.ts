import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { withErrorHandler } from '@/lib/errorHandler';
import { sendExpoPush } from '@/lib/pushNotifications';

const MIN_GAP_HOURS = 48; // مرة كل يومين كحد أقصى

// عبارات تسويقية دورية تُختار عشوائياً -- تجنّب تكرار نفس النص كل مرة.
const MARKETING_MESSAGES = [
  'اكتشف أحدث إعلانات المعدات المستعملة بسوق باريستا دروب ☕',
  'مكينة، مطحنة، أو أي شي تحتاجه؟ شوف سوق المعدات المستعملة الحين',
  'صفقات معدات قهوة مستعملة تنتظرك -- تصفّح السوق الآن',
];

// مجدولة عبر netlify/functions/marketplace-promo-cron.ts (يومياً)، بس هذا
// الراوت نفسه يقرر "حان وقتها؟" برجوعه لآخر مرة أُرسل فيها -- نفس نمط
// AUTO_SCHEDULE بـaffiliate/jobs/route.ts. سرّ مشترك مبسّط (نفس
// AFFILIATE_JOBS_SECRET، ما يستاهل سرّ منفصل لمهمة صغيرة كذا).
export const POST = withErrorHandler(async (request: Request) => {
  const jobsSecret = process.env.AFFILIATE_JOBS_SECRET;
  if (!jobsSecret) return NextResponse.json({ error: 'AFFILIATE_JOBS_SECRET not configured' }, { status: 500 });

  const provided = request.headers.get('x-jobs-secret');
  if (provided !== jobsSecret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = getAdminClient();

  const cutoff = new Date(Date.now() - MIN_GAP_HOURS * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase.from('marketplace_promo_log').select('id').gte('sent_at', cutoff).limit(1).maybeSingle();
  if (recent) return NextResponse.json({ sent: false, reason: 'too_soon' });

  const { data: activeListings } = await supabase.from('marketplace_listings').select('id').eq('status', 'active').limit(1);
  if (!activeListings || activeListings.length === 0) return NextResponse.json({ sent: false, reason: 'no_active_listings' });

  const { data: recipients } = await supabase
    .from('profiles')
    .select('push_token')
    .eq('notifications_enabled', true)
    .eq('role', 'user')
    .not('push_token', 'is', null);

  const tokens = (recipients ?? []).map((r) => r.push_token).filter(Boolean) as string[];
  if (tokens.length === 0) return NextResponse.json({ sent: false, reason: 'no_recipients' });

  const message = MARKETING_MESSAGES[Math.floor(Math.random() * MARKETING_MESSAGES.length)];
  await sendExpoPush(tokens.map((to) => ({ to, title: 'سوق باريستا دروب', body: message })));

  await supabase.from('marketplace_promo_log').insert({});

  return NextResponse.json({ sent: true, recipientCount: tokens.length });
});
