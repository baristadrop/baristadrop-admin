'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Toggle } from '@/components/ui/Toggle';
import { Field, SectionTitle } from '@/components/ui/Field';

type RoasterRow = {
  id: string;
  name: string;
  country: string;
  logo_url: string | null;
  trade_license_number: string | null;
  is_verified: boolean;
  is_sponsor: boolean;
  is_advertiser: boolean;
  can_edit_links: boolean;
  affiliate_base_url: string | null;
  commission_percent: number | null;
  promo_code: string | null;
  discount_label: string | null;
  status: 'pending' | 'approved' | 'rejected';
  owner_id: string | null;
};

type UserOption = { id: string; email: string | null };

const STATUS_META: Record<RoasterRow['status'], { label: string; className: string }> = {
  pending: { label: 'بانتظار المراجعة', className: 'bg-amber-100 text-amber-700' },
  approved: { label: 'مقبولة', className: 'bg-green-100 text-green-700' },
  rejected: { label: 'مرفوضة', className: 'bg-red-100 text-red-700' },
};

const STATUS_FILTERS: { value: 'all' | RoasterRow['status']; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'pending', label: 'بانتظار المراجعة' },
  { value: 'approved', label: 'مقبولة' },
  { value: 'rejected', label: 'مرفوضة' },
];

