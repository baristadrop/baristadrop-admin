'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type SupplierRow = {
  id: string;
  name: string;
  country: string;
  website: string;
  is_verified: boolean;
  status: 'pending' | 'approved' | 'rejected';
};

export function SuppliersTab() {
  const [rows, setRows] = useState<SupplierRow[] | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from('suppliers')
      .select('id, name, country, website, is_verified, status')
      .order('name')
      .returns<SupplierRow[]>();
    setRows(data ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const setStatus = async (id: string, status: SupplierRow['status']) => {
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, status } : r)) ?? null);
    await supabase.from('suppliers').update({ status }).eq('id', id);
  };

  const toggleVerified = async (id: string, value: boolean) => {
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, is_verified: value } : r)) ?? null);
    await supabase.from('suppliers').update({ is_verified: value }).eq('id', id);
  };

  if (!rows) return <p className="text-mocha">تحميل...</p>;

  return (
    <div className="overflow-x-auto rounded-2xl border border-latte bg-white">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-latte bg-sand/40 text-mocha">
            <th className="p-3 text-right">الاسم</th>
            <th className="p-3 text-right">الدولة</th>
            <th className="p-3 text-right">الموقع</th>
            <th className="p-3 text-right">موثّق؟</th>
            <th className="p-3 text-right">الحالة</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="border-b border-latte/60">
              <td className="p-3 font-medium text-ink">{s.name}</td>
              <td className="p-3 text-mocha">{s.country}</td>
              <td className="p-3 text-xs text-mocha" dir="ltr">
                <a href={s.website} target="_blank" rel="noreferrer" className="underline">
                  {s.website}
                </a>
              </td>
              <td className="p-3">
                <input
                  type="checkbox"
                  checked={s.is_verified}
                  onChange={(e) => toggleVerified(s.id, e.target.checked)}
                />
              </td>
              <td className="p-3">
                {s.status === 'pending' ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStatus(s.id, 'approved')}
                      className="rounded-full bg-gold px-3 py-1 text-xs font-bold text-white"
                    >
                      قبول
                    </button>
                    <button
                      onClick={() => setStatus(s.id, 'rejected')}
                      className="rounded-full border border-latte px-3 py-1 text-xs text-coffee"
                    >
                      رفض
                    </button>
                  </div>
                ) : (
                  <span
                    className={
                      s.status === 'approved' ? 'text-sm text-gold' : 'text-sm text-stone'
                    }
                  >
                    {s.status === 'approved' ? 'مقبول' : 'مرفوض'}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
