'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  country: string | null;
  created_at: string;
};

const ROLE_OPTIONS = ['user', 'roaster', 'supplier', 'cafe', 'admin'];

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${data.session?.access_token}` };
}

export function TeamTab() {
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newRole, setNewRole] = useState('admin');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch('/api/admin/users', { headers: await authHeader() });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? 'خطأ');
      return;
    }
    setRows(json.users);
  };

  useEffect(() => {
    load();
  }, []);

  const changeRole = async (userId: string, role: string) => {
    setRows((prev) => prev?.map((r) => (r.id === userId ? { ...r, role } : r)) ?? null);
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({ userId, role }),
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({ email: email.trim(), password, fullName: fullName.trim(), role: newRole }),
    });
    const json = await res.json();
    if (!res.ok) {
      setCreateError(json.error ?? 'خطأ');
    } else {
      setFullName('');
      setEmail('');
      setPassword('');
      setNewRole('admin');
      load();
    }
    setCreating(false);
  };

  if (error) return <p className="text-[#B3392C]">{error}</p>;
  if (!rows) return <p className="text-mocha">تحميل...</p>;

  return (
    <div>
      <form
        onSubmit={handleCreate}
        className="mb-6 rounded-2xl border border-latte bg-white p-5"
      >
        <p className="mb-3 font-[var(--font-el-messiri)] text-base text-ink">إضافة عضو فريق جديد</p>
        {createError && <p className="mb-3 rounded-lg bg-sand px-3 py-2 text-sm text-[#B3392C]">{createError}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="الاسم"
            className="rounded-lg border border-latte bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="الإيميل"
            type="email"
            dir="ltr"
            className="rounded-lg border border-latte bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="كلمة المرور"
            type="password"
            dir="ltr"
            className="rounded-lg border border-latte bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            className="rounded-lg border border-latte bg-paper px-3 py-2 text-sm"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={creating || !email.trim() || password.length < 6}
          className="mt-3 rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-cream disabled:opacity-50"
        >
          {creating ? '...' : 'إضافة'}
        </button>
      </form>

      <p className="mb-4 text-sm text-mocha">
        كل مستخدم مسجّل بالتطبيق (أو أضفته هنا) يظهر بالجدول. أعطِ أي حساب صلاحية "أدمن" أو "محمصة" أو "مورّد" حسب دوره.
      </p>
      <div className="overflow-x-auto rounded-2xl border border-latte bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-latte bg-sand/40 text-mocha">
              <th className="p-3 text-right">الاسم</th>
              <th className="p-3 text-right">الإيميل</th>
              <th className="p-3 text-right">الصلاحية</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-b border-latte/60">
                <td className="p-3 font-medium text-ink">{u.full_name || '—'}</td>
                <td className="p-3 text-xs text-mocha" dir="ltr">
                  {u.email}
                </td>
                <td className="p-3">
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                    className="rounded-lg border border-latte bg-paper px-2 py-1 text-xs"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
