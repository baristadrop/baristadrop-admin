'use client';

import { StatCardSkeletonGrid } from '@/components/ui/Skeleton';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DirhamIcon } from '@/components/icons/DirhamIcon';
import { Button } from '@/components/ui/Button';
import { AlertDialog } from '@/components/ui/AlertDialog';
import { useToast } from '@/components/ui/Toast';

type OrderItemRow = {
  qty: number;
  unit_price: number;
  products: { name: string } | null;
};

type OrderRow = {
  id: string;
  order_number: number;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address: string | null;
  total: number;
  status: string;
  created_at: string;
  order_items: OrderItemRow[];
};

const STATUSES = ['pending', 'paid', 'shipped', 'cancelled'] as const;

const STATUS_LABEL: Record<string, string> = {
  pending: 'قيد المعالجة',
  paid: 'مدفوع',
  shipped: 'تم الشحن',
  cancelled: 'ملغي',
};

function formatOrderText(o: OrderRow) {
  const lines = [
    `طلب #${o.order_number}`,
    `الاسم: ${o.customer_name ?? '—'}`,
    `الجوال: ${o.customer_phone ?? '—'}`,
    `البريد: ${o.customer_email ?? '—'}`,
    `العنوان: ${o.customer_address ?? '—'}`,
    '',
    'المنتجات:',
    ...o.order_items.map((i) => `- ${i.products?.name ?? 'منتج'} × ${i.qty} (${i.unit_price} د.إ)`),
    '',
    `الإجمالي: ${o.total} د.إ`,
  ];
  return lines.join('\n');
}

export function OrdersTab() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from('orders')
      .select(
        'id, order_number, customer_name, customer_phone, customer_email, customer_address, total, status, created_at, order_items(qty, unit_price, products(name))'
      )
      .order('created_at', { ascending: false })
      .returns<OrderRow[]>();
    setOrders(data ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const setStatus = async (id: string, status: string) => {
    setOrders((prev) => prev?.map((o) => (o.id === id ? { ...o, status } : o)) ?? null);
    await supabase.from('orders').update({ status }).eq('id', id);
  };

  const copyOrder = async (o: OrderRow) => {
    await navigator.clipboard.writeText(formatOrderText(o));
    setCopiedId(o.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const removeOrder = async (id: string) => {
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) {
      toast({ title: 'فشل الحذف', description: error.message, variant: 'destructive' });
      setConfirmingId(null);
      return;
    }
    setOrders((prev) => prev?.filter((o) => o.id !== id) ?? null);
    setConfirmingId(null);
  };

  if (!orders) return <StatCardSkeletonGrid />;
  if (orders.length === 0) return <p className="text-mocha">ما فيه طلبات بعد.</p>;

  return (
    <div className="space-y-4">
      {orders.map((o) => (
        <div key={o.id} className="rounded-2xl border border-latte bg-paper p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="font-[var(--font-cormorant)] text-xl font-bold text-ink">#{o.order_number}</span>
              <span className="text-xs text-stone">{new Date(o.created_at).toLocaleString('ar')}</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={o.status}
                onChange={(e) => setStatus(o.id, e.target.value)}
                className="rounded-lg border border-latte bg-paper px-2 py-1.5 text-xs outline-none focus:border-gold"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="secondary" onClick={() => copyOrder(o)}>
                {copiedId === o.id ? 'تم النسخ ✓' : 'نسخ لبيانات المخزن'}
              </Button>
              <Button size="sm" variant="outline" className="border-danger/40 text-danger hover:border-danger hover:text-danger" onClick={() => setConfirmingId(o.id)}>
                حذف
              </Button>
              <AlertDialog
                open={confirmingId === o.id}
                title="حذف الطلب"
                description="هل أنت متأكد؟ هذا الإجراء لا يمكن التراجع عنه."
                confirmLabel="حذف"
                onConfirm={() => removeOrder(o.id)}
                onCancel={() => setConfirmingId(null)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-paper p-3 text-sm">
              <p className="mb-1 font-medium text-ink">بيانات العميل</p>
              <p className="text-mocha">الاسم: {o.customer_name ?? '—'}</p>
              <p className="text-mocha" dir="ltr">
                الجوال: {o.customer_phone ?? '—'}
              </p>
              <p className="text-mocha" dir="ltr">
                البريد: {o.customer_email ?? '—'}
              </p>
              <p className="text-mocha">العنوان: {o.customer_address ?? '—'}</p>
            </div>
            <div className="rounded-xl bg-paper p-3 text-sm">
              <p className="mb-1 font-medium text-ink">المنتجات</p>
              {o.order_items.map((i, idx) => (
                <p key={idx} className="text-mocha">
                  {i.products?.name ?? 'منتج'} × {i.qty} — {i.unit_price * i.qty} <DirhamIcon />
                </p>
              ))}
              <p className="mt-1 font-bold text-coffee">
                الإجمالي: {o.total} <DirhamIcon />
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
