'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Toggle } from '@/components/ui/Toggle';
import { Field, SectionTitle } from '@/components/ui/Field';

type CafeRow = {
  id: string;
  name: string;
  country: string;
  logo_url: string | null;
  trade_license_number: string | null;
  location: string | null;
  supplying_roaster_id: string | null;
  is_verified: boolean;
  is_sponsor: boolean;
  is_advertiser: boolean;
  can_edit_links: boolean;
  affiliate_base_url: string | null;
  promo_code: string | null;
  discount_label: string | null;
  status: 'pending' | 'approved' | 'rejected';
  owner_id: string | null;
};

type UserOption = { id: string; email: string | null };
type RoasterOption = { id: string; name: string };

const STATUS_META: Record<CafeRow['status'], { label: string; className: string }> = {
  pending: { label: 'بانتظار المراجعة', className: 'bg-amber-100 text-amber-700' },
  approved: { label: 'مقبول', className: 'bg-green-100 text-green-700' },
  rejected: { label: 'مرفوض', className: 'bg-red-100 text-red-700' },
};

const STATUS_FILTERS: { value: 'all' | CafeRow['status']; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'pending', label: 'بانتظار المراجعة' },
  { value: 'approved', label: 'مقبول' },
  { value: 'rejected', label: 'مرفوض' },
];

