import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { claimDueJobs, completeJob, enqueueJob, failJob, type JobType } from '@/lib/affiliate/jobs';
import { runJob } from '@/lib/affiliate/jobRunners';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const jobsSecret = process.env.AFFILIATE_JOBS_SECRET as string | undefined;

function adminClient() {
  return createClient(supabaseUrl, serviceRoleKey);
}

// جدول "كل قد إيش" لكل مهمة مجدولة تلقائياً -- ما فيه إعداد cron على مستوى
// المنصة (Netlify/Vercel) بهذا المشروع، فبدل vercel.json crons (اللي مو
// متاح هنا)، الجدولة الحقيقية تجي من xbloom-recipe-engine/server's node-cron
// اللي يستدعي هذا الراوت كل 15 دقيقة (نفس نمط dailyReminders.js الموجود
// أصلاً بذاك السيرفر) -- وهذا الراوت نفسه يقرر "حان وقتها؟" بالرجوع لآخر
// مرة اتسوّت فيها كل نوع مهمة، بدل الاعتماد على جدولة خارجية دقيقة.
const AUTO_SCHEDULE: Array<{ jobType: JobType; minGapMinutes: number }> = [
  { jobType: 'SyncProviderConversions', minGapMinutes: 55 },
  { jobType: 'SyncProviderConversionsFull', minGapMinutes: 23 * 60 },
  { jobType: 'MatchUnmatchedConversions', minGapMinutes: 55 },
  { jobType: 'CleanupTrackingData', minGapMinutes: 6 * 24 * 60 },
];

async function enqueueDueScheduledJobs(supabase: ReturnType<typeof adminClient>) {
  for (const { jobType, minGapMinutes } of AUTO_SCHEDULE) {
    const cutoff = new Date(Date.now() - minGapMinutes * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from('affiliate_jobs')
      .select('id')
      .eq('job_type', jobType)
      .gte('created_at', cutoff)
      .limit(1)
      .maybeSingle();

    if (!recent) await enqueueJob(supabase, jobType);
  }
}

// POST /api/admin/affiliate/jobs
// يستدعيه مصدر "ساعة" خارجي (node-cron بسيرفر الوصفات، أو إدمن يدوي) --
// يجدول أي مهمة دورية متأخرة، يسحب حتى 10 مهام مستحقة، يشغّلها، ويحدّث
// حالتها (نجاح/فشل مع إعادة محاولة/فشل نهائي) — نفس أنبوب 7.2/7.3 بالخطة
// لكن مبني على البنية الفعلية للمشروع بدل Vercel Cron.
export async function POST(request: Request) {
  // رفض افتراضي -- لو AFFILIATE_JOBS_SECRET ما اتضبط بعد بمتغيرات بيئة
  // Netlify، الراوت ما يشتغل أبداً بدل ما يفضل مفتوح للعامة بدون أي تحقق.
  if (!jobsSecret) return NextResponse.json({ error: 'AFFILIATE_JOBS_SECRET not configured' }, { status: 500 });

  const provided = request.headers.get('x-jobs-secret');
  if (provided !== jobsSecret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = adminClient();
  await enqueueDueScheduledJobs(supabase);

  const jobs = await claimDueJobs(supabase, 10);
  const results: Array<{ id: string; jobType: string; ok: boolean; message: string }> = [];

  for (const job of jobs) {
    try {
      const message = await runJob(supabase, job);
      await completeJob(supabase, job.id);
      results.push({ id: job.id, jobType: job.job_type, ok: true, message });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await failJob(supabase, job, message);
      results.push({ id: job.id, jobType: job.job_type, ok: false, message });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
