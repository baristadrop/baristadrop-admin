import type { Config, Context } from '@netlify/functions';

// نبضة احتياطية لطابور مهام الأفيليت -- المشغّل الأساسي هو node-cron بسيرفر
// الوصفات (xbloom-recipe-engine)، وهذا مستقل تماماً عنه: لو ذاك السيرفر
// وقف لأي سبب، هذي تفضل تشغّل الطابور كل 15 دقيقة بدون أي اعتماد بينهم.
// راوت /api/admin/affiliate/jobs نفسه يحدد داخلياً أي مهمة "حان وقتها"
// (minGapMinutes) فتشغيل النبضتين بنفس الوقت آمن تماماً -- ما يصير تكرار.
export default async (request: Request, context: Context) => {
  const siteUrl = process.env.URL || 'https://admin.baristadrop.com';
  const jobsSecret = process.env.AFFILIATE_JOBS_SECRET;

  if (!jobsSecret) {
    console.error('[affiliate-jobs-cron] AFFILIATE_JOBS_SECRET not configured');
    return new Response(JSON.stringify({ error: 'not configured' }), { status: 500 });
  }

  try {
    const response = await fetch(`${siteUrl}/api/admin/affiliate/jobs`, {
      method: 'POST',
      headers: { 'x-jobs-secret': jobsSecret },
    });
    const result = await response.json();
    console.log(`[affiliate-jobs-cron] status=${response.status}`, result);
    return new Response(JSON.stringify(result), { status: response.status, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[affiliate-jobs-cron] failed to trigger jobs:', err);
    return new Response(JSON.stringify({ error: 'cron trigger failed' }), { status: 500 });
  }
};

export const config: Config = {
  schedule: '*/15 * * * *',
};
