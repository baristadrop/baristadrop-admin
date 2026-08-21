'use client';

import { useEffect, useMemo, useState } from 'react';
import { adminFetch, adminFetchJson } from '@/lib/adminApiClient';
import { isValidConversionTransition } from '@/lib/affiliate/conversionEngine';
import type { ConversionStatus } from '@/lib/affiliate/types';

const CONVERSIONS_API = '/api/admin/affiliate/conversions';
const PROGRAMS_API = '/api/admin/affiliate/programs';

type ConversionRow = {
  id: string;
  affiliate_program_id: string;
  click_id: string | null;
  provider_conversion_id: string;
  sale_amount: number;
  commission_amount: number;
  currency: string;
  conversion_status: ConversionStatus;
  conversion_time: string;
};

type Option = { id: string; name: string };

const ALL_STATUSES: ConversionStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REVERSED', 'PAID', 'UNMATCHED'];

const STATUS_META: Record<ConversionStatus, { label: string; className: string }> = {
  PENDING: { label: 'معلّقة', className: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'موافَق عليها', className: 'bg-blue-100 text-blue-700' },
  REJECTED: { label: 'مرفوضة', className: 'bg-red-100 text-red-700' },
  CANCELLED: { label: 'ملغاة', className: 'bg-stone/20 text-stone' },
  REVERSED: { label: 'معكوسة', className: 'bg-red-100 text-red-700' },
  PAID: { label: 'مدفوعة', className: 'bg-green-100 text-green-700' },
  UNMATCHED: { label: 'غير مطابَقة', className: 'bg-purple-100 text-purple-700' },
};

const NEXT_STATUS_LABEL: Record<ConversionStatus, string> = {
  PENDING: 'إعادة للمعلّقة',
  APPROVED: 'موافقة',
  REJECTED: 'رفض',
  CANCELLED: 'إلغاء',
  REVERSED: 'عكس',
  PAID: 'تعليم كمدفوعة',
  UNMATCHED: '—',
};

export function ConversionsTab() {
  const [rows, setRows] = useState<ConversionRow[] | null>(null);
  const [programs, setPrograms] = useState<Option[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | ConversionStatus>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [conversionsRes, programsRes] = await Promise.all([
      adminFetch(`${CONVERSIONS_API}?limit=200`),
      adminFetch(`${PROGRAMS_API}?limit=100`),
    ]);
    const conversionsBody = await conversionsRes.json().catch(() => ({}));
    const programsBody = await programsRes.json().catch(() => ({}));
    if (conversionsRes.ok) setRows(conversionsBody.data ?? []);
    else setError(conversionsBody.error ?? 'فشل تحميل التحويلات');
    setPrograms(programsBody.data ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const transition = async (id: string, to: ConversionStatus) => {
    setBusyId(id);
    setError(null);
    const res = await adminFetchJson(`${CONVERSIONS_API}?id=${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ conversion_status: to, reason: 'admin manual action (ConversionsTab)' }),
    });
    setBusyId(null);
    if (res.ok) load();
    else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'فشل تغيير الحالة');
    }
  };

  const filtered = useMemo(() => {
    if (!rows) return [];
    return statusFilter === 'all' ? rows : rows.filter((r) => r.conversion_status === statusFilter);
  }, [rows, statusFilter]);

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
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={`rounded-full border px-3 py-1.5 text-xs ${statusFilter === 'all' ? 'border-gold bg-gold text-white' : 'border-latte text-coffee'}`}
        >
          الكل
        </button>
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full border px-3 py-1.5 text-xs ${statusFilter === s ? 'border-gold bg-gold text-white' : 'border-latte text-coffee'}`}
          >
            {STATUS_META[s].label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-latte bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-right text-sm">
          <thead className="bg-sand/60 text-[11px] uppercase tracking-wide text-mocha">
            <tr>
              <th className="px-3 py-2">البرنامج</th>
              <th className="px-3 py-2">رقم التحويلة</th>
              <th className="px-3 py-2">المبلغ</th>
              <th className="px-3 py-2">العمولة</th>
              <th className="px-3 py-2">الحالة</th>
              <th className="px-3 py-2">التاريخ</th>
              <th className="px-3 py-2">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-mocha">
                  ما فيه تحويلات.
                </td>
              </tr>
            )}
            {filtered.map((c) => {
              const meta = STATUS_META[c.conversion_status];
              const nextOptions = ALL_STATUSES.filter((s) => isValidConversionTransition(c.conversion_status, s));
              return (
                <tr key={c.id} className="border-t border-latte">
                  <td className="px-3 py-2 text-xs text-mocha">{programs.find((p) => p.id === c.affiliate_program_id)?.name ?? '—'}</td>
                  <td dir="ltr" className="px-3 py-2 text-left text-[11px] text-stone">
                    {c.provider_conversion_id}
                  </td>
                  <td className="px-3 py-2 font-[var(--font-el-messiri)] tabular-nums text-coffee">
                    {Number(c.sale_amount).toFixed(2)} {c.currency}
                  </td>
                  <td className="px-3 py-2 font-[var(--font-el-messiri)] tabular-nums text-gold">
                    {Number(c.commission_amount).toFixed(2)} {c.currency}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.className}`}>{meta.label}</span>
                  </td>
                  <td className="px-3 py-2 text-[11px] text-stone">{new Date(c.conversion_time).toLocaleDateString('ar')}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {nextOptions.map((s) => (
                        <button
                          key={s}
                          disabled={busyId === c.id}
                          onClick={() => transition(c.id, s)}
                          className="rounded-full border border-latte px-2 py-1 text-[10px] text-coffee hover:border-gold disabled:opacity-50"
                        >
                          {NEXT_STATUS_LABEL[s]}
                        </button>
                      ))}
                    </div>
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
