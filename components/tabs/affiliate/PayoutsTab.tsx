'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { markPayoutReceived } from '@/lib/affiliate/commissionService';
import { Field } from '@/components/ui/Field';

type PayoutRow = {
  id: string;
  affiliate_program_id: string;
  amount: number;
  currency: string;
  payout_date: string;
  status: 'EXPECTED' | 'RECEIVED' | 'RECONCILED' | 'DISPUTED';
  payment_reference: string | null;
};

type Option = { id: string; name: string };

const STATUS_META: Record<PayoutRow['status'], { label: string; className: string }> = {
  EXPECTED: { label: 'متوقّعة', className: 'bg-amber-100 text-amber-700' },
  RECEIVED: { label: 'مستلمة', className: 'bg-green-100 text-green-700' },
  RECONCILED: { label: 'مُسوّاة', className: 'bg-blue-100 text-blue-700' },
  DISPUTED: { label: 'محل نزاع', className: 'bg-red-100 text-red-700' },
};

const emptyForm = { programId: '', amount: '', currency: 'AED', payoutDate: new Date().toISOString().slice(0, 10), reference: '' };

export function PayoutsTab() {
  const [rows, setRows] = useState<PayoutRow[] | null>(null);
  const [programs, setPrograms] = useState<Option[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const [{ data }, { data: p }] = await Promise.all([
      supabase.from('affiliate_payouts').select('*').order('payout_date', { ascending: false }).returns<PayoutRow[]>(),
      supabase.from('affiliate_programs').select('id, name').returns<Option[]>(),
    ]);
    setRows(data ?? []);
    setPrograms(p ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const createPayout = async () => {
    const amount = Number(form.amount);
    if (!form.programId || !Number.isFinite(amount) || amount <= 0) return;
    setSaving(true);
    const { error } = await supabase.from('affiliate_payouts').insert({
      affiliate_program_id: form.programId,
      amount,
      currency: form.currency.trim() || 'AED',
      payout_date: form.payoutDate,
      payment_reference: form.reference.trim() || null,
    });
    setSaving(false);
    if (!error) {
      setForm(emptyForm);
      setShowAdd(false);
      load();
    }
  };

  const markReceived = async (id: string) => {
    setBusyId(id);
    await markPayoutReceived(supabase, id);
    setBusyId(null);
    load();
  };

  if (!rows) return <p className="text-mocha">تحميل...</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-mocha">دفعات فعلية مستلمة من الشبكة/التاجر -- "تعليم كمستلمة" يسجّل قيد PAYOUT_RECEIVED بدفتر الأستاذ تلقائياً.</p>
        <button onClick={() => setShowAdd((v) => !v)} className="rounded-full bg-ink px-4 py-1.5 text-xs font-bold text-cream">
          {showAdd ? 'إلغاء' : '+ دفعة جديدة'}
        </button>
      </div>

      {showAdd && (
        <div className="grid gap-3 rounded-2xl border border-gold/40 bg-sand/40 p-4 sm:grid-cols-2">
          <Field label="البرنامج *">
            <select
              value={form.programId}
              onChange={(e) => setForm((f) => ({ ...f, programId: e.target.value }))}
              className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
            >
              <option value="">اختر...</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="المبلغ *">
            <input
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              type="number"
              step="0.01"
              dir="ltr"
              className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
            />
          </Field>
          <Field label="تاريخ الدفعة">
            <input
              value={form.payoutDate}
              onChange={(e) => setForm((f) => ({ ...f, payoutDate: e.target.value }))}
              type="date"
              dir="ltr"
              className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
            />
          </Field>
          <Field label="مرجع الدفعة">
            <input
              value={form.reference}
              onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
              dir="ltr"
              className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
            />
          </Field>
          <div className="sm:col-span-2">
            <button
              onClick={createPayout}
              disabled={saving || !form.programId || !form.amount}
              className="rounded-full bg-gold px-5 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {saving ? 'جاري الحفظ...' : 'إنشاء'}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-latte bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-right text-sm">
          <thead className="bg-sand/60 text-[11px] uppercase tracking-wide text-mocha">
            <tr>
              <th className="px-3 py-2">البرنامج</th>
              <th className="px-3 py-2">المبلغ</th>
              <th className="px-3 py-2">التاريخ</th>
              <th className="px-3 py-2">الحالة</th>
              <th className="px-3 py-2">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-mocha">
                  ما فيه دفعات بعد.
                </td>
              </tr>
            )}
            {rows.map((p) => {
              const meta = STATUS_META[p.status];
              return (
                <tr key={p.id} className="border-t border-latte">
                  <td className="px-3 py-2 text-xs text-mocha">{programs.find((pr) => pr.id === p.affiliate_program_id)?.name ?? '—'}</td>
                  <td className="px-3 py-2 font-[var(--font-el-messiri)] tabular-nums text-coffee">
                    {Number(p.amount).toFixed(2)} {p.currency}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-stone">{p.payout_date}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.className}`}>{meta.label}</span>
                  </td>
                  <td className="px-3 py-2">
                    {p.status === 'EXPECTED' && (
                      <button
                        disabled={busyId === p.id}
                        onClick={() => markReceived(p.id)}
                        className="rounded-full border border-gold px-3 py-1 text-[11px] text-gold hover:bg-gold hover:text-white disabled:opacity-50"
                      >
                        تعليم كمستلمة
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
