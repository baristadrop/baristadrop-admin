import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { claimDueJobs, completeJob, enqueueJob, failJob, type JobType } from '@/lib/affiliate/jobs';
import { runJob } from '@/lib/affiliate/jobRunners';
import { withErrorHandler } from '@/lib/errorHandler';

const KNOWN_JOB_TYPES: JobType[] = [
  'ProcessAffiliateWebhook',
  'SyncProviderConversions',
  'SyncProviderConversionsFull',
  'ReconcileProvider',
  'ImportAffiliateReport',
  'MatchUnmatchedConversions',
  'RecalculateCommission',
  'ProcessPayout',
  'CleanupTrackingData',
];

// POST /api/admin/affiliate/jobs/run -- زر "تشغيل الآن" اليدوي من JobsTab.
// نفس منطق تشغيل المهام بالراوت المجدول (app/api/admin/affiliate/jobs/route.ts)
// لكن محمي بجلسة أدمن حقيقية (requireAdmin) بدل AFFILIATE_JOBS_SECRET --
// حدّان ثقة مختلفان تماماً (مستدعي cron خارجي غير-بشري VS أدمن بجلسة)،
// فما نعيد استخدام نفس الراوت -- نعيد استخدام دوال المكتبة فقط.
//
// body اختياري { job_type }: لو أُرسل، نجدول هذا النوع تحديداً ثم نشغّله --
// بدل ما ننتظر دورة الجدولة التلقائية أو نشغّل كل المستحق. مفيد بعد تصحيح
// بيانات اعتماد: تشغّل SyncProviderConversions فقط للتأكد إنها اشتغلت.
export const POST = withErrorHandler(async (request: Request) => {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { job_type?: string };
  const supabase = getAdminClient();

  if (body.job_type) {
    if (!KNOWN_JOB_TYPES.includes(body.job_type as JobType)) {
      return NextResponse.json({ error: `unknown job_type: ${body.job_type}` }, { status: 400 });
    }
    await enqueueJob(supabase, body.job_type as JobType);
  }

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
});
