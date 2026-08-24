'use client';

import { StatCardSkeletonGrid } from '@/components/ui/Skeleton';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { adminFetchJson } from '@/lib/adminApiClient';
import { StatCard } from '@/components/ui/StatCard';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FilterBar } from '@/components/ui/FilterBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';

type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'dead';

type JobRow = {
  id: string;
  job_type: string;
  status: JobStatus;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  created_at: string;
  completed_at: string | null;
};

const STATUS_BADGE: Record<JobStatus, BadgeVariant> = {
  pending: 'warning',
  running: 'info',
  completed: 'success',
  failed: 'danger',
  dead: 'neutral',
};

const CRON_SCHEDULE = [
  { name: 'SyncProviderConversions', freq: 'كل ~55 دقيقة', desc: 'يسحب تحويلات جديدة من مزوّدات فيها API حي' },
  { name: 'SyncProviderConversionsFull', freq: 'كل ~23 ساعة', desc: 'مزامنة كاملة يومية (يلتقط أي تحويلة فاتت المزامنة الجزئية)' },
  { name: 'MatchUnmatchedConversions', freq: 'كل ~55 دقيقة', desc: 'يحاول يربط تحويلات UNMATCHED بكليكات وصلت متأخرة' },
  { name: 'CleanupTrackingData', freq: 'كل ~6 أيام', desc: 'تنظيف بيانات تتبّع منتهية الصلاحية' },
];

export function JobsTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<JobRow[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | JobStatus>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from('affiliate_jobs')
      .select('id, job_type, status, payload, attempts, max_attempts, last_error, created_at, completed_at')
      .order('created_at', { ascending: false })
      .limit(200)
      .returns<JobRow[]>();
    setRows(data ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const retry = async (id: string) => {
    setBusyId(id);
    await supabase
      .from('affiliate_jobs')
      .update({ status: 'pending', attempts: 0, next_attempt_at: new Date().toISOString(), last_error: null })
      .eq('id', id);
    setBusyId(null);
    toast({ title: 'أُعيدت جدولة المهمة', variant: 'success' });
    load();
  };

  const runNow = async () => {
    setRunningAll(true);
    const res = await adminFetchJson('/api/admin/affiliate/jobs/run', { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    setRunningAll(false);
    if (res.ok) {
      toast({ title: `تم تشغيل ${body.processed} مهمة`, variant: 'success' });
      load();
    } else {
      toast({ title: 'فشل التشغيل', description: body.error, variant: 'destructive' });
    }
  };

  if (!rows) return <StatCardSkeletonGrid />;

  const filtered = statusFilter === 'all' ? rows : rows.filter((r) => r.status === statusFilter);
  const pendingCount = rows.filter((r) => r.status === 'pending').length;
  const failedCount = rows.filter((r) => r.status === 'failed' || r.status === 'dead').length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="إجمالي المهام (آخر 200)" value={rows.length} />
        <StatCard label="بانتظار التنفيذ" value={pendingCount} urgent />
        <StatCard label="فاشلة" value={failedCount} urgent />
        <div className="flex items-center">
          <Button onClick={runNow} disabled={runningAll} className="w-full">
            {runningAll ? 'جاري التشغيل...' : 'تشغيل الآن'}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-latte bg-white p-4">
        <p className="mb-3 text-xs font-semibold tracking-wide text-stone">جدول المهام الدورية</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {CRON_SCHEDULE.map((c) => {
            const lastRun = rows.find((r) => r.job_type === c.name && r.status === 'completed');
            return (
              <div key={c.name} className="rounded-xl border border-latte px-3 py-2 text-xs">
                <p dir="ltr" className="text-left font-semibold text-coffee">
                  {c.name}
                </p>
                <p className="text-mocha">{c.freq} — {c.desc}</p>
                <p className="mt-1 text-[11px] text-stone">
                  {lastRun ? `آخر تشغيل ناجح: ${new Date(lastRun.completed_at ?? lastRun.created_at).toLocaleString('ar')}` : 'ما تشغّلت بعد'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <FilterBar
        options={[
          { value: 'all', label: 'الكل' },
          { value: 'pending', label: 'بانتظار' },
          { value: 'running', label: 'جارية' },
          { value: 'completed', label: 'مكتملة' },
          { value: 'failed', label: 'فاشلة' },
          { value: 'dead', label: 'ميتة' },
        ]}
        value={statusFilter}
        onChange={(v) => setStatusFilter(v as 'all' | JobStatus)}
      />

      {filtered.length === 0 ? (
        <EmptyState title="ما فيه مهام بهذي الحالة" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-latte bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-right text-sm">
            <thead className="bg-sand/60 text-[11px] uppercase tracking-wide text-mocha">
              <tr>
                <th className="px-3 py-2">النوع</th>
                <th className="px-3 py-2">الحالة</th>
                <th className="px-3 py-2">المحاولات</th>
                <th className="px-3 py-2">آخر خطأ</th>
                <th className="px-3 py-2">تاريخ الإنشاء</th>
                <th className="px-3 py-2">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((j) => (
                <tr key={j.id} className="border-t border-latte">
                  <td dir="ltr" className="px-3 py-2 text-left text-xs text-ink">
                    {j.job_type}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={STATUS_BADGE[j.status]}>{j.status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-mocha">
                    {j.attempts} / {j.max_attempts}
                  </td>
                  <td className="max-w-xs truncate px-3 py-2 text-[11px] text-danger" title={j.last_error ?? ''}>
                    {j.last_error ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-stone">{new Date(j.created_at).toLocaleString('ar')}</td>
                  <td className="px-3 py-2">
                    {(j.status === 'failed' || j.status === 'dead') && (
                      <Button size="sm" variant="outline" disabled={busyId === j.id} onClick={() => retry(j.id)}>
                        إعادة محاولة
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
