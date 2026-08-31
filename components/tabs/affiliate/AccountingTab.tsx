'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch, adminFetchJson } from '@/lib/adminApiClient';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import type { CommissionBalance } from '@/lib/affiliate/types';

const PROGRAMS_API = '/api/admin/affiliate/programs';
const LEDGER_API = '/api/admin/affiliate/ledger';

type Program = { id: string; name: string; currency: string };
type LedgerEntry = {
  id: string;
  affiliate_program_id: string;
  event_type: string;
  amount: number;
  currency: string;
  reference: string | null;
  accounting_date: string;
};

function BalanceCard({ label, value, currency, tone }: { label: string; value: number; currency: string; tone: 'neutral' | 'gold' | 'red' }) {
  const toneClass = tone === 'gold' ? 'text-gold' : tone === 'red' ? 'text-red-600' : 'text-coffee';
  return (
    <div className="rounded-xl border border-latte bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-mocha">{label}</p>
      <p className={`mt-1 font-[var(--font-el-messiri)] text-xl font-bold tabular-nums ${toneClass}`}>
        {value.toFixed(2)} {currency}
      </p>
    </div>
  );
}

const emptyAdj = { direction: 'credit' as 'credit' | 'debit', amount: '', reference: '' };

export function AccountingTab() {
  const { toast } = useToast();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<string>('');
  const [balance, setBalance] = useState<CommissionBalance | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // G-08: قيد يدوي
  const [showAdd, setShowAdd] = useState(false);
  const [adj, setAdj] = useState(emptyAdj);
  const [savingAdj, setSavingAdj] = useState(false);

  const program = programs.find((p) => p.id === selectedProgram);

  useEffect(() => {
    adminFetch(`${PROGRAMS_API}?limit=100`)
      .then((res) => res.json())
      .then((body) => {
        setPrograms(body.data ?? []);
        if (body.data?.length > 0) setSelectedProgram(body.data[0].id);
      });
  }, []);

  const loadLedger = useCallback(() => {
    if (!selectedProgram) return;
    setLoadingBalance(true);
    adminFetch(`${LEDGER_API}?affiliate_program_id=${selectedProgram}&limit=50`).then(async (res) => {
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setBalance(body.balance ?? null);
        setLedger(body.data ?? []);
      } else {
        setError(body.error ?? 'فشل تحميل دفتر الأستاذ');
      }
      setLoadingBalance(false);
    });
  }, [selectedProgram]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  const addEntry = async () => {
    const amount = Number(adj.amount);
    if (!selectedProgram || !Number.isFinite(amount) || amount <= 0) return;
    setSavingAdj(true);
    setError(null);
    const res = await adminFetchJson(LEDGER_API, {
      method: 'POST',
      body: JSON.stringify({
        affiliate_program_id: selectedProgram,
        direction: adj.direction,
        amount,
        currency: program?.currency ?? 'AED',
        reference: adj.reference.trim() || null,
      }),
    });
    setSavingAdj(false);
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setAdj(emptyAdj);
      setShowAdd(false);
      toast({ title: 'تم إضافة القيد', variant: 'success' });
      loadLedger();
    } else {
      toast({ title: 'فشل إضافة القيد', description: body.error, variant: 'destructive' });
    }
  };

  if (programs.length === 0) {
    return <p className="text-mocha">ما فيه برامج أفيليت بعد -- أنشئ برنامج من تبويب "البرامج" أول.</p>;
  }

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
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selectedProgram}
          onChange={(e) => setSelectedProgram(e.target.value)}
          className="rounded-lg border border-latte bg-white px-3 py-1.5 text-sm outline-none focus:border-gold"
        >
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? 'إلغاء' : 'إضافة قيد يدوي'}
        </Button>
      </div>

      {showAdd && (
        <div className="grid gap-3 rounded-2xl border border-gold/40 bg-sand/40 p-4 sm:grid-cols-3">
          <Field label="اتجاه القيد">
            <select
              value={adj.direction}
              onChange={(e) => setAdj((f) => ({ ...f, direction: e.target.value as 'credit' | 'debit' }))}
              className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
            >
              <option value="credit">رصيد (إضافة +)</option>
              <option value="debit">خصم (سحب −)</option>
            </select>
          </Field>
          <Field label="المبلغ" helper={`بعملة البرنامج (${program?.currency ?? 'AED'})`}>
            <Input
              type="number"
              step="0.01"
              dir="ltr"
              value={adj.amount}
              onChange={(e) => setAdj((f) => ({ ...f, amount: e.target.value }))}
              className="h-8 text-xs"
            />
          </Field>
          <Field label="الوصف">
            <Input value={adj.reference} onChange={(e) => setAdj((f) => ({ ...f, reference: e.target.value }))} className="h-8 text-xs" placeholder="تسوية / مكافأة / خصم..." />
          </Field>
          <div className="sm:col-span-3">
            <Button size="sm" onClick={addEntry} disabled={savingAdj || !adj.amount || Number(adj.amount) <= 0}>
              {savingAdj ? 'جاري الحفظ...' : 'إضافة القيد'}
            </Button>
          </div>
        </div>
      )}

      {loadingBalance ? (
        <p className="text-mocha">تحميل...</p>
      ) : balance ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <BalanceCard label="متوقّعة" value={balance.expected} currency={balance.currency} tone="neutral" />
          <BalanceCard label="معكوسة/مرفوضة" value={balance.reversed} currency={balance.currency} tone="red" />
          <BalanceCard label="مدفوعة" value={balance.paid} currency={balance.currency} tone="gold" />
          <BalanceCard label="الرصيد المستحق" value={balance.outstanding} currency={balance.currency} tone="gold" />
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-latte bg-white shadow-sm">
        <table className="w-full min-w-[600px] text-right text-sm">
          <thead className="bg-sand/60 text-[11px] uppercase tracking-wide text-mocha">
            <tr>
              <th className="px-3 py-2">النوع</th>
              <th className="px-3 py-2">المبلغ</th>
              <th className="px-3 py-2">التاريخ</th>
              <th className="px-3 py-2">الوصف</th>
            </tr>
          </thead>
          <tbody>
            {ledger.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-mocha">
                  ما فيه قيود بدفتر الأستاذ بعد.
                </td>
              </tr>
            )}
            {ledger.map((entry) => (
              <tr key={entry.id} className="border-t border-latte">
                <td className="px-3 py-2 text-xs text-coffee">{entry.event_type}</td>
                <td className={`px-3 py-2 font-[var(--font-el-messiri)] tabular-nums ${entry.amount < 0 ? 'text-red-600' : 'text-gold'}`}>
                  {entry.amount.toFixed(2)} {entry.currency}
                </td>
                <td className="px-3 py-2 text-[11px] text-stone">{entry.accounting_date}</td>
                <td className="px-3 py-2 text-xs text-mocha">{entry.reference ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
