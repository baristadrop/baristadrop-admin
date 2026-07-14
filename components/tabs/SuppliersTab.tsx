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
  owner_id: string | null;
};

type UserOption = { id: string; email: string | null };

export function SuppliersTab() {
  const [rows, setRows] = useState<SupplierRow[] | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [ownerInput, setOwnerInput] = useState<Record<string, string>>({});
  const [ownerMsg, setOwnerMsg] = useState<Record<string, string>>({});

  const load = async () => {
    const [{ data }, sessionRes] = await Promise.all([
      supabase
        .from('suppliers')
        .select('id, name, country, website, is_verified, status, owner_id')
        .order('name')
        .returns<SupplierRow[]>(),
      supabase.auth.getSession(),
    ]);
    setRows(data ?? []);

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

  const setStatus = async (id: string, status: SupplierRow['status']) => {
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, status } : r)) ?? null);
    await supabase.from('suppliers').update({ status }).eq('id', id);
  };

  const toggleVerified = async (id: string, value: boolean) => {
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, is_verified: value } : r)) ?? null);
    await supabase.from('suppliers').update({ is_verified: value }).eq('id', id);
  };

  const linkOwner = async (supplierId: string) => {
    const email = (ownerInput[supplierId] ?? '').trim().toLowerCase();
    const user = users.find((u) => u.email?.toLowerCase() === email);
    if (!user) {
      setOwnerMsg((prev) => ({ ...prev, [supplierId]: 'ما لقيت حساب بهذا الإيميل' }));
      return;
    }
    await supabase.from('suppliers').update({ owner_id: user.id }).eq('id', supplierId);
    setRows((prev) => prev?.map((r) => (r.id === supplierId ? { ...r, owner_id: user.id } : r)) ?? null);
    setOwnerMsg((prev) => ({ ...prev, [supplierId]: 'تم الربط ✓' }));
  };

  const unlinkOwner = async (supplierId: string) => {
    await supabase.from('suppliers').update({ owner_id: null }).eq('id', supplierId);
    setRows((prev) => prev?.map((r) => (r.id === supplierId ? { ...r, owner_id: null } : r)) ?? null);
  };

  if (!rows) return <p className="text-mocha">تحميل...</p>;

  return (
    <div className="overflow-x-auto rounded-2xl border border-latte bg-white">
      <table className="w-full min-w-[920px] text-sm">
        <thead>
          <tr className="border-b border-latte bg-sand/40 text-mocha">
            <th className="p-3 text-right">الاسم</th>
            <th className="p-3 text-right">الدولة</th>
            <th className="p-3 text-right">الموقع</th>
            <th className="p-3 text-right">موثّق؟</th>
            <th className="p-3 text-right">الحالة</th>
            <th className="p-3 text-right">حساب المورّد (بوابته)</th>
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
              <td className="p-3">
                {s.owner_id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gold">
                      {users.find((u) => u.id === s.owner_id)?.email ?? s.owner_id}
                    </span>
                    <button onClick={() => unlinkOwner(s.id)} className="text-xs text-stone underline">
                      فك الربط
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <input
                      value={ownerInput[s.id] ?? ''}
                      onChange={(e) => setOwnerInput((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      placeholder="إيميل حساب المورّد"
                      dir="ltr"
                      className="w-40 rounded-lg border border-latte bg-paper px-2 py-1 text-xs outline-none focus:border-gold"
                    />
                    <button onClick={() => linkOwner(s.id)} className="rounded-lg bg-ink px-2 py-1 text-xs text-cream">
                      ربط
                    </button>
                  </div>
                )}
                {ownerMsg[s.id] && <p className="mt-1 text-[10px] text-mocha">{ownerMsg[s.id]}</p>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
