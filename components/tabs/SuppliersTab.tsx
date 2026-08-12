'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Toggle } from '@/components/ui/Toggle';
import { Field, SectionTitle } from '@/components/ui/Field';

type SupplierRow = {
  id: string;
  name: string;
  country: string;
  logo_url: string | null;
  trade_license_number: string | null;
  website: string | null;
  is_verified: boolean;
  is_sponsor: boolean;
  is_advertiser: boolean;
  promo_code: string | null;
  discount_label: string | null;
  status: 'pending' | 'approved' | 'rejected';
  owner_id: string | null;
  product_limit: number;
};

type UserOption = { id: string; email: string | null };

const STATUS_META: Record<SupplierRow['status'], { label: string; className: string }> = {
  pending: { label: 'بانتظار المراجعة', className: 'bg-amber-100 text-amber-700' },
  approved: { label: 'مقبول', className: 'bg-green-100 text-green-700' },
  rejected: { label: 'مرفوض', className: 'bg-red-100 text-red-700' },
};

const STATUS_FILTERS: { value: 'all' | SupplierRow['status']; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'pending', label: 'بانتظار المراجعة' },
  { value: 'approved', label: 'مقبول' },
  { value: 'rejected', label: 'مرفوض' },
];

export function SuppliersTab() {
  const [rows, setRows] = useState<SupplierRow[] | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [ownerInput, setOwnerInput] = useState<Record<string, string>>({});
  const [ownerMsg, setOwnerMsg] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SupplierRow['status']>('all');

  const load = async () => {
    const [{ data }, sessionRes] = await Promise.all([
      supabase
        .from('suppliers')
        .select(
          'id, name, country, logo_url, trade_license_number, website, is_verified, is_sponsor, is_advertiser, promo_code, discount_label, status, owner_id, product_limit'
        )
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

  const togglePlacement = async (id: string, field: 'is_sponsor' | 'is_advertiser', value: boolean) => {
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, [field]: value } : r)) ?? null);
    await supabase.from('suppliers').update({ [field]: value }).eq('id', id);
  };

  const saveField = async (id: string, field: 'website' | 'promo_code' | 'discount_label', value: string) => {
    const payload = { [field]: value.trim() || null };
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, ...payload } : r)) ?? null);
    await supabase.from('suppliers').update(payload).eq('id', id);
  };

  const saveLimit = async (id: string, value: string) => {
    const n = Math.max(0, Math.round(Number(value)));
    if (!Number.isFinite(n)) return;
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, product_limit: n } : r)) ?? null);
    await supabase.from('suppliers').update({ product_limit: n }).eq('id', id);
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

  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (search.trim() && !r.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [rows, statusFilter, search]);

  const pendingCount = rows?.filter((r) => r.status === 'pending').length ?? 0;

  if (!rows) return <p className="text-mocha">تحميل...</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث باسم المورّد..."
          className="w-56 rounded-lg border border-latte bg-white px-3 py-1.5 text-sm outline-none focus:border-gold"
        />
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              statusFilter === f.value ? 'border-gold bg-gold text-white' : 'border-latte text-coffee'
            }`}
          >
            {f.label}
          </button>
        ))}
        {pendingCount > 0 && (
          <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
            {pendingCount} بانتظار المراجعة
          </span>
        )}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && <p className="p-6 text-center text-mocha">ما فيه نتائج.</p>}
        {filtered.map((s) => {
          const expanded = expandedId === s.id;
          const meta = STATUS_META[s.status];
          return (
            <div key={s.id} className="overflow-hidden rounded-2xl border border-latte bg-white shadow-sm">
              <button
                onClick={() => setExpandedId(expanded ? null : s.id)}
                className="flex w-full items-center gap-3 p-3 text-right"
              >
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-sand">
                  {s.logo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.logo_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-ink">{s.name}</p>
                  <p className="text-xs text-mocha">{s.country}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {s.is_advertiser && <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] text-white">معلن</span>}
                  {s.is_sponsor && <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] text-white">Sponsor</span>}
                  {s.is_verified && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] text-blue-700">موثّق</span>}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.className}`}>{meta.label}</span>
                </div>
                <span className={`text-mocha transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
              </button>

              {expanded && (
                <div className="grid gap-5 border-t border-latte bg-paper/50 p-4 sm:grid-cols-2">
                  <div>
                    <SectionTitle>الحالة</SectionTitle>
                    {s.status === 'pending' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setStatus(s.id, 'approved')}
                          className="rounded-full bg-gold px-4 py-1.5 text-xs font-bold text-white"
                        >
                          قبول المورّد
                        </button>
                        <button
                          onClick={() => setStatus(s.id, 'rejected')}
                          className="rounded-full border border-latte px-4 py-1.5 text-xs text-coffee"
                        >
                          رفض
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${meta.className}`}>{meta.label}</span>
                        <button
                          onClick={() => setStatus(s.id, s.status === 'approved' ? 'rejected' : 'approved')}
                          className="text-xs text-mocha underline"
                        >
                          تغيير
                        </button>
                      </div>
                    )}
                    <p className="mt-3 text-xs text-mocha">
                      رخصة تجارية: <span dir="ltr">{s.trade_license_number ?? '—'}</span>
                    </p>
                  </div>

                  <div>
                    <SectionTitle>الظهور والترويج</SectionTitle>
                    <Toggle
                      checked={s.is_verified}
                      onChange={(v) => toggleVerified(s.id, v)}
                      label="مورّد موثّق"
                      helper="يظهر شعار التوثيق الأزرق بجانب اسمه بالتطبيق"
                    />
                    <Toggle
                      checked={s.is_sponsor}
                      onChange={(v) => togglePlacement(s.id, 'is_sponsor', v)}
                      label="Sponsor"
                      helper="يطلع فوق باقي الموردين العاديين بالقائمة"
                    />
                    <Toggle
                      checked={s.is_advertiser}
                      onChange={(v) => togglePlacement(s.id, 'is_advertiser', v)}
                      label="إعلان مدفوع"
                      helper="أعلى أولوية بالترتيب، بوسم «إعلان» واضح"
                    />
                  </div>

                  <div>
                    <SectionTitle>المتجر والأفيليت</SectionTitle>
                    <div className="space-y-2">
                      <Field label="رابط الموقع">
                        <input
                          defaultValue={s.website ?? ''}
                          onBlur={(e) => saveField(s.id, 'website', e.target.value)}
                          placeholder="https://..."
                          dir="ltr"
                          className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
                        />
                      </Field>
                      <Field label="كود الخصم للعميل">
                        <input
                          defaultValue={s.promo_code ?? ''}
                          onBlur={(e) => saveField(s.id, 'promo_code', e.target.value.toUpperCase())}
                          placeholder="BARISTADROP10"
                          dir="ltr"
                          className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
                        />
                      </Field>
                      <Field label="نص الخصم" helper="يظهر بجانب زر زيارة المتجر بالتطبيق، مثال: «خصم 15%»">
                        <input
                          defaultValue={s.discount_label ?? ''}
                          onBlur={(e) => saveField(s.id, 'discount_label', e.target.value)}
                          placeholder="خصم 15%"
                          className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
                        />
                      </Field>
                    </div>
                  </div>

                  <div>
                    <SectionTitle>الحد المسموح</SectionTitle>
                    <Field label="عدد المنتجات" helper="الحد الافتراضي 5 للحساب المجاني">
                      <input
                        defaultValue={s.product_limit}
                        onBlur={(e) => saveLimit(s.id, e.target.value)}
                        type="number"
                        min={0}
                        dir="ltr"
                        className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
                      />
                    </Field>
                  </div>

                  <div>
                    <SectionTitle>حساب البوابة</SectionTitle>
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
                          className="flex-1 rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
                        />
                        <button onClick={() => linkOwner(s.id)} className="rounded-lg bg-ink px-3 py-1.5 text-xs text-cream">
                          ربط
                        </button>
                      </div>
                    )}
                    {ownerMsg[s.id] && <p className="mt-1 text-[10px] text-mocha">{ownerMsg[s.id]}</p>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
