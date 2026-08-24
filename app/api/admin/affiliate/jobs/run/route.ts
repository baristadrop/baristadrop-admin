import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { claimDueJobs, completeJob, failJob } from '@/lib/affiliate/jobs';
import { runJob } from '@/lib/affiliate/jobRunners';
import { withErrorHandler } from '@/lib/errorHandler';

// POST /api/admin/affiliate/jobs/run -- زر "تشغيل الآن" اليدوي من JobsTab.
// نفس منطق تشغيل المهام بالراوت المجدول (app/api/admin/affiliate/jobs/route.ts)
// لكن محمي بجلسة أدمن حقيقية (requireAdmin) بدل AFFILIATE_JOBS_SECRET --
// حدّان ثقة مختلفان تماماً (مستدعي cron خارجي غير-بشري VS أدمن بجلسة)،
// فما نعيد استخدام نفس الراوت -- نعيد استخدام دوال المكتبة فقط.
export const POST = withErrorHandler(async (request: Request) => {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = getAdminClient();
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