export function CafesTab() {
  const [rows, setRows] = useState<CafeRow[] | null>(null);
  const [roasters, setRoasters] = useState<RoasterOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [ownerInput, setOwnerInput] = useState<Record<string, string>>({});
  const [ownerMsg, setOwnerMsg] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CafeRow['status']>('all');

  const load = async () => {
    const [{ data }, { data: roasterRows }, sessionRes] = await Promise.all([
      supabase
        .from('cafes')
        .select(
          'id, name, country, logo_url, trade_license_number, location, supplying_roaster_id, is_verified, is_sponsor, is_advertiser, can_edit_links, affiliate_base_url, promo_code, discount_label, status, owner_id'
        )
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
    field: 'is_verified' | 'is_sponsor' | 'is_advertiser' | 'can_edit_links',
    value: boolean
  ) => {
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, [field]: value } : r)) ?? null);
    await supabase.from('cafes').update({ [field]: value }).eq('id', id);
  };

  const saveField = async (
    id: string,
    field: 'location' | 'affiliate_base_url' | 'promo_code' | 'discount_label',
    value: string
  ) => {
    const payload = { [field]: value.trim() || null };
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, ...payload } : r)) ?? null);
    await supabase.from('cafes').update(payload).eq('id', id);
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
          placeholder="ابحث باسم الكوفي شوب..."
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
        {filtered.map((c) => {
          const expanded = expandedId === c.id;
          const meta = STATUS_META[c.status];
          return (
            <div key={c.id} className="overflow-hidden rounded-2xl border border-latte bg-white shadow-sm">
              <button
                onClick={() => setExpandedId(expanded ? null : c.id)}
                className="flex w-full items-center gap-3 p-3 text-right"
              >
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-sand">
                  {c.logo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.logo_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-ink">{c.name}</p>
                  <p className="text-xs text-mocha">{c.country}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {c.is_advertiser && <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] text-white">معلن</span>}
                  {c.is_sponsor && <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] text-white">Sponsor</span>}
                  {c.is_verified && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] text-blue-700">موثّق</span>}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.className}`}>{meta.label}</span>
                </div>
                <span className={`text-mocha transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
              </button>

              {expanded && (
                <div className="grid gap-5 border-t border-latte bg-paper/50 p-4 sm:grid-cols-2">
                  <div>
                    <SectionTitle>الحالة</SectionTitle>
                    {c.status === 'pending' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setStatus(c.id, 'approved')}
                          className="rounded-full bg-gold px-4 py-1.5 text-xs font-bold text-white"
                        >
                          قبول الكوفي شوب
                        </button>
                        <button
                          onClick={() => setStatus(c.id, 'rejected')}
                          className="rounded-full border border-latte px-4 py-1.5 text-xs text-coffee"
                        >
                          رفض
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${meta.className}`}>{meta.label}</span>
                        <button
                          onClick={() => setStatus(c.id, c.status === 'approved' ? 'rejected' : 'approved')}
                          className="text-xs text-mocha underline"
                        >
                          تغيير
                        </button>
                      </div>
                    )}
                    <p className="mt-3 text-xs text-mocha">
                      رخصة تجارية: <span dir="ltr">{c.trade_license_number ?? '—'}</span>
                    </p>
                    <div className="mt-3">
                      <Field label="العنوان/الموقع">
                        <input
                          defaultValue={c.location ?? ''}
                          onBlur={(e) => saveField(c.id, 'location', e.target.value)}
                          placeholder="مثال: دبي، الجميرا"
                          className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
                        />
                      </Field>
                    </div>
                    <div className="mt-3">
                      <Field label="تورّده محمصة" helper="يحدد أي محاصيل تقدر تختارها بمنيوها">
                        <select
                          value={c.supplying_roaster_id ?? ''}
                          onChange={(e) => setSupplyingRoaster(c.id, e.target.value)}
                          className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
                        >
                          <option value="">— بدون —</option>
                          {roasters.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  </div>

                  <div>
                    <SectionTitle>الظهور والترويج</SectionTitle>
                    <Toggle
                      checked={c.is_verified}
                      onChange={(v) => toggle(c.id, 'is_verified', v)}
                      label="كوفي شوب موثّق"
                      helper="يظهر شعار التوثيق الأزرق بجانب اسمه بالتطبيق"
                    />
                    <Toggle
                      checked={c.is_sponsor}
                      onChange={(v) => toggle(c.id, 'is_sponsor', v)}
                      label="Sponsor"
                      helper="يطلع فوق باقي الكوفي شوبات العادية بالقائمة"
                    />
                    <Toggle
                      checked={c.is_advertiser}
                      onChange={(v) => toggle(c.id, 'is_advertiser', v)}
                      label="إعلان مدفوع"
                      helper="أعلى أولوية بالترتيب، بوسم «إعلان» واضح"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <SectionTitle>الأفيليت والخصم</SectionTitle>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Toggle
                        checked={c.can_edit_links}
                        onChange={(v) => toggle(c.id, 'can_edit_links', v)}
                        label="فعّل زر الزيارة"
                        helper="بدونه ما يظهر أي رابط زيارة لصفحته بالتطبيق"
                      />
                      <Field label="رابط الأفيليت">
                        <input
                          defaultValue={c.affiliate_base_url ?? ''}
                          onBlur={(e) => saveField(c.id, 'affiliate_base_url', e.target.value)}
                          placeholder="https://..."
                          dir="ltr"
                          className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
                        />
                      </Field>
                      <Field label="كود الخصم للعميل">
                        <input
                          defaultValue={c.promo_code ?? ''}
                          onBlur={(e) => saveField(c.id, 'promo_code', e.target.value.toUpperCase())}
                          placeholder="BARISTADROP10"
                          dir="ltr"
                          className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
                        />
                      </Field>
                      <Field label="نص الخصم" helper="يظهر بجانب زر الزيارة بالتطبيق، مثال: «خصم 15%»">
                        <input
                          defaultValue={c.discount_label ?? ''}
                          onBlur={(e) => saveField(c.id, 'discount_label', e.target.value)}
                          placeholder="خصم 15%"
                          className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
                        />
                      </Field>
                    </div>
                  </div>

                  <div>
                    <SectionTitle>حساب البوابة</SectionTitle>
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
                          className="flex-1 rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
                        />
                        <button onClick={() => linkOwner(c.id)} className="rounded-lg bg-ink px-3 py-1.5 text-xs text-cream">
                          ربط
                        </button>
                      </div>
                    )}
                    {ownerMsg[c.id] && <p className="mt-1 text-[10px] text-mocha">{ownerMsg[c.id]}</p>}
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
