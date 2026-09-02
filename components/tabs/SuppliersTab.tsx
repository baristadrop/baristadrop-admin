'use client';

import { StatCardSkeletonGrid } from '@/components/ui/Skeleton';
import { memo, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Toggle } from '@/components/ui/Toggle';
import { Field, SectionTitle } from '@/components/ui/Field';
import { InfoTip } from '@/components/ui/InfoTip';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterBar } from '@/components/ui/FilterBar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

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
  commission_percent: number | null;
  promo_code: string | null;
  discount_label: string | null;
  status: 'pending' | 'approved' | 'rejected';
  owner_id: string | null;
  product_limit: number;
  categories: string[];
  postback_secret: string;
};

type SupplierStats = { clicks: number; confirmedPurchases: number; grossRevenue: number; commissionOwed: number };
const EMPTY_STATS: SupplierStats = { clicks: 0, confirmedPurchases: 0, grossRevenue: 0, commissionOwed: 0 };

const PERIOD_FILTERS: { value: 'all' | 'month'; label: string }[] = [
  { value: 'all', label: 'كل الوقت' },
  { value: 'month', label: 'هذا الشهر' },
];

function periodSince(period: 'all' | 'month'): string | undefined {
  if (period !== 'month') return undefined;
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

const WEBHOOK_BASE_URL = 'https://admin.baristadrop.com/api/webhooks/affiliate-purchase';

type UserOption = { id: string; email: string | null };

/** فئات ثابتة (مو نص حر) عشان تطابق دايماً صور الخلفية حسب الفئة بالتطبيق
 * (supplierCategoryPhotos.ts) -- نفس الأسماء بالضبط. */
export const SUPPLIER_CATEGORIES = [
  'مكائن اسبريسو',
  'مكائن منزلية',
  'مكائن بيع ذاتي',
  'مطاحن',
  'أدوات V60',
  'أدوات القهوة',
  'حبوب قهوة',
  'كبسولات',
] as const;

const STATUS_META: Record<SupplierRow['status'], { label: string; badge: 'warning' | 'success' | 'danger' }> = {
  pending: { label: 'بانتظار المراجعة', badge: 'warning' },
  approved: { label: 'مقبول', badge: 'success' },
  rejected: { label: 'مرفوض', badge: 'danger' },
};

const STATUS_FILTERS: { value: 'all' | SupplierRow['status']; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'pending', label: 'بانتظار المراجعة' },
  { value: 'approved', label: 'مقبول' },
  { value: 'rejected', label: 'مرفوض' },
];