export function RoastersTab() {
  const [rows, setRows] = useState<RoasterRow[] | null>(null);
  const [clickCounts, setClickCounts] = useState<Record<string, number>>({});
  const [users, setUsers] = useState<UserOption[]>([]);
  const [ownerInput, setOwnerInput] = useState<Record<string, string>>({});
  const [ownerMsg, setOwnerMsg] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RoasterRow['status']>('all');

  const load = async () => {
    const [{ data }, { data: clicks }, sessionRes] = await Promise.all([
      supabase
        .from('roasters')
        .select(
          'id, name, country, logo_url, trade_license_number, is_verified, is_sponsor, is_advertiser, can_edit_links, affiliate_base_url, commission_percent, promo_code, discount_label, status, owner_id'
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

  const setStatus = async (id: string, status: RoasterRow['status']) => {
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, status } : r)) ?? null);
    await supabase.from('roasters').update({ status }).eq('id', id);
  };

  const toggle = async (
    id: string,
    field: 'is_verified' | 'is_sponsor' | 'is_advertiser' | 'can_edit_links',
    value: boolean
  ) => {
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, [field]: value } : r)) ?? null);
    await supabase.from('roasters').update({ [field]: value }).eq('id', id);
  };

  const saveField = async (
    id: string,
    field: 'affiliate_base_url' | 'commission_percent' | 'promo_code' | 'discount_label',
    value: string
  ) => {
    const payload =
      field === 'commission_percent'
        ? { commission_percent: value.trim() === '' ? null : Number(value) }
        : { [field]: value.trim() || null };
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, ...payload } : r)) ?? null);
    await supabase.from('roasters').update(payload).eq('id', id);
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
          placeholder="ابحث باسم المحمصة..."
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
        {filtered.map((r) => {
          const expanded = expandedId === r.id;
          const meta = STATUS_META[r.status];
          return (
            <div key={r.id} className="overflow-hidden rounded-2xl border border-latte bg-white shadow-sm">
              <button
                onClick={() => setExpandedId(expanded ? null : r.id)}
                className="flex w-full items-center gap-3 p-3 text-right"
              >
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-sand">
                  {r.logo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.logo_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-ink">{r.name}</p>
                  <p className="text-xs text-mocha">{r.country}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {r.is_advertiser && <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] text-white">معلن</span>}
                  {r.is_sponsor && <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] text-white">Sponsor</span>}
                  {r.is_verified && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] text-blue-700">موثّقة</span>}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.className}`}>{meta.label}</span>
                </div>
                <span className={`text-mocha transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
              </button>

              {expanded && (
                <div className="grid gap-5 border-t border-latte bg-paper/50 p-4 sm:grid-cols-2">
                  <div>
                    <SectionTitle>الحالة</SectionTitle>
                    {r.status === 'pending' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setStatus(r.id, 'approved')}
                          className="rounded-full bg-gold px-4 py-1.5 text-xs font-bold text-white"
                        >
                          قبول المحمصة
                        </button>
                        <button
                          onClick={() => setStatus(r.id, 'rejected')}
                          className="rounded-full border border-latte px-4 py-1.5 text-xs text-coffee"
                        >
                          رفض
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${meta.className}`}>{meta.label}</span>
                        <button
                          onClick={() => setStatus(r.id, r.status === 'approved' ? 'rejected' : 'approved')}
                          className="text-xs text-mocha underline"
                        >
                          تغيير
                        </button>
                      </div>
                    )}
                    <p className="mt-3 text-xs text-mocha">
                      رخصة تجارية: <span dir="ltr">{r.trade_license_number ?? '—'}</span>
                    </p>
                  </div>

                  <div>
                    <SectionTitle>الظهور والترويج</SectionTitle>
                    <Toggle
                      checked={r.is_verified}
                      onChange={(v) => toggle(r.id, 'is_verified', v)}
                      label="محمصة موثّقة"
                      helper="يظهر شعار التوثيق الأزرق بجانب اسمها بالتطبيق"
                    />
                    <Toggle
                      checked={r.is_sponsor}
                      onChange={(v) => toggle(r.id, 'is_sponsor', v)}
                      label="Sponsor"
                      helper="تطلع فوق باقي المحامص العادية بالقوائم"
                    />
                    <Toggle
                      checked={r.is_advertiser}
                      onChange={(v) => toggle(r.id, 'is_advertiser', v)}
                      label="إعلان مدفوع"
                      helper="أعلى أولوية بالترتيب، بوسم «إعلان» واضح"
                    />
                  </div>

                  <div>
                    <SectionTitle>الأفيليت والعمولة</SectionTitle>
                    <div className="space-y-2">
                      <Toggle
                        checked={r.can_edit_links}
                        onChange={(v) => toggle(r.id, 'can_edit_links', v)}
                        label="فعّل زر الشراء"
                        helper="بدونه ما يظهر أي رابط شراء لمحاصيلها بالتطبيق"
                      />
                      <Field label="رابط الأفيليت">
                        <input
                          defaultValue={r.affiliate_base_url ?? ''}
                          onBlur={(e) => saveField(r.id, 'affiliate_base_url', e.target.value)}
                          placeholder="https://..."
                          dir="ltr"
                          className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
                        />
                      </Field>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="نسبتك (%)">
                          <input
                            defaultValue={r.commission_percent ?? ''}
                            onBlur={(e) => saveField(r.id, 'commission_percent', e.target.value)}
                            placeholder="—"
                            type="number"
                            step="0.5"
                            dir="ltr"
                            className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
                          />
                        </Field>
                        <Field label="ضغطات الشراء">
                          <p className="rounded-lg border border-latte bg-white px-2 py-1.5 text-center text-xs font-bold text-coffee">
                            {clickCounts[r.id] ?? 0}
                          </p>
                        </Field>
                      </div>
                      <Field label="كود الخصم للعميل">
                        <input
                          defaultValue={r.promo_code ?? ''}
                          onBlur={(e) => saveField(r.id, 'promo_code', e.target.value.toUpperCase())}
                          placeholder="BARISTADROP10"
                          dir="ltr"
                          className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
                        />
                      </Field>
                      <Field label="نص الخصم" helper="يظهر بجانب زر الشراء بالتطبيق، مثال: «خصم 15%»">
                        <input
                          defaultValue={r.discount_label ?? ''}
                          onBlur={(e) => saveField(r.id, 'discount_label', e.target.value)}
                          placeholder="خصم 15%"
                          className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
                        />
                      </Field>
                    </div>
                  </div>

                  <div>
                    <SectionTitle>حساب البوابة</SectionTitle>
                    {r.owner_id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gold">
                          {users.find((u) => u.id === r.owner_id)?.email ?? r.owner_id}
                        </span>
                        <button onClick={() => unlinkOwner(r.id)} className="text-xs text-stone underline">
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
                          className="flex-1 rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
                        />
                        <button onClick={() => linkOwner(r.id)} className="rounded-lg bg-ink px-3 py-1.5 text-xs text-cream">
                          ربط
                        </button>
                      </div>
                    )}
                    {ownerMsg[r.id] && <p className="mt-1 text-[10px] text-mocha">{ownerMsg[r.id]}</p>}
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
