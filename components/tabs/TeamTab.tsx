'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  country: string | null;
  created_at: string;
};

const ROLE_OPTIONS = ['user', 'roaster', 'supplier', 'cafe', 'admin'];
const ROLE_SELECT_OPTIONS = ROLE_OPTIONS.map((r) => ({ value: r, label: r }));

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

  if (error) return <p className="text-danger">{error}</p>;
  if (!rows) return <p className="text-mocha">تحميل...</p>;

  const columns: DataTableColumn<UserRow>[] = [
    { key: 'name', header: 'الاسم', render: (u) => u.full_name || '—', sortValue: (u) => u.full_name ?? '' },
    { key: 'email', header: 'الإيميل', render: (u) => <span dir="ltr">{u.email}</span>, sortValue: (u) => u.email ?? '' },
    {
      key: 'role',
      header: 'الصلاحية',
      render: (u) => <Select value={u.role} onChange={(v) => changeRole(u.id, v)} options={ROLE_SELECT_OPTIONS} className="h-8 w-32 text-xs" />,
    },
  ];

  return (
    <div>
      <Card className="mb-6 p-5">
        <form onSubmit={handleCreate}>
          <p className="mb-3 font-[var(--font-el-messiri)] text-base text-ink">إضافة عضو فريق جديد</p>
          {createError && <p className="mb-3 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{createError}</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="الاسم" />
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="الإيميل" type="email" dir="ltr" />
            <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="كلمة المرور" type="password" dir="ltr" />
            <Select value={newRole} onChange={setNewRole} options={ROLE_SELECT_OPTIONS} />
          </div>
          <Button type="submit" disabled={creating || !email.trim() || password.length < 6} className="mt-3">
            {creating ? '...' : 'إضافة'}
          </Button>
        </form>
      </Card>

      <p className="mb-4 text-sm text-mocha">
        كل مستخدم مسجّل بالتطبيق (أو أضفته هنا) يظهر بالجدول. أعطِ أي حساب صلاحية "أدمن" أو "محمصة" أو "مورّد" حسب دوره.
      </p>
      <DataTable columns={columns} data={rows} emptyMessage="ما فيه أعضاء بعد." />
    </div>
  );
}
