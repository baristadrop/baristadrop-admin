'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type RoasterRow = {
  id: string;
  name: string;
  country: string;
  is_verified: boolean;
  can_edit_links: boolean;
  affiliate_base_url: string | null;
  commission_percent: number | null;
  promo_code: string | null;
};

export function RoastersTab() {
  const [rows, setRows] = useState<RoasterRow[] | null>(null);
  const [clickCounts, setClickCounts] = useState<Record<string, number>>({});

  const load = async () => {
    const [{ data }, { data: clicks }] = await Promise.all([
      supabase
        .from('roasters')
        .select('id, name, country, is_verified, can_edit_links, affiliate_base_url, commission_percent, promo_code')
        .order('name')
        .returns<RoasterRow[]>(),
      supabase.from('affiliate_clicks').select('roaster_id').not('roaster_id', 'is', null),
    ]);
    setRows(data ?? []);
    const counts: Record<string, number> = {};
    for (const c of clicks ?? []) {
      const id = c.roaster_id as string;
      counts[id] = (counts[id] ?? 0) + 1;
    }
    setClickCounts(counts);
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (id: string, field: 'is_verified' | 'can_edit_links', value: boolean) => {
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, [field]: value } : r)) ?? null);
    await supabase.from('roasters').update({ [field]: value }).eq('id', id);
  };

  const saveAffiliate = async (id: string, url: string) => {
    await supabase.from('roasters').update({ affiliate_base_url: url || null }).eq('id', id);
  };

  const saveCommission = async (id: string, value: string) => {
    const num = value.trim() === '' ? null : Number(value);
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, commission_percent: num } : r)) ?? null);
    await supabase.from('roasters').update({ commission_percent: num }).eq('id', id);
  };

  const savePromoCode = async (id: string, code: string) => {
    await supabase.from('roasters').update({ promo_code: code.trim() || null }).eq('id', id);
  };

  if (!rows) return <p className="text-mocha">تحميل...</p>;

  return (
    <div className="overflow-x-auto rounded-2xl border border-latte bg-white">
      <table className="w-full min-w-[980px] text-sm">
        <thead>
          <tr className="border-b border-latte bg-sand/40 text-mocha">
            <th className="p-3 text-right">الاسم</th>
            <th className="p-3 text-right">الدولة</th>
            <th className="p-3 text-right">موثّقة؟</th>
            <th className="p-3 text-right">تقدر تعدّل روابطها؟</th>
            <th className="p-3 text-right">رابط الأفيليت</th>
            <th className="p-3 text-right">نسبتك (%)</th>
            <th className="p-3 text-right">كود الخصم</th>
            <th className="p-3 text-right">ضغطات الشراء</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-latte/60">
              <td className="p-3 font-medium text-ink">{r.name}</td>
              <td className="p-3 text-mocha">{r.country}</td>
              <td className="p-3">
                <input
                  type="checkbox"
                  checked={r.is_verified}
                  onChange={(e) => toggle(r.id, 'is_verified', e.target.checked)}
                />
              </td>
              <td className="p-3">
                <input
                  type="checkbox"
                  checked={r.can_edit_links}
                  onChange={(e) => toggle(r.id, 'can_edit_links', e.target.checked)}
                />
              </td>
              <td className="p-3">
                <input
                  defaultValue={r.affiliate_base_url ?? ''}
                  onBlur={(e) => saveAffiliate(r.id, e.target.value.trim())}
                  placeholder="https://..."
                  dir="ltr"
                  className="w-56 rounded-lg border border-latte bg-paper px-2 py-1 text-xs outline-none focus:border-gold"
                />
              </td>
              <td className="p-3">
                <input
                  defaultValue={r.commission_percent ?? ''}
                  onBlur={(e) => saveCommission(r.id, e.target.value)}
                  placeholder="—"
                  type="number"
                  step="0.5"
                  dir="ltr"
                  className="w-20 rounded-lg border border-latte bg-paper px-2 py-1 text-xs outline-none focus:border-gold"
                />
              </td>
              <td className="p-3">
                <input
                  defaultValue={r.promo_code ?? ''}
                  onBlur={(e) => savePromoCode(r.id, e.target.value.toUpperCase())}
                  placeholder="BARISTADROP10"
                  dir="ltr"
                  className="w-36 rounded-lg border border-latte bg-paper px-2 py-1 text-xs outline-none focus:border-gold"
                />
              </td>
              <td className="p-3 text-center font-bold text-coffee">{clickCounts[r.id] ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
