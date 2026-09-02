'use client';

import { StatCardSkeletonGrid } from '@/components/ui/Skeleton';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

type SubscriberRow = {
  id: string;
  status: 'active' | 'paused' | 'cancelled';
  next_billing: string | null;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
};

const todayStr = () => new Date().toISOString().slice(0, 10);

function computedStatus(s: SubscriberRow) {
  if (s.status === 'active' && (s.next_billing ?? '') < todayStr()) return 'expired';
  return s.status;
}

const STATUS_LABEL: Record<string, string> = {
  active: 'نشط',
  expired: 'منتهي',
  paused: 'موقوف',
  cancelled: 'ملغي',
};

const STATUS_BADGE: Record<string, BadgeVariant> = {
  active: 'success',
  expired: 'danger',
  paused: 'warning',
  cancelled: 'neutral',
};

export function SubscribersTab() {
  const [rows, setRows] = useState<SubscriberRow[] | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from('subscriptions')
      .select('id, status, next_billing, created_at, customer_name, customer_phone, customer_address')
      .order('created_at', { ascending: false })
      .returns<SubscriberRow[]>();
    setRows(data ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const renew = async (id: string) => {
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    await supabase
      .from('subscriptions')
      .update({ status: 'active', next_billing: next.toISOString().slice(0, 10) })
      .eq('id', id);
    load();
  };

  const cancel = async (id: string) => {
    await supabase.from('subscriptions').update({ status: 'cancelled' }).eq('id', id);
    load();
  };

  if (!rows) return <StatCardSkeletonGrid />;

  const columns: DataTableColumn<SubscriberRow>[] = [
    { key: 'name', header: 'الاسم', render: (r) => r.customer_name ?? '—', sortValue: (r) => r.customer_name ?? '' },
    { key: 'phone', header: 'الجوال', render: (r) => <span dir="ltr">{r.customer_phone ?? '—'}</span> },
    { key: 'address', header: 'العنوان', render: (r) => r.customer_address ?? '—' },
    {
      key: 'created',
      header: 'تاريخ الاشتراك',
      render: (r) => new Date(r.created_at).toLocaleDateString('ar'),
      sortValue: (r) => r.created_at,
    },
    { key: 'next_billing', header: 'التجديد القادم', render: (r) => r.next_billing ?? '—', sortValue: (r) => r.next_billing ?? '' },
    {
      key: 'status',
      header: 'الحالة',
      render: (r) => {
        const status = computedStatus(r);
        return <Badge variant={STATUS_BADGE[status]}>{STATUS_LABEL[status]}</Badge>;
      },
      sortValue: (r) => computedStatus(r),
    },
    {
      key: 'action',
      header: 'إجراء',
      render: (r) =>
        computedStatus(r) !== 'cancelled' && (
          <div className="flex gap-2">
            <Button size="sm" variant="link" onClick={() => renew(r.id)}>
              تجديد شهر
            </Button>
            <Button size="sm" variant="link" className="text-danger" onClick={() => cancel(r.id)}>
              إلغاء
            </Button>
          </div>
        ),
    },
  ];

  return <DataTable columns={columns} data={rows} emptyMessage="ما فيه مشتركين بعد." />;
}
