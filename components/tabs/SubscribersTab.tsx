'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

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

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-700',
  paused: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-stone/20 text-mocha',
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

  if (!rows) return <p className="text-mocha">تحميل...</p>;
  if (rows.length === 0) return <p className="text-mocha">ما فيه مشتركين بعد.</p>;

  return (
    <div className="overflow-x-auto rounded-2xl border border-latte bg-white shadow-sm">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-latte bg-sand/40 text-mocha">
            <th className="p-3 text-right">الاسم</th>
            <th className="p-3 text-right">الجوال</th>
            <th className="p-3 text-right">العنوان</th>
            <th className="p-3 text-right">تاريخ الاشتراك</th>
            <th className="p-3 text-right">التجديد القادم</th>
            <th className="p-3 text-right">الحالة</th>
            <th className="p-3 text-right">إجراء</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const status = computedStatus(r);
            return (
              <tr key={r.id} className="border-b border-latte/60">
                <td className="p-3 font-medium text-ink">{r.customer_name ?? '—'}</td>
                <td className="p-3 text-mocha" dir="ltr">
                  {r.customer_phone ?? '—'}
                </td>
                <td className="p-3 text-mocha">{r.customer_address ?? '—'}</td>
                <td className="p-3 text-xs text-stone">{new Date(r.created_at).toLocaleDateString('ar')}</td>
                <td className="p-3 text-xs text-stone">{r.next_billing ?? '—'}</td>
                <td className="p-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLOR[status]}`}>
                    {STATUS_LABEL[status]}
                  </span>
                </td>
                <td className="p-3">
                  {status !== 'cancelled' && (
                    <div className="flex gap-2">
                      <button onClick={() => renew(r.id)} className="text-xs text-gold underline">
                        تجديد شهر
                      </button>
                      <button onClick={() => cancel(r.id)} className="text-xs text-red-600 underline">
                        إلغاء
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
