'use client';

import { StatCardSkeletonGrid } from '@/components/ui/Skeleton';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { adminFetch, adminFetchJson } from '@/lib/adminApiClient';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

const PROGRAMS_API = '/api/admin/affiliate/programs';
const RECON_ITEMS_API = '/api/admin/affiliate/reconciliation/items';

type RunRow = {
  id: string;
  affiliate_program_id: string;
  provider_code: string;
  period_start: string;
  period_end: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  total_internal: number;
  total_provider: number;
  matched: number;
  amount_mismatch: number;
  status_mismatch: number;
  missing_from_provider: number;
  missing_from_internal: number;
  duplicates: number;
};

type ItemRow = {
  id: string;
  recon_status: string;
  internal_amount: number | null;
  provider_amount: number | null;
  discrepancy_notes: string | null;
  resolved_at: string | null;
};
type Option = { id: string; name: string };

const RUN_STATUS_META: Record<RunRow['status'], { label: string; className: string }> = {
  running: { label: 'جارية', className: 'bg-warning-bg text-warning' },
  completed: { label: 'مكتملة', className: 'bg-success-bg text-success' },
  failed: { label: 'فشلت', className: 'bg-danger-bg text-danger' },
  cancelled: { label: 'ملغاة', className: 'bg-stone/20 text-stone' },
};

const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

