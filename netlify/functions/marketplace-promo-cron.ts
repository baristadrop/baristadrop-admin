import type { Config, Context } from '@netlify/functions';

// يشغّل يومياً -- الراوت نفسه (/api/admin/marketplace/promo-cron) يفرض
// حد أقصى مرة كل 48 ساعة فعلياً بغض النظر عن تكرار هالنبضة (نفس أسلوب
// affiliate-jobs-cron.ts's self-throttling).
export default async (request: Request, context: Context) => {
  const siteUrl = process.env.URL || 'https://admin.baristadrop.com';
  const jobsSecret = process.env.AFFILIATE_JOBS_SECRET;

  if (!jobsSecret) {
    console.error('[marketplace-promo-cron] AFFILIATE_JOBS_SECRET not configured');
    return new Response(JSON.stringify({ error: 'not configured' }), { status: 500 });
  }

  try {
    const response = await fetch(`${siteUrl}/api/admin/marketplace/promo-cron`, {
      method: 'POST',
      headers: { 'x-jobs-secret': jobsSecret },
    });
    const result = await response.json();
    console.log(`[marketplace-promo-cron] status=${response.status}`, result);
    return new Response(JSON.stringify(result), { status: response.status, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[marketplace-promo-cron] failed to trigger:', err);
    return new Response(JSON.stringify({ error: 'cron trigger failed' }), { status: 500 });
  }
};

export const config: Config = {
  schedule: '0 10 * * *',
};