function SuppliersTabImpl() {
  const [rows, setRows] = useState<SupplierRow[] | null>(null);
  const [stats, setStats] = useState<Record<string, SupplierStats>>({});
  const [period, setPeriod] = useState<'all' | 'month'>('all');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [ownerInput, setOwnerInput] = useState<Record<string, string>>({});
  const [ownerMsg, setOwnerMsg] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SupplierRow['status']>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = async () => {
    const [{ data }, { data: statsRows }, sessionRes] = await Promise.all([
      supabase
        .from('suppliers')
        .select(
          'id, name, country, logo_url, trade_license_number, website, is_verified, is_sponsor, is_advertiser, commission_percent, promo_code, discount_label, status, owner_id, product_limit, categories, postback_secret'
        )
        .order('name')
        .returns<SupplierRow[]>(),
      supabase.rpc('get_affiliate_business_stats', { p_since: periodSince(period) ?? null }),
      supabase.auth.getSession(),
    ]);
    setRows(data ?? []);
    const nextStats: Record<string, SupplierStats> = {};
    for (const s of (statsRows as {
      business_type: string; business_id: string; clicks: number;
      confirmed_purchases: number; gross_revenue: number; commission_owed: number;
    }[]) ?? []) {
      if (s.business_type !== 'supplier') continue;
      nextStats[s.business_id] = {
        clicks: s.clicks,
        confirmedPurchases: s.confirmed_purchases,
        grossRevenue: s.gross_revenue,
        commissionOwed: s.commission_owed,
      };
    }
    setStats(nextStats);

    const token = sessionRes.data.session?.access_token;
    const res = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const json = await res.json();
      setUsers(json.users);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const rotatePostbackSecret = async (id: string) => {
    const newSecret = crypto.randomUUID();
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, postback_secret: newSecret } : r)) ?? null);
    await supabase.from('suppliers').update({ postback_secret: newSecret }).eq('id', id);
  };

  const copyWebhookUrl = (id: string, secret: string) => {
    navigator.clipboard.writeText(`${WEBHOOK_BASE_URL}?token=${secret}`).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((v) => (v === id ? null : v)), 1500);
    });
  };

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

  const saveField = async (
    id: string,
    field: 'website' | 'promo_code' | 'discount_label' | 'commission_percent',
    value: string
  ) => {
    const payload =
      field === 'commission_percent'
        ? { commission_percent: value.trim() === '' ? null : Number(value) }
        : { [field]: value.trim() || null };
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, ...payload } : r)) ?? null);
    await supabase.from('suppliers').update(payload).eq('id', id);
  };

  const toggleCategory = async (id: string, category: string) => {
    const current = rows?.find((r) => r.id === id)?.categories ?? [];
    const next = current.includes(category) ? current.filter((c) => c !== category) : [...current, category];
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, categories: next } : r)) ?? null);
    await supabase.from('suppliers').update({ categories: next }).eq('id', id);
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

  if (!rows) return <StatCardSkeletonGrid />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="ابحث باسم المورّد..." className="w-56" />
        <FilterBar options={STATUS_FILTERS} value={statusFilter} onChange={(v) => setStatusFilter(v as 'all' | SupplierRow['status'])} />
        {pendingCount > 0 && <Badge variant="danger">{pendingCount} بانتظار المراجعة</Badge>}
        <span className="mx-1 h-4 w-px bg-latte" />
        <FilterBar options={PERIOD_FILTERS} value={period} onChange={(v) => setPeriod(v as 'all' | 'month')} />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && <EmptyState title="ما فيه نتائج" />}
        {filtered.map((s) => {
          const expanded = expandedId === s.id;
          const meta = STATUS_META[s.status];
          return (
            <div key={s.id} className="overflow-hidden rounded-2xl border border-latte bg-paper shadow-sm">
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
                  {s.is_advertiser && <Badge variant="accent">معلن</Badge>}
                  {s.is_sponsor && (
                    <Badge variant="accent" className="bg-gold text-on-gold border-gold">
                      Sponsor
                    </Badge>
                  )}
                  {s.is_verified && <Badge variant="info">موثّق</Badge>}
                  <Badge variant={meta.badge}>{meta.label}</Badge>
                </div>
                <span className={`text-mocha transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
              </button>

              {expanded && (
                <div className="grid gap-5 border-t border-latte bg-paper/50 p-4 sm:grid-cols-2">
                  <div>
                    <SectionTitle>الحالة</SectionTitle>
                    {s.status === 'pending' ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => setStatus(s.id, 'approved')}>
                          قبول المورّد
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setStatus(s.id, 'rejected')}>
                          رفض
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge variant={meta.badge}>{meta.label}</Badge>
                        <Button size="sm" variant="link" onClick={() => setStatus(s.id, s.status === 'approved' ? 'rejected' : 'approved')}>
                          تغيير
                        </Button>
                      </div>
                    )}
                    <p className="mt-3 text-xs text-mocha">
                      رخصة تجارية: <span dir="ltr">{s.trade_license_number ?? '—'}</span>
                    </p>
                  </div>

                  <div>
                    <SectionTitle>الفئات</SectionTitle>
                    <p className="mb-2 text-[11px] text-mocha">تحدد صورة الخلفية اللي تظهر خلف بطاقته بالتطبيق</p>
                    <div className="flex flex-wrap gap-2">
                      {SUPPLIER_CATEGORIES.map((c) => {
                        const active = s.categories?.includes(c);
                        return (
                          <button
                            key={c}
                            onClick={() => toggleCategory(s.id, c)}
                            className={`rounded-full border px-3 py-1.5 text-xs ${
                              active ? 'border-gold bg-gold text-on-gold' : 'border-latte text-coffee'
                            }`}
                          >
                            {c}
                          </button>
                        );
                      })}
                    </div>
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

                  <div className="sm:col-span-2">
                    <SectionTitle>المتجر والأفيليت</SectionTitle>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Field label="رابط الموقع">
                        <input
                          defaultValue={s.website ?? ''}
                          onBlur={(e) => saveField(s.id, 'website', e.target.value)}
                          placeholder="https://..."
                          dir="ltr"
                          className="w-full rounded-lg border border-latte bg-paper px-2 py-1.5 text-xs outline-none focus:border-gold"
                        />
                      </Field>
                      <Field label="نسبتك (%)">
                        <input
                          defaultValue={s.commission_percent ?? ''}
                          onBlur={(e) => saveField(s.id, 'commission_percent', e.target.value)}
                          placeholder="—"
                          type="number"
                          step="0.5"
                          dir="ltr"
                          className="w-full rounded-lg border border-latte bg-paper px-2 py-1.5 text-xs outline-none focus:border-gold"
                        />
                      </Field>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {(() => {
                        const st = stats[s.id] ?? EMPTY_STATS;
                        const conversionRate = st.clicks > 0 ? ((st.confirmedPurchases / st.clicks) * 100).toFixed(0) : '—';
                        return (
                          <>
                            <div className="rounded-lg border border-latte bg-paper p-2 text-center">
                              <p className="text-[10px] text-mocha">نقرات</p>
                              <p className="text-sm font-bold text-coffee">{st.clicks}</p>
                            </div>
                            <div className="rounded-lg border border-latte bg-paper p-2 text-center">
                              <p className="text-[10px] text-mocha">مشتريات مؤكدة</p>
                              <p className="text-sm font-bold text-coffee">{st.confirmedPurchases}</p>
                            </div>
                            <div className="rounded-lg border border-latte bg-paper p-2 text-center">
                              <p className="text-[10px] text-mocha">
                                معدل التحويل
                                <InfoTip text="نسبة النقرات اللي تحولت لشراء مؤكد فعلاً (مشتريات مؤكدة ÷ نقرات)." />
                              </p>
                              <p className="text-sm font-bold text-coffee">{conversionRate === '—' ? conversionRate : `${conversionRate}%`}</p>
                            </div>
                            <div className="rounded-lg border border-gold/50 bg-sand p-2 text-center">
                              <p className="text-[10px] text-mocha">العمولة المستحقة</p>
                              <p className="text-sm font-bold text-gold">{st.commissionOwed.toFixed(2)} د.إ</p>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    <div className="mt-3">
                      <Field
                        label={
                          <>
                            رابط تأكيد الشراء
                            <InfoTip text="هذا الرابط تعطيه للمورد عشان يرسل لك تأكيد كل عملية شراء تلقائياً -- بدونه ما تقدر تحسب عمولتك بدقة." />
                          </>
                        }
                      >
                        <div className="flex items-center gap-1.5">
                          <input
                            readOnly
                            value={`${WEBHOOK_BASE_URL}?token=${s.postback_secret}`}
                            dir="ltr"
                            onFocus={(e) => e.target.select()}
                            className="w-full rounded-lg border border-latte bg-paper px-2 py-1.5 text-[11px] text-coffee outline-none"
                          />
                          <Button size="sm" variant="outline" className="shrink-0 text-[11px]" onClick={() => copyWebhookUrl(s.id, s.postback_secret)}>
                            {copiedId === s.id ? 'تم النسخ ✓' : 'نسخ'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 text-[11px] text-stone hover:border-danger/40 hover:text-danger"
                            onClick={() => rotatePostbackSecret(s.id)}
                          >
                            تجديد
                          </Button>
                        </div>
                      </Field>
                    </div>

                    <div className="mt-3 grid gap-2">
                      <Field label="كود الخصم للعميل">
                        <input
                          defaultValue={s.promo_code ?? ''}
                          onBlur={(e) => saveField(s.id, 'promo_code', e.target.value.toUpperCase())}
                          placeholder="BARISTADROP10"
                          dir="ltr"
                          className="w-full rounded-lg border border-latte bg-paper px-2 py-1.5 text-xs outline-none focus:border-gold"
                        />
                      </Field>
                      <Field label="نص الخصم" helper="يظهر بجانب زر زيارة المتجر بالتطبيق، مثال: «خصم 15%»">
                        <input
                          defaultValue={s.discount_label ?? ''}
                          onBlur={(e) => saveField(s.id, 'discount_label', e.target.value)}
                          placeholder="خصم 15%"
                          className="w-full rounded-lg border border-latte bg-paper px-2 py-1.5 text-xs outline-none focus:border-gold"
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
                        className="w-full rounded-lg border border-latte bg-paper px-2 py-1.5 text-xs outline-none focus:border-gold"
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
                        <Button size="sm" variant="link" onClick={() => unlinkOwner(s.id)}>
                          فك الربط
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <input
                          value={ownerInput[s.id] ?? ''}
                          onChange={(e) => setOwnerInput((prev) => ({ ...prev, [s.id]: e.target.value }))}
                          placeholder="إيميل حساب المورّد"
                          dir="ltr"
                          className="flex-1 rounded-lg border border-latte bg-paper px-2 py-1.5 text-xs outline-none focus:border-gold"
                        />
                        <Button size="sm" variant="secondary" onClick={() => linkOwner(s.id)}>
                          ربط
                        </Button>
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

export const SuppliersTab = memo(SuppliersTabImpl);
