'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { adminFetch, adminFetchJson } from '@/lib/adminApiClient';
import { isValidConversionTransition } from '@/lib/affiliate/conversionEngine';
import type { ConversionStatus } from '@/lib/affiliate/types';
import { FilterBar } from '@/components/ui/FilterBar';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

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

const STATUS_META: Record<ConversionStatus, { label: string; badge: BadgeVariant }> = {
  PENDING: { label: 'معلّقة', badge: 'warning' },
  APPROVED: { label: 'موافَق عليها', badge: 'info' },
  REJECTED: { label: 'مرفوضة', badge: 'danger' },
  CANCELLED: { label: 'ملغاة', badge: 'neutral' },
  REVERSED: { label: 'معكوسة', badge: 'danger' },
  PAID: { label: 'مدفوعة', badge: 'success' },
  UNMATCHED: { label: 'غير مطابَقة', badge: 'accent' },
};

type ConversionEventRow = {
  id: string;
  event_type: string;
  status_before: string | null;
  status_after: string | null;
  amount: number | null;
  commission: number | null;
  currency: string | null;
  received_at: string;
};

type PostbackEventRow = {
  id: string;
  provider_code: string | null;
  status: string;
  rejection_reason: string | null;
  received_at: string;
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
  const [linkInputs, setLinkInputs] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [events, setEvents] = useState<Record<string, { conversionEvents: ConversionEventRow[]; postbackEvents: PostbackEventRow[] } | null>>({});

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

  // Fix 4: ربط يدوي بكليك -- الوحيدة الطريقة لإنقاذ تحويلة UNMATCHED (الكليك
  // وصل متأخر ولا فيه مطابقة تلقائية، أو محول المزوّد ما أرسل معرّفاً أصلاً).
  const linkClick = async (id: string) => {
    const clickId = (linkInputs[id] ?? '').trim();
    if (!clickId) return;
    setBusyId(id);
    setError(null);
    const res = await adminFetchJson(`${CONVERSIONS_API}?id=${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ conversion_status: 'PENDING', click_id: clickId, reason: 'manual click link (ConversionsTab)' }),
    });
    setBusyId(null);
    if (res.ok) {
      setLinkInputs((prev) => ({ ...prev, [id]: '' }));
      load();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'فشل ربط الكليك');
    }
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!events[id]) {
      const res = await adminFetch(`${CONVERSIONS_API}/${id}/events`);
      const body = await res.json().catch(() => null);
      setEvents((prev) => ({ ...prev, [id]: res.ok ? body : { conversionEvents: [], postbackEvents: [] } }));
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
      <FilterBar
        options={[{ value: 'all', label: 'الكل' }, ...ALL_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }))]}
        value={statusFilter}
        onChange={(v) => setStatusFilter(v as 'all' | ConversionStatus)}
      />

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
              <th className="px-3 py-2">السجل</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6">
                  <EmptyState title="ما فيه تحويلات" />
                </td>
              </tr>
            )}
            {filtered.map((c) => {
              const meta = STATUS_META[c.conversion_status];
              const nextOptions = ALL_STATUSES.filter((s) => isValidConversionTransition(c.conversion_status, s));
              const expanded = expandedId === c.id;
              return (
                <Fragment key={c.id}>
                <tr className="border-t border-latte">
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
                    <Badge variant={meta.badge}>{meta.label}</Badge>
                  </td>
                  <td className="px-3 py-2 text-[11px] text-stone">{new Date(c.conversion_time).toLocaleDateString('ar')}</td>
                  <td className="px-3 py-2">
                    {c.conversion_status === 'UNMATCHED' ? (
                      <div className="flex items-center gap-1">
                        <input
                          value={linkInputs[c.id] ?? ''}
                          onChange={(e) => setLinkInputs((prev) => ({ ...prev, [c.id]: e.target.value }))}
                          placeholder="click_id"
                          dir="ltr"
                          className="w-28 rounded-lg border border-latte px-2 py-1 text-[10px] outline-none focus:border-gold"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[10px]"
                          disabled={busyId === c.id || !(linkInputs[c.id] ?? '').trim()}
                          onClick={() => linkClick(c.id)}
                        >
                          ربط
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {nextOptions.map((s) => (
                          <Button key={s} size="sm" variant="outline" className="text-[10px]" disabled={busyId === c.id} onClick={() => transition(c.id, s)}>
                            {NEXT_STATUS_LABEL[s]}
                          </Button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Button size="sm" variant="link" onClick={() => toggleExpand(c.id)}>
                      {expanded ? 'إخفاء' : 'عرض السجل'}
                    </Button>
                  </td>
                </tr>
                {expanded && (
                  <tr className="border-t border-latte bg-paper/50">
                    <td colSpan={8} className="px-4 py-4">
                      {!events[c.id] ? (
                        <Skeleton className="h-16" />
                      ) : events[c.id]!.conversionEvents.length === 0 && events[c.id]!.postbackEvents.length === 0 ? (
                        <EmptyState title="ما فيه سجل أحداث لهذي التحويلة بعد" />
                      ) : (
                        <div className="space-y-3 text-xs">
                          {events[c.id]!.conversionEvents.length > 0 && (
                            <div>
                              <p className="mb-1.5 font-semibold text-stone">أحداث التحويلة</p>
                              <div className="space-y-1.5">
                                {events[c.id]!.conversionEvents.map((ev) => (
                                  <div key={ev.id} className="flex items-center justify-between rounded-lg border border-latte bg-white px-3 py-2">
                                    <span className="text-coffee">
                                      {ev.event_type}
                                      {ev.status_before && ev.status_after ? ` — ${ev.status_before} → ${ev.status_after}` : ''}
                                    </span>
                                    <span className="text-stone">{new Date(ev.received_at).toLocaleString('ar')}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {events[c.id]!.postbackEvents.length > 0 && (
                            <div>
                              <p className="mb-1.5 font-semibold text-stone">أحداث Webhook الخام (مطابقة بأفضل جهد)</p>
                              <div className="space-y-1.5">
                                {events[c.id]!.postbackEvents.map((ev) => (
                                  <div key={ev.id} className="flex items-center justify-between rounded-lg border border-latte bg-white px-3 py-2">
                                    <span className="text-coffee">
                                      {ev.provider_code ?? '—'} · {ev.status}
                                      {ev.rejection_reason ? ` (${ev.rejection_reason})` : ''}
                                    </span>
                                    <span className="text-stone">{new Date(ev.received_at).toLocaleString('ar')}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
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
