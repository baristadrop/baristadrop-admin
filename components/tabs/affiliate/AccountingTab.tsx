'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/adminApiClient';
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

export function AccountingTab() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<string>('');
  const [balance, setBalance] = useState<CommissionBalance | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch(`${PROGRAMS_API}?limit=100`)
      .then((res) => res.json())
      .then((body) => {
        setPrograms(body.data ?? []);
        if (body.data?.length > 0) setSelectedProgram(body.data[0].id);
      });
  }, []);

  useEffect(() => {
    if (!selectedProgram) return;
    setLoadingBalance(true);
    adminFetch(`${LEDGER_API}?affiliate_program_id=${selectedProgram}&limit=50`)
      .then(async (res) => {
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
