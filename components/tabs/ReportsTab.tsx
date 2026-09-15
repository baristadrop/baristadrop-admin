'use client';

import { StatCardSkeletonGrid } from '@/components/ui/Skeleton';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

type ReportRow = {
  id: string;
  target_type: 'recipe' | 'review' | 'marketplace_listing' | 'user';
  target_id: string;
  reason: string;
  details: string | null;
  status: 'open' | 'reviewed' | 'dismissed';
  created_at: string;
  reporter_id: string;
};

const TARGET_TYPE_LABEL: Record<ReportRow['target_type'], string> = {
  recipe: 'وصفة',
  review: 'تعليق/تقييم',
  marketplace_listing: 'إعلان ماركت',
  user: 'مستخدم',
};

const REASON_LABEL: Record<string, string> = {
  spam: 'سبام',
  inappropriate: 'محتوى غير لائق',
  scam: 'احتيال',
  other: 'سبب آخر',
};

const STATUS_LABEL: Record<ReportRow['status'], string> = {
  open: 'مفتوح',
  reviewed: 'تمت المراجعة',
  dismissed: 'متجاهَل',
};

const STATUS_BADGE: Record<ReportRow['status'], BadgeVariant> = {
  open: 'warning',
  reviewed: 'success',
  dismissed: 'neutral',
};

export function ReportsTab() {
  const [rows, setRows] = useState<ReportRow[] | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from('content_reports')
      .select('id, target_type, target_id, reason, details, status, created_at, reporter_id')
      .order('created_at', { ascending: false })
      .returns<ReportRow[]>();
    setRows(data ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const setStatus = async (id: string, status: ReportRow['status']) => {
    await supabase.from('content_reports').update({ status }).eq('id', id);
    load();
  };

  if (!rows) return <StatCardSkeletonGrid />;

  const columns: DataTableColumn<ReportRow>[] = [
    { key: 'type', header: 'النوع', render: (r) => TARGET_TYPE_LABEL[r.target_type] },
    { key: 'reason', header: 'السبب', render: (r) => REASON_LABEL[r.reason] ?? r.reason },
    { key: 'target', header: 'معرّف المحتوى', render: (r) => <span dir="ltr" className="text-xs opacity-70">{r.target_id}</span> },
    {
      key: 'created',
      header: 'التاريخ',
      render: (r) => new Date(r.created_at).toLocaleString('ar'),
      sortValue: (r) => r.created_at,
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (r) => <Badge variant={STATUS_BADGE[r.status]}>{STATUS_LABEL[r.status]}</Badge>,
      sortValue: (r) => r.status,
    },
    {
      key: 'action',
      header: 'إجراء',
      render: (r) =>
        r.status === 'open' && (
          <div className="flex gap-2">
            <Button size="sm" variant="link" onClick={() => setStatus(r.id, 'reviewed')}>
              تمت المعالجة
            </Button>
            <Button size="sm" variant="link" className="text-danger" onClick={() => setStatus(r.id, 'dismissed')}>
              تجاهل
            </Button>
          </div>
        ),
    },
  ];

  return <DataTable columns={columns} data={rows} emptyMessage="ما فيه بلاغات حالياً." />;
}