export function ReconciliationTab() {
  const { toast } = useToast();
  const [runs, setRuns] = useState<RunRow[] | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null); // G-10
  const [programs, setPrograms] = useState<Option[]>([]);
  const [selectedProgram, setSelectedProgram] = useState('');
  const [periodStart, setPeriodStart] = useState(monthAgo());
  const [periodEnd, setPeriodEnd] = useState(today());
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [items, setItems] = useState<Record<string, ItemRow[]>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [{ data }, res] = await Promise.all([
      supabase
        .from('affiliate_reconciliation_runs')
        .select(
          'id, affiliate_program_id, provider_code, period_start, period_end, status, total_internal, total_provider, matched, amount_mismatch, status_mismatch, missing_from_provider, missing_from_internal, duplicates'
        )
        .order('created_at', { ascending: false })
        .returns<RunRow[]>(),
      adminFetch(`${PROGRAMS_API}?limit=100`),
    ]);
    const body = await res.json().catch(() => ({}));
    setRuns(data ?? []);
    if (res.ok) {
      const p: Option[] = body.data ?? [];
      setPrograms(p);
      if (p.length > 0 && !selectedProgram) setSelectedProgram(p[0].id);
    } else {
      setError(body.error ?? 'فشل تحميل البرامج');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerRun = async () => {
    if (!selectedProgram) return;
    setTriggering(true);
    setTriggerMsg(null);
    setError(null);
    const res = await adminFetchJson('/api/admin/affiliate/reconciliation', {
      method: 'POST',
      body: JSON.stringify({ programId: selectedProgram, periodStart, periodEnd }),
    });
    const body = await res.json().catch(() => ({}));
    setTriggering(false);
    if (res.ok) {
      setTriggerMsg(`تمت التسوية: ${body.matched} مطابقة، ${body.amountMismatch + body.statusMismatch} اختلافات`);
      load();
    } else {
      setError(body.error ?? 'فشلت التسوية');
    }
  };

  const uploadCsv = async (file: File) => {
    if (!selectedProgram) return;
    setUploading(true);
    setUploadMsg(null);
    setError(null);
    const form = new FormData();
    form.append('file', file);
    form.append('affiliate_program_id', selectedProgram);
    const res = await adminFetch('/api/admin/affiliate/imports', { method: 'POST', body: form });
    const body = await res.json().catch(() => ({}));
    setUploading(false);
    if (res.ok) {
      setUploadMsg(
        `استُوردت ${body.rowsProcessed} صف: ${body.matched} مطابقة، ${body.unmatched} غير مطابقة، ${body.duplicate} مكررة${body.errors ? `، ${body.errors} خطأ` : ''}`
      );
    } else {
      setError(body.error ?? 'فشل الاستيراد');
    }
  };

  const toggleRun = async (runId: string) => {
    if (expandedRunId === runId) {
      setExpandedRunId(null);
      return;
    }
    setExpandedRunId(runId);
    if (!items[runId]) {
      const { data } = await supabase
        .from('affiliate_reconciliation_items')
        .select('id, recon_status, internal_amount, provider_amount, discrepancy_notes, resolved_at')
        .eq('run_id', runId)
        .neq('recon_status', 'MATCHED')
        .limit(100)
        .returns<ItemRow[]>();
      setItems((prev) => ({ ...prev, [runId]: data ?? [] }));
    }
  };

  const resolveItem = async (runId: string, itemId: string, patch: { recon_status?: string; discrepancy_notes?: string }) => {
    setResolvingId(itemId);
    const res = await adminFetchJson(`${RECON_ITEMS_API}?id=${itemId}`, { method: 'PATCH', body: JSON.stringify(patch) });
    setResolvingId(null);
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setItems((prev) => ({
        ...prev,
        [runId]: prev[runId]?.map((it) => (it.id === itemId ? (body.data as ItemRow) : it)) ?? [],
      }));
      toast({ title: 'تم الحفظ', variant: 'success' });
    } else {
      toast({ title: 'فشل الحفظ', description: body.error, variant: 'destructive' });
    }
  };

  // G-10: إلغاء تشغيل تسوية عالق في 'running'
  const cancelRun = async (runId: string) => {
    setCancellingId(runId);
    const res = await adminFetchJson(`/api/admin/affiliate/reconciliation?id=${runId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'cancelled' }),
    });
    setCancellingId(null);
    if (res.ok) {
      toast({ title: 'تم إلغاء التسوية', variant: 'success' });
      load();
    } else {
      const body = await res.json().catch(() => ({}));
      toast({ title: 'فشل الإلغاء', description: body.error, variant: 'destructive' });
    }
  };

  if (!runs) return <StatCardSkeletonGrid />;

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-danger/40 bg-danger-bg px-3 py-2 text-xs text-danger">
          {error}
          <button onClick={() => setError(null)} className="mr-2 font-bold">
            ×
          </button>
        </div>
      )}
      <div className="grid gap-3 rounded-2xl border border-latte bg-paper p-4 shadow-sm sm:grid-cols-4">
        <Field label="البرنامج">
          <select
            value={selectedProgram}
            onChange={(e) => setSelectedProgram(e.target.value)}
            className="w-full rounded-lg border border-latte bg-paper px-2 py-1.5 text-xs outline-none focus:border-gold"
          >
            {programs.length === 0 && <option value="">ما فيه برامج بعد</option>}
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="من">
          <input
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            type="date"
            dir="ltr"
            className="w-full rounded-lg border border-latte bg-paper px-2 py-1.5 text-xs outline-none focus:border-gold"
          />
        </Field>
        <Field label="إلى">
          <input
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            type="date"
            dir="ltr"
            className="w-full rounded-lg border border-latte bg-paper px-2 py-1.5 text-xs outline-none focus:border-gold"
          />
        </Field>
        <div className="flex items-end">
          <button
            onClick={triggerRun}
            disabled={triggering || !selectedProgram}
            className="w-full rounded-full bg-gold px-4 py-1.5 text-xs font-bold text-on-gold disabled:opacity-50"
          >
            {triggering ? 'جاري التشغيل...' : 'تشغيل تسوية'}
          </button>
        </div>
        {triggerMsg && <p className="text-xs text-mocha sm:col-span-4">{triggerMsg}</p>}
        <p className="text-[11px] text-stone sm:col-span-4">
          يحتاج البرنامج تكامل مزوّد نشط عنده conversion_api أو report_import (Awin/CJ/Amazon مع بيانات اعتماد محفوظة -- انظر تبويب
          "البرامج"). التاجر المباشر ما يدعم هذا حالياً (ما فيه API يُسوّى ضده).
        </p>

        <div className="border-t border-latte pt-3 sm:col-span-4">
          <p className="mb-1.5 text-xs font-semibold text-stone">استيراد تقرير CSV (لمزوّدات ما عندها API حي مثل Amazon)</p>
          <input
            type="file"
            accept=".csv"
            disabled={uploading || !selectedProgram}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadCsv(file);
              e.target.value = '';
            }}
            className="text-xs text-coffee file:ml-2 file:rounded-full file:border file:border-latte file:bg-paper file:px-3 file:py-1.5 file:text-xs file:text-coffee disabled:opacity-50"
          />
          {uploading && <p className="mt-1 text-[11px] text-mocha">جاري الاستيراد...</p>}
          {uploadMsg && <p className="mt-1 text-[11px] text-mocha">{uploadMsg}</p>}
        </div>
      </div>

      <div className="space-y-2">
        {runs.length === 0 && <p className="p-6 text-center text-mocha">ما فيه تشغيلات تسوية بعد.</p>}
        {runs.map((run) => {
          const meta = RUN_STATUS_META[run.status];
          const expanded = expandedRunId === run.id;
          return (
            <div key={run.id} className="overflow-hidden rounded-2xl border border-latte bg-paper shadow-sm">
              <button onClick={() => toggleRun(run.id)} className="flex w-full items-center gap-3 p-3 text-right">
                <div className="flex-1">
                  <p className="font-medium text-ink">{programs.find((p) => p.id === run.affiliate_program_id)?.name ?? '—'}</p>
                  <p className="text-xs text-mocha">
                    {run.period_start.slice(0, 10)} → {run.period_end.slice(0, 10)} · {run.provider_code}
                  </p>
                </div>
                <span className="text-xs text-coffee">{run.matched} مطابقة</span>
                {run.amount_mismatch + run.status_mismatch + run.missing_from_provider + run.missing_from_internal > 0 && (
                  <span className="rounded-full bg-danger-bg px-2 py-0.5 text-[10px] text-danger">
                    {run.amount_mismatch + run.status_mismatch + run.missing_from_provider + run.missing_from_internal} اختلاف
                  </span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.className}`}>{meta.label}</span>
                <span className={`text-mocha transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
              </button>

              {run.status === 'running' && (
                <div className="flex justify-end border-t border-latte px-3 py-1.5">
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] text-danger" disabled={cancellingId === run.id} onClick={() => cancelRun(run.id)}>
                    {cancellingId === run.id ? 'جاري الإلغاء...' : 'إلغاء التشغيل'}
                  </Button>
                </div>
              )}

              {expanded && (
                <div className="border-t border-latte bg-paper/50 p-4">
                  {(items[run.id]?.length ?? 0) === 0 ? (
                    <p className="text-xs text-mocha">ما فيه اختلافات -- كل شي مطابق.</p>
                  ) : (
                    <div className="space-y-2">
                      {items[run.id]!.map((item) => (
                        <div key={item.id} className="space-y-2 rounded-lg border border-latte bg-paper p-3 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="rounded-full bg-danger-bg px-2 py-0.5 text-[10px] text-danger">{item.recon_status}</span>
                            <span className="text-mocha">
                              داخلي: {item.internal_amount ?? '—'} · مزوّد: {item.provider_amount ?? '—'}
                            </span>
                          </div>
                          {item.discrepancy_notes && <p className="text-[11px] text-stone">ملاحظة سابقة: {item.discrepancy_notes}</p>}
                          {item.resolved_at ? (
                            <p className="text-[11px] text-success">تم الحل بتاريخ {new Date(item.resolved_at).toLocaleDateString('ar')}</p>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              {item.recon_status === 'AMOUNT_MISMATCH' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={resolvingId === item.id}
                                  onClick={() => resolveItem(run.id, item.id, { recon_status: 'MATCHED', discrepancy_notes: 'قُبل مبلغ المزوّد يدوياً' })}
                                >
                                  قبول مبلغ المزوّد
                                </Button>
                              )}
                              {item.recon_status === 'STATUS_MISMATCH' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={resolvingId === item.id}
                                  onClick={() => resolveItem(run.id, item.id, { recon_status: 'MATCHED', discrepancy_notes: 'حُدّثت الحالة يدوياً لمطابقة المزوّد' })}
                                >
                                  تحديث الحالة لمطابقة المزوّد
                                </Button>
                              )}
                              {item.recon_status === 'MANUAL_REVIEW' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={resolvingId === item.id}
                                  onClick={() => resolveItem(run.id, item.id, { recon_status: 'MATCHED' })}
                                >
                                  تعيين كمطابق (بعد المراجعة)
                                </Button>
                              )}
                              <input
                                value={noteDraft[item.id] ?? ''}
                                onChange={(e) => setNoteDraft((d) => ({ ...d, [item.id]: e.target.value }))}
                                placeholder="أضف ملاحظة..."
                                className="min-w-[160px] flex-1 rounded-lg border border-latte bg-paper px-2 py-1 text-[11px] outline-none focus:border-gold"
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={resolvingId === item.id || !noteDraft[item.id]?.trim()}
                                onClick={() => {
                                  resolveItem(run.id, item.id, { discrepancy_notes: noteDraft[item.id].trim() });
                                  setNoteDraft((d) => ({ ...d, [item.id]: '' }));
                                }}
                              >
                                حفظ الملاحظة
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
