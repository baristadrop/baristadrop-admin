'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type CafeRow = {
  id: string;
  name: string;
  country: string;
  location: string | null;
  supplying_roaster_id: string | null;
  is_verified: boolean;
  is_sponsor: boolean;
  is_advertiser: boolean;
  status: 'pending' | 'approved' | 'rejected';
  owner_id: string | null;
};

type UserOption = { id: string; email: string | null };
type RoasterOption = { id: string; name: string };

export function CafesTab() {
  const [rows, setRows] = useState<CafeRow[] | null>(null);
  const [roasters, setRoasters] = useState<RoasterOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [ownerInput, setOwnerInput] = useState<Record<string, string>>({});
  const [ownerMsg, setOwnerMsg] = useState<Record<string, string>>({});

  const load = async () => {
    const [{ data }, { data: roasterRows }, sessionRes] = await Promise.all([
      supabase
        .from('cafes')
        .select('id, name, country, location, supplying_roaster_id, is_verified, is_sponsor, is_advertiser, status, owner_id')
        .order('name')
        .returns<CafeRow[]>(),
      supabase.from('roasters').select('id, name').order('name'),
      supabase.auth.getSession(),
    ]);
    setRows(data ?? []);
    setRoasters(roasterRows ?? []);

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

  const setStatus = async (id: string, status: CafeRow['status']) => {
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, status } : r)) ?? null);
    await supabase.from('cafes').update({ status }).eq('id', id);
  };

  const toggle = async (
    id: string,
    field: 'is_verified' | 'is_sponsor' | 'is_advertiser',
    value: boolean
  ) => {
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, [field]: value } : r)) ?? null);
    await supabase.from('cafes').update({ [field]: value }).eq('id', id);
  };

  const setSupplyingRoaster = async (id: string, roasterId: string) => {
    const value = roasterId || null;
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, supplying_roaster_id: value } : r)) ?? null);
    await supabase.from('cafes').update({ supplying_roaster_id: value }).eq('id', id);
  };

  const linkOwner = async (cafeId: string) => {
    const email = (ownerInput[cafeId] ?? '').trim().toLowerCase();
    const user = users.find((u) => u.email?.toLowerCase() === email);
    if (!user) {
      setOwnerMsg((prev) => ({ ...prev, [cafeId]: 'ما لقيت حساب بهذا الإيميل' }));
      return;
    }
    await supabase.from('cafes').update({ owner_id: user.id }).eq('id', cafeId);
    setRows((prev) => prev?.map((r) => (r.id === cafeId ? { ...r, owner_id: user.id } : r)) ?? null);
    setOwnerMsg((prev) => ({ ...prev, [cafeId]: 'تم الربط ✓' }));
  };

  const unlinkOwner = async (cafeId: string) => {
    await supabase.from('cafes').update({ owner_id: null }).eq('id', cafeId);
    setRows((prev) => prev?.map((r) => (r.id === cafeId ? { ...r, owner_id: null } : r)) ?? null);
  };

  if (!rows) return <p className="text-mocha">تحميل...</p>;

  return (
    <div className="overflow-x-auto rounded-2xl border border-latte bg-white">
      <table className="w-full min-w-[1180px] text-sm">
        <thead>
          <tr className="border-b border-latte bg-sand/40 text-mocha">
            <th className="p-3 text-right">الاسم</th>
            <th className="p-3 text-right">الدولة</th>
            <th className="p-3 text-right">تورّده محمصة</th>
            <th className="p-3 text-right">معلن</th>
            <th className="p-3 text-right">Sponsor</th>
            <th className="p-3 text-right">موثّق؟</th>
            <th className="p-3 text-right">الحالة</th>
            <th className="p-3 text-right">حساب الكوفي (بوابته)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-b border-latte/60">
              <td className="p-3 font-medium text-ink">{c.name}</td>
              <td className="p-3 text-mocha">{c.country}</td>
              <td className="p-3">
                <select
                  value={c.supplying_roaster_id ?? ''}
                  onChange={(e) => setSupplyingRoaster(c.id, e.target.value)}
                  className="w-40 rounded-lg border border-latte bg-paper px-2 py-1 text-xs outline-none focus:border-gold"
                >
                  <option value="">— بدون —</option>
                  {roasters.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="p-3">
                <input
                  type="checkbox"
                  checked={c.is_advertiser}
                  onChange={(e) => toggle(c.id, 'is_advertiser', e.target.checked)}
                />
              </td>
              <td className="p-3">
                <input
                  type="checkbox"
                  checked={c.is_sponsor}
                  onChange={(e) => toggle(c.id, 'is_sponsor', e.target.checked)}
                />
              </td>
              <td className="p-3">
                <input
                  type="checkbox"
                  checked={c.is_verified}
                  onChange={(e) => toggle(c.id, 'is_verified', e.target.checked)}
                />
              </td>
              <td className="p-3">
                {c.status === 'pending' ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStatus(c.id, 'approved')}
                      className="rounded-full bg-gold px-3 py-1 text-xs font-bold text-white"
                    >
                      قبول
                    </button>
                    <button
                      onClick={() => setStatus(c.id, 'rejected')}
                      className="rounded-full border border-latte px-3 py-1 text-xs text-coffee"
                    >
                      رفض
                    </button>
                  </div>
                ) : (
                  <span className={c.status === 'approved' ? 'text-sm text-gold' : 'text-sm text-stone'}>
                    {c.status === 'approved' ? 'مقبول' : 'مرفوض'}
                  </span>
                )}
              </td>
              <td className="p-3">
                {c.owner_id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gold">
                      {users.find((u) => u.id === c.owner_id)?.email ?? c.owner_id}
                    </span>
                    <button onClick={() => unlinkOwner(c.id)} className="text-xs text-stone underline">
                      فك الربط
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <input
                      value={ownerInput[c.id] ?? ''}
                      onChange={(e) => setOwnerInput((prev) => ({ ...prev, [c.id]: e.target.value }))}
                      placeholder="إيميل حساب الكوفي"
                      dir="ltr"
                      className="w-40 rounded-lg border border-latte bg-paper px-2 py-1 text-xs outline-none focus:border-gold"
                    />
                    <button onClick={() => linkOwner(c.id)} className="rounded-lg bg-ink px-2 py-1 text-xs text-cream">
                      ربط
                    </button>
                  </div>
                )}
                {ownerMsg[c.id] && <p className="mt-1 text-[10px] text-mocha">{ownerMsg[c.id]}</p>}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="p-6 text-center text-mocha">
                ما فيه كوفي شوب مضاف بعد.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
