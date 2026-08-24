'use client';

import { Fragment, useEffect, useState } from 'react';
import { adminFetch, adminFetchJson } from '@/lib/adminApiClient';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';

const PAYOUTS_API = '/api/admin/affiliate/payouts';
const PROGRAMS_API = '/api/admin/affiliate/programs';

type PayoutRow = {
  id: string;
  affiliate_program_id: string;
  amount: number;
  currency: string;
  payout_date: string;
  period_start: string | null;
  period_end: string | null;
  status: 'EXPECTED' | 'RECEIVED' | 'RECONCILED' | 'DISPUTED';
  payment_reference: string | null;
  exchange_rate: number | null;
  base_amount: number | null;
  base_currency: string | null;
};

type Option = { id: string; name: string };

const STATUS_META: Record<PayoutRow['status'], { label: string; className: string; badge: 'warning' | 'success' | 'info' | 'danger' }> = {
  EXPECTED: { label: 'متوقّعة', className: 'bg-amber-100 text-amber-700', badge: 'warning' },
  RECEIVED: { label: 'مستلمة', className: 'bg-green-100 text-green-700', badge: 'success' },
  RECONCILED: { label: 'مُسوّاة', className: 'bg-blue-100 text-blue-700', badge: 'info' },
  DISPUTED: { label: 'محل نزاع', className: 'bg-red-100 text-red-700', badge: 'danger' },
};

const TIMELINE_STEPS: PayoutRow['status'][] = ['EXPECTED', 'RECEIVED', 'RECONCILED'];

const emptyForm = {
  programId: '',
  amount: '',
  currency: 'AED',
  payoutDate: new Date().toISOString().slice(0, 10),
  periodStart: '',
  periodEnd: '',
  reference: '',
  exchangeRate: '',
  baseAmount: '',
  baseCurrency: '',
};

