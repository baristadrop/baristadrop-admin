'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { adminFetch, adminFetchJson } from '@/lib/adminApiClient';
import { Field } from '@/components/ui/Field';

const PROGRAMS_API = '/api/admin/affiliate/programs';

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

type ItemRow = { id: string; recon_status: string; internal_amount: number | null; provider_amount: number | null; discrepancy_notes: string | null };
type Option = { id: string; name: string };

const RUN_STATUS_META: Record<RunRow['status'], { label: string; className: string }> = {
  running: { label: 'جارية', className: 'bg-amber-100 text-amber-700' },
  completed: { label: 'مكتملة', className: 'bg-green-100 text-green-700' },
  failed: { label: 'فشلت', className: 'bg-red-100 text-red-700' },
  cancelled: { label: 'ملغاة', className: 'bg-stone/20 text-stone' },
};

const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

export function ReconciliationTab() {
  const [runs, setRuns] = useState<RunRow[] | null>(null);
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
        .select('id, recon_status, internal_amount, provider_amount, discrepancy_notes')
        .eq('run_id', runId)
        .neq('recon_status', 'MATCHED')
        .limit(100)
        .returns<ItemRow[]>();
      setItems((prev) => ({ ...prev, [runId]: data ?? [] }));
    }
  };

  if (!runs) return <p className="text-mocha">تحميل...</p>;

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
          <button onClick={() => setError(null)} className="mr-2 font-bold">
            ×
          </button>
        </div>
      )}
      <div className="grid gap-3 rounded-2xl border border-latte bg-white p-4 shadow-sm sm:grid-cols-4">
        <Field label="البرنامج">
          <select
            value={selectedProgram}
            onChange={(e) => setSelectedProgram(e.target.value)}
            className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
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
            className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
          />
        </Field>
        <Field label="إلى">
          <input
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            type="date"
            dir="ltr"
            className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
          />
        </Field>
        <div className="flex items-end">
          <button
            onClick={triggerRun}
            disabled={triggering || !selectedProgram}
            className="w-full rounded-full bg-gold px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
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
            className="text-xs text-coffee file:ml-2 file:rounded-full file:border file:border-latte file:bg-white file:px-3 file:py-1.5 file:text-xs file:text-coffee disabled:opacity-50"
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
            <div key={run.id} className="overflow-hidden rounded-2xl border border-latte bg-white shadow-sm">
              <button onClick={() => toggleRun(run.id)} className="flex w-full items-center gap-3 p-3 text-right">
                <div className="flex-1">
                  <p className="font-medium text-ink">{programs.find((p) => p.id === run.affiliate_program_id)?.name ?? '—'}</p>
                  <p className="text-xs text-mocha">
                    {run.period_start.slice(0, 10)} → {run.period_end.slice(0, 10)} · {run.provider_code}
                  </p>
                </div>
                <span className="text-xs text-coffee">{run.matched} مطابقة</span>
                {run.amount_mismatch + run.status_mismatch + run.missing_from_provider + run.missing_from_internal > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-700">
                    {run.amount_mismatch + run.status_mismatch + run.missing_from_provider + run.missing_from_internal} اختلاف
                  </span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.className}`}>{meta.label}</span>
                <span className={`text-mocha transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
              </button>

              {expanded && (
                <div className="border-t border-latte bg-paper/50 p-4">
                  {(items[run.id]?.length ?? 0) === 0 ? (
                    <p className="text-xs text-mocha">ما فيه اختلافات -- كل شي مطابق.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {items[run.id]!.map((item) => (
                        <div key={item.id} className="flex items-center justify-between rounded-lg border border-latte bg-white px-3 py-2 text-xs">
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-700">{item.recon_status}</span>
                          <span className="text-mocha">
                            داخلي: {item.internal_amount ?? '—'} · مزوّد: {item.provider_amount ?? '—'}
                          </span>
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
