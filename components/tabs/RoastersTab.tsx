'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type RoasterRow = {
  id: string;
  name: string;
  country: string;
  is_verified: boolean;
  is_sponsor: boolean;
  is_advertiser: boolean;
  can_edit_links: boolean;
  affiliate_base_url: string | null;
  commission_percent: number | null;
  promo_code: string | null;
  owner_id: string | null;
};

type UserOption = { id: string; email: string | null };

export function RoastersTab() {
  const [rows, setRows] = useState<RoasterRow[] | null>(null);
  const [clickCounts, setClickCounts] = useState<Record<string, number>>({});
  const [users, setUsers] = useState<UserOption[]>([]);
  const [ownerInput, setOwnerInput] = useState<Record<string, string>>({});
  const [ownerMsg, setOwnerMsg] = useState<Record<string, string>>({});

  const load = async () => {
    const [{ data }, { data: clicks }, sessionRes] = await Promise.all([
      supabase
        .from('roasters')
        .select(
          'id, name, country, is_verified, is_sponsor, is_advertiser, can_edit_links, affiliate_base_url, commission_percent, promo_code, owner_id'
        )
        .order('name')
        .returns<RoasterRow[]>(),
      supabase.from('affiliate_clicks').select('roaster_id').not('roaster_id', 'is', null),
      supabase.auth.getSession(),
    ]);
    setRows(data ?? []);
    const counts: Record<string, number> = {};
    for (const c of clicks ?? []) {
      const id = c.roaster_id as string;
      counts[id] = (counts[id] ?? 0) + 1;
    }
    setClickCounts(counts);

    const token = sessionRes.data.session?.access_token;
    const res = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const json = await res.json();
      setUsers(json.users);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (
    id: string,
    field: 'is_verified' | 'is_sponsor' | 'is_advertiser' | 'can_edit_links',
    value: boolean
  ) => {
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

  const linkOwner = async (roasterId: string) => {
    const email = (ownerInput[roasterId] ?? '').trim().toLowerCase();
    const user = users.find((u) => u.email?.toLowerCase() === email);
    if (!user) {
      setOwnerMsg((prev) => ({ ...prev, [roasterId]: 'ما لقيت حساب بهذا الإيميل' }));
      return;
    }
    await supabase.from('roasters').update({ owner_id: user.id }).eq('id', roasterId);
    setRows((prev) => prev?.map((r) => (r.id === roasterId ? { ...r, owner_id: user.id } : r)) ?? null);
    setOwnerMsg((prev) => ({ ...prev, [roasterId]: 'تم الربط ✓' }));
  };

  const unlinkOwner = async (roasterId: string) => {
    await supabase.from('roasters').update({ owner_id: null }).eq('id', roasterId);
    setRows((prev) => prev?.map((r) => (r.id === roasterId ? { ...r, owner_id: null } : r)) ?? null);
  };

  if (!rows) return <p className="text-mocha">تحميل...</p>;

  return (
    <div className="overflow-x-auto rounded-2xl border border-latte bg-white shadow-sm">
      <table className="w-full min-w-[1120px] text-sm">
        <thead>
          <tr className="border-b border-latte bg-sand/40 text-mocha">
            <th className="p-3 text-right">الاسم</th>
            <th className="p-3 text-right">الدولة</th>
            <th className="p-3 text-right">معلن</th>
            <th className="p-3 text-right">Sponsor</th>
            <th className="p-3 text-right">موثّقة؟</th>
            <th className="p-3 text-right">تقدر تعدّل روابطها؟</th>
            <th className="p-3 text-right">رابط الأفيليت</th>
            <th className="p-3 text-right">نسبتك (%)</th>
            <th className="p-3 text-right">كود الخصم</th>
            <th className="p-3 text-right">ضغطات الشراء</th>
            <th className="p-3 text-right">حساب المحمصة (بوابتها)</th>
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
                  checked={r.is_advertiser}
                  onChange={(e) => toggle(r.id, 'is_advertiser', e.target.checked)}
                />
              </td>
              <td className="p-3">
                <input
                  type="checkbox"
                  checked={r.is_sponsor}
                  onChange={(e) => toggle(r.id, 'is_sponsor', e.target.checked)}
                />
              </td>
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
              <td className="p-3">
                {r.owner_id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gold">
                      {users.find((u) => u.id === r.owner_id)?.email ?? r.owner_id}
                    </span>
                    <button
                      onClick={() => unlinkOwner(r.id)}
                      className="text-xs text-stone underline"
                    >
                      فك الربط
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <input
                      value={ownerInput[r.id] ?? ''}
                      onChange={(e) => setOwnerInput((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      placeholder="إيميل حساب المحمصة"
                      dir="ltr"
                      className="w-40 rounded-lg border border-latte bg-paper px-2 py-1 text-xs outline-none focus:border-gold"
                    />
                    <button
                      onClick={() => linkOwner(r.id)}
                      className="rounded-lg bg-ink px-2 py-1 text-xs text-cream"
                    >
                      ربط
                    </button>
                  </div>
                )}
                {ownerMsg[r.id] && <p className="mt-1 text-[10px] text-mocha">{ownerMsg[r.id]}</p>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