export function PayoutsTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<PayoutRow[] | null>(null);
  const [programs, setPrograms] = useState<Option[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [payoutsRes, programsRes] = await Promise.all([adminFetch(`${PAYOUTS_API}?limit=100`), adminFetch(`${PROGRAMS_API}?limit=100`)]);
    const payoutsBody = await payoutsRes.json().catch(() => ({}));
    const programsBody = await programsRes.json().catch(() => ({}));
    if (payoutsRes.ok) setRows(payoutsBody.data ?? []);
    else setError(payoutsBody.error ?? 'فشل تحميل المدفوعات');
    setPrograms(programsBody.data ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const createPayout = async () => {
    const amount = Number(form.amount);
    if (!form.programId || !Number.isFinite(amount) || amount <= 0) return;
    setSaving(true);
    setError(null);
    const res = await adminFetchJson(PAYOUTS_API, {
      method: 'POST',
      body: JSON.stringify({
        affiliate_program_id: form.programId,
        amount,
        currency: form.currency.trim() || 'AED',
        payout_date: form.payoutDate,
        period_start: form.periodStart || null,
        period_end: form.periodEnd || null,
        payment_reference: form.reference.trim() || null,
        exchange_rate: form.exchangeRate ? Number(form.exchangeRate) : null,
        base_amount: form.baseAmount ? Number(form.baseAmount) : null,
        base_currency: form.baseCurrency.trim() || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setForm(emptyForm);
      setShowAdd(false);
      load();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'فشل إنشاء الدفعة');
    }
  };

  const setPayoutStatus = async (id: string, status: PayoutRow['status']) => {
    setBusyId(id);
    setError(null);
    const res = await adminFetchJson(`${PAYOUTS_API}?id=${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    setBusyId(null);
    if (res.ok) {
      toast({ title: 'تم تحديث حالة الدفعة', variant: 'success' });
      load();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'فشل تحديث الحالة');
    }
  };

  const markReceived = (id: string) => setPayoutStatus(id, 'RECEIVED');

  if (!rows) return <p className="text-mocha">تحميل...</p>;

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
          <button onClick={() => setError(null)} className="mr-2 font-bold">
            ×
          </button>
        </div>
      )}
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
          <Field label="بداية نافذة التحويلات (اختياري)">
            <input
              value={form.periodStart}
              onChange={(e) => setForm((f) => ({ ...f, periodStart: e.target.value }))}
              type="date"
              dir="ltr"
              className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
            />
          </Field>
          <Field label="نهاية نافذة التحويلات (اختياري)">
            <input
              value={form.periodEnd}
              onChange={(e) => setForm((f) => ({ ...f, periodEnd: e.target.value }))}
              type="date"
              dir="ltr"
              className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
            />
          </Field>
          <div className="border-t border-latte pt-3 sm:col-span-2">
            <p className="mb-2 text-[11px] font-semibold text-stone">تحويل العملة (اختياري -- إذا عملة الدفعة تختلف عن عملة البرنامج)</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="سعر الصرف" helper="exchange_rate">
                <Input
                  dir="ltr"
                  type="number"
                  step="0.0001"
                  value={form.exchangeRate}
                  onChange={(e) => setForm((f) => ({ ...f, exchangeRate: e.target.value }))}
                  className="h-8 text-xs"
                />
              </Field>
              <Field label="المبلغ بعملة البرنامج" helper="base_amount">
                <Input
                  dir="ltr"
                  type="number"
                  step="0.01"
                  value={form.baseAmount}
                  onChange={(e) => setForm((f) => ({ ...f, baseAmount: e.target.value }))}
                  className="h-8 text-xs"
                />
              </Field>
              <Field label="عملة البرنامج" helper="base_currency">
                <Input
                  dir="ltr"
                  value={form.baseCurrency}
                  onChange={(e) => setForm((f) => ({ ...f, baseCurrency: e.target.value }))}
                  className="h-8 text-xs"
                />
              </Field>
            </div>
          </div>
          <p className="text-[11px] text-stone sm:col-span-2">
            أي تحويلات "موافَق عليها" ضمن هالنافذة تنتقل تلقائياً لـ"مدفوعة" لما تُعلّم الدفعة كمستلمة. بدون نافذة، يُستخدم كل الموافَق عليه قبل تاريخ الدفعة.
          </p>
          <div className="sm:col-span-2">
            <Button onClick={createPayout} disabled={saving || !form.programId || !form.amount} size="sm">
              {saving ? 'جاري الحفظ...' : 'إنشاء'}
            </Button>
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
              <th className="px-3 py-2">النافذة</th>
              <th className="px-3 py-2">الحالة</th>
              <th className="px-3 py-2">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-mocha">
                  ما فيه دفعات بعد.
                </td>
              </tr>
            )}
            {rows.map((p) => {
              const meta = STATUS_META[p.status];
              const expanded = expandedId === p.id;
              const currentStepIndex = TIMELINE_STEPS.indexOf(p.status === 'DISPUTED' ? 'RECEIVED' : p.status);
              return (
                <Fragment key={p.id}>
                  <tr className="cursor-pointer border-t border-latte hover:bg-sand/30" onClick={() => setExpandedId(expanded ? null : p.id)}>
                    <td className="px-3 py-2 text-xs text-mocha">{programs.find((pr) => pr.id === p.affiliate_program_id)?.name ?? '—'}</td>
                    <td className="px-3 py-2 font-[var(--font-el-messiri)] tabular-nums text-coffee">
                      {Number(p.amount).toFixed(2)} {p.currency}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-stone">{p.payout_date}</td>
                    <td dir="ltr" className="px-3 py-2 text-left text-[11px] text-stone">
                      {p.period_start || p.period_end ? `${p.period_start ?? '…'} → ${p.period_end ?? '…'}` : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={meta.badge}>{meta.label}</Badge>
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-1.5">
                        {p.status === 'EXPECTED' && (
                          <Button size="sm" variant="outline" disabled={busyId === p.id} onClick={() => markReceived(p.id)}>
                            تعليم كمستلمة
                          </Button>
                        )}
                        {(p.status === 'RECEIVED' || p.status === 'RECONCILED') && (
                          <Button size="sm" variant="outline" disabled={busyId === p.id} onClick={() => setPayoutStatus(p.id, 'DISPUTED')}>
                            نزاع
                          </Button>
                        )}
                        {p.status === 'RECEIVED' && (
                          <Button size="sm" variant="outline" disabled={busyId === p.id} onClick={() => setPayoutStatus(p.id, 'RECONCILED')}>
                            تسوية
                          </Button>
                        )}
                        {p.status === 'DISPUTED' && (
                          <>
                            <Button size="sm" variant="outline" disabled={busyId === p.id} onClick={() => setPayoutStatus(p.id, 'RECONCILED')}>
                              حل النزاع → مُسوّاة
                            </Button>
                            <Button size="sm" variant="ghost" disabled={busyId === p.id} onClick={() => setPayoutStatus(p.id, 'RECEIVED')}>
                              رجوع لمستلمة
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="border-t border-latte bg-paper/50">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="flex items-center justify-center gap-2 py-2">
                          {TIMELINE_STEPS.map((step, i) => (
                            <div key={step} className="flex items-center gap-2">
                              <div className="flex flex-col items-center gap-1">
                                <span
                                  className={`h-3 w-3 rounded-full ${
                                    i < currentStepIndex
                                      ? 'bg-success'
                                      : i === currentStepIndex
                                        ? p.status === 'DISPUTED'
                                          ? 'bg-danger'
                                          : 'bg-gold'
                                        : 'border border-latte bg-white'
                                  }`}
                                />
                                <span className="text-[10px] text-stone">{STATUS_META[step].label}</span>
                              </div>
                              {i < TIMELINE_STEPS.length - 1 && <span className="h-px w-10 bg-latte" />}
                            </div>
                          ))}
                          {p.status === 'DISPUTED' && (
                            <span className="ms-3 text-[10px] font-medium text-danger">↳ محل نزاع</span>
                          )}
                        </div>
                        {(p.exchange_rate || p.base_amount) && (
                          <p dir="ltr" className="text-center text-[11px] text-mocha">
                            {p.base_amount?.toFixed(2)} {p.base_currency} @ {p.exchange_rate}
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
