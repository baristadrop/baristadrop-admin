'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { StatCard } from '@/components/ui/StatCard';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { FilterBar } from '@/components/ui/FilterBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

type PostbackStatus = 'received' | 'processed' | 'rejected' | 'duplicate' | 'error';

type PostbackRow = {
  id: string;
  provider_code: string | null;
  status: PostbackStatus;
  rejection_reason: string | null;
  received_at: string;
};

const STATUS_BADGE: Record<PostbackStatus, BadgeVariant> = {
  received: 'info',
  processed: 'success',
  rejected: 'danger',
  duplicate: 'neutral',
  error: 'danger',
};

export function WebhookVerificationPanel() {
  const [rows, setRows] = useState<PostbackRow[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | PostbackStatus>('all');

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('affiliate_postback_events')
        .select('id, provider_code, status, rejection_reason, received_at')
        .gte('received_at', since)
        .order('received_at', { ascending: false })
        .limit(200)
        .returns<PostbackRow[]>();
      setRows(data ?? []);
    })();
  }, []);

  if (!rows) return <Skeleton className="h-24" />;

  const received = rows.filter((r) => r.status === 'received' || r.status === 'processed').length;
  const rejected = rows.filter((r) => r.status === 'rejected').length;
  const errors = rows.filter((r) => r.status === 'error').length;
  const filtered = statusFilter === 'all' ? rows : rows.filter((r) => r.status === statusFilter);

  return (
    <div className="space-y-3 rounded-2xl border border-latte bg-white p-4">
      <p className="text-xs font-semibold tracking-wide text-stone">التحقق من Webhooks (آخر 24 ساعة)</p>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="مستلمة" value={received} />
        <StatCard label="مرفوضة" value={rejected} urgent />
        <StatCard label="أخطاء" value={errors} urgent />
      </div>
      <FilterBar
        options={[
          { value: 'all', label: 'الكل' },
          { value: 'received', label: 'مستلمة' },
          { value: 'processed', label: 'معالَجة' },
          { value: 'rejected', label: 'مرفوضة' },
          { value: 'duplicate', label: 'مكررة' },
          { value: 'error', label: 'خطأ' },
        ]}
        value={statusFilter}
        onChange={(v) => setStatusFilter(v as 'all' | PostbackStatus)}
      />
      {filtered.length === 0 ? (
        <EmptyState title="ما فيه أحداث webhook بهذي الحالة خلال آخر 24 ساعة" />
      ) : (
        <div className="max-h-80 space-y-1.5 overflow-y-auto">
          {filtered.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-latte px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                <span dir="ltr" className="text-coffee">
                  {r.provider_code ?? '—'}
                </span>
                <Badge variant={STATUS_BADGE[r.status]}>{r.status}</Badge>
                {r.rejection_reason && <span className="text-danger">({r.rejection_reason})</span>}
              </div>
              <span className="text-stone">{new Date(r.received_at).toLocaleString('ar')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
