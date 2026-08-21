import type { SupabaseClient } from '@supabase/supabase-js';

export type JobType =
  | 'ProcessAffiliateWebhook'
  | 'SyncProviderConversions'
  | 'SyncProviderConversionsFull'
  | 'ReconcileProvider'
  | 'ImportAffiliateReport'
  | 'MatchUnmatchedConversions'
  | 'RecalculateCommission'
  | 'ProcessPayout'
  | 'CleanupTrackingData';

// جدول الإعادة بالدقائق حسب نوع المهمة (7.1 بالخطة) -- مهام مالية حساسة
// (postback) تعيد المحاولة أسرع وأكثر من مهام تنظيف غير حرجة.
const RETRY_SCHEDULE_MINUTES: Record<JobType, number[]> = {
  ProcessAffiliateWebhook: [5, 30, 120],
  SyncProviderConversions: [10, 60, 360],
  SyncProviderConversionsFull: [30, 120, 720],
  ReconcileProvider: [60, 720],
  ImportAffiliateReport: [5, 30],
  MatchUnmatchedConversions: [30],
  RecalculateCommission: [],
  ProcessPayout: [10, 60],
  CleanupTrackingData: [],
};

function maxAttemptsFor(jobType: JobType): number {
  return Math.max(1, RETRY_SCHEDULE_MINUTES[jobType].length + 1);
}

export async function enqueueJob(
  supabase: SupabaseClient,
  jobType: JobType,
  payload: Record<string, unknown> = {},
  opts?: { runAt?: Date }
): Promise<string> {
  const { data, error } = await supabase
    .from('affiliate_jobs')
    .insert({
      job_type: jobType,
      payload,
      max_attempts: maxAttemptsFor(jobType),
      next_attempt_at: (opts?.runAt ?? new Date()).toISOString(),
    })
    .select('id')
    .single();

  if (error || !data) throw new Error(`failed to enqueue job ${jobType}: ${error?.message}`);
  return data.id as string;
}

export type QueuedJob = {
  id: string;
  job_type: JobType;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
};

// يجيب المهام المستحقة (pending أو failed اللي حان وقت إعادتها) ويعلّمها
// running. ما فيه SELECT ... FOR UPDATE SKIP LOCKED حقيقي هنا (Supabase JS
// ما يدعمه مباشرة) -- مقبول بنفس تحفّظ dailyReminders.js الموجود أصلاً
// بهذا المشروع: عامل واحد بس (تِك المتصفّح المجدول من xbloom-recipe-engine)
// يستدعي هذا، فاحتمال التعارض شبه معدوم.
export async function claimDueJobs(supabase: SupabaseClient, limit = 10): Promise<QueuedJob[]> {
  const { data, error } = await supabase
    .from('affiliate_jobs')
    .select('id, job_type, payload, attempts, max_attempts')
    .in('status', ['pending', 'failed'])
    .lte('next_attempt_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error || !data || data.length === 0) return [];

  const ids = data.map((j) => j.id as string);
  await supabase.from('affiliate_jobs').update({ status: 'running', started_at: new Date().toISOString() }).in('id', ids);

  return data as QueuedJob[];
}

export async function completeJob(supabase: SupabaseClient, jobId: string): Promise<void> {
  await supabase.from('affiliate_jobs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', jobId);
}

// يعيد جدولة الفشل حسب RETRY_SCHEDULE_MINUTES، أو يحوّلها 'dead' لو استنفدت
// كل المحاولات -- لا تُحذَف أبداً، تفضل بالجدول للمراجعة اليدوية.
export async function failJob(supabase: SupabaseClient, job: QueuedJob, errorMessage: string): Promise<void> {
  const nextAttempts = job.attempts + 1;
  const schedule = RETRY_SCHEDULE_MINUTES[job.job_type] ?? [];
  const delayMinutes = schedule[job.attempts];

  if (nextAttempts >= job.max_attempts || delayMinutes === undefined) {
    await supabase
      .from('affiliate_jobs')
      .update({ status: 'dead', attempts: nextAttempts, last_error: errorMessage, completed_at: new Date().toISOString() })
      .eq('id', job.id);
    return;
  }

  await supabase
    .from('affiliate_jobs')
    .update({
      status: 'failed',
      attempts: nextAttempts,
      last_error: errorMessage,
      next_attempt_at: new Date(Date.now() + delayMinutes * 60 * 1000).toISOString(),
    })
    .eq('id', job.id);
}
