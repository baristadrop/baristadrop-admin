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

type BusinessType = 'roaster' | 'cafe';

type BusinessRow = {
  id: string;
  name: string;
  country: string;
  logo_url: string | null;
  trade_license_number: string | null;
  business_type: BusinessType;
  location: string | null;
  supplying_roaster_id: string | null;
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
  bean_limit: number;
  product_limit: number;
  postback_secret: string;
};

type UserOption = { id: string; email: string | null };

type BusinessStats = { clicks: number; confirmedPurchases: number; grossRevenue: number; commissionOwed: number };
const EMPTY_STATS: BusinessStats = { clicks: 0, confirmedPurchases: 0, grossRevenue: 0, commissionOwed: 0 };

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

const STATUS_META: Record<BusinessRow['status'], { label: string; badge: 'warning' | 'success' | 'danger' }> = {
  pending: { label: 'بانتظار المراجعة', badge: 'warning' },
  approved: { label: 'مقبولة', badge: 'success' },
  rejected: { label: 'مرفوضة', badge: 'danger' },
};

const STATUS_FILTERS: { value: 'all' | BusinessRow['status']; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'pending', label: 'بانتظار المراجعة' },
  { value: 'approved', label: 'مقبولة' },
  { value: 'rejected', label: 'مرفوضة' },
];

const TYPE_FILTERS: { value: 'all' | BusinessType; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'roaster', label: 'محامص' },
  { value: 'cafe', label: 'كوفي شوبات' },
];

const TYPE_LABEL: Record<BusinessType, string> = { roaster: 'محمصة', cafe: 'كوفي شوب' };

function BusinessesTabImpl() {
  const [rows, setRows] = useState<BusinessRow[] | null>(null);
  const [stats, setStats] = useState<Record<string, BusinessStats>>({});
  const [period, setPeriod] = useState<'all' | 'month'>('all');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [ownerInput, setOwnerInput] = useState<Record<string, string>>({});
  const [ownerMsg, setOwnerMsg] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BusinessRow['status']>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | BusinessType>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = async () => {
    const [{ data }, { data: statsRows }, sessionRes] = await Promise.all([
      supabase
        .from('roasters')
        .select(
          'id, name, country, logo_url, trade_license_number, business_type, location, supplying_roaster_id, is_verified, is_sponsor, is_advertiser, can_edit_links, affiliate_base_url, commission_percent, promo_code, discount_label, status, owner_id, bean_limit, product_limit, postback_secret'
        )
        .order('name')
        .returns<BusinessRow[]>(),
      supabase.rpc('get_affiliate_business_stats', { p_since: periodSince(period) ?? null }),
      supabase.auth.getSession(),
    ]);
    setRows(data ?? []);
    const nextStats: Record<string, BusinessStats> = {};
    for (const s of (statsRows as {
      business_type: string; business_id: string; clicks: number;
      confirmed_purchases: number; gross_revenue: number; commission_owed: number;
    }[]) ?? []) {
      if (s.business_type !== 'roaster') continue;
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
    await supabase.from('roasters').update({ postback_secret: newSecret }).eq('id', id);
  };

  const copyWebhookUrl = (id: string, secret: string) => {
    navigator.clipboard.writeText(`${WEBHOOK_BASE_URL}?token=${secret}`).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((v) => (v === id ? null : v)), 1500);
    });
  };

  const setStatus = async (id: string, status: BusinessRow['status']) => {
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, status } : r)) ?? null);
    await supabase.from('roasters').update({ status }).eq('id', id);
  };

  const setBusinessType = async (id: string, business_type: BusinessType) => {
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, business_type } : r)) ?? null);
    await supabase.from('roasters').update({ business_type }).eq('id', id);
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
    field: 'location' | 'affiliate_base_url' | 'commission_percent' | 'promo_code' | 'discount_label',
    value: string
  ) => {
    const payload =
      field === 'commission_percent'
        ? { commission_percent: value.trim() === '' ? null : Number(value) }
        : { [field]: value.trim() || null };
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, ...payload } : r)) ?? null);
    await supabase.from('roasters').update(payload).eq('id', id);
  };

  const setSupplyingRoaster = async (id: string, roasterId: string) => {
    const value = roasterId || null;
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, supplying_roaster_id: value } : r)) ?? null);
    await supabase.from('roasters').update({ supplying_roaster_id: value }).eq('id', id);
  };

  const saveLimit = async (id: string, field: 'bean_limit' | 'product_limit', value: string) => {
    const n = Math.max(0, Math.round(Number(value)));
    if (!Number.isFinite(n)) return;
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, [field]: n } : r)) ?? null);
    await supabase.from('roasters').update({ [field]: n }).eq('id', id);
  };

  const linkOwner = async (businessId: string) => {
    const email = (ownerInput[businessId] ?? '').trim().toLowerCase();
    const user = users.find((u) => u.email?.toLowerCase() === email);
    if (!user) {
      setOwnerMsg((prev) => ({ ...prev, [businessId]: 'ما لقيت حساب بهذا الإيميل' }));
      return;
    }
    await supabase.from('roasters').update({ owner_id: user.id }).eq('id', businessId);
    setRows((prev) => prev?.map((r) => (r.id === businessId ? { ...r, owner_id: user.id } : r)) ?? null);
    setOwnerMsg((prev) => ({ ...prev, [businessId]: 'تم الربط ✓' }));
  };

  const unlinkOwner = async (businessId: string) => {
    await supabase.from('roasters').update({ owner_id: null }).eq('id', businessId);
    setRows((prev) => prev?.map((r) => (r.id === businessId ? { ...r, owner_id: null } : r)) ?? null);
  };

  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (typeFilter !== 'all' && r.business_type !== typeFilter) return false;
      if (search.trim() && !r.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [rows, statusFilter, typeFilter, search]);

  const pendingCount = rows?.filter((r) => r.status === 'pending').length ?? 0;

  if (!rows) return <StatCardSkeletonGrid />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="ابحث باسم الشركة..." className="w-56" />
        <FilterBar options={TYPE_FILTERS} value={typeFilter} onChange={(v) => setTypeFilter(v as 'all' | BusinessType)} />
        <span className="mx-1 h-4 w-px bg-latte" />
        <FilterBar options={STATUS_FILTERS} value={statusFilter} onChange={(v) => setStatusFilter(v as 'all' | BusinessRow['status'])} />
        {pendingCount > 0 && <Badge variant="danger">{pendingCount} بانتظار المراجعة</Badge>}
        <span className="mx-1 h-4 w-px bg-latte" />
        <FilterBar options={PERIOD_FILTERS} value={period} onChange={(v) => setPeriod(v as 'all' | 'month')} />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && <EmptyState title="ما فيه نتائج" />}
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
                  <Badge variant="neutral">{TYPE_LABEL[r.business_type]}</Badge>
                  {r.is_advertiser && <Badge variant="accent">معلن</Badge>}
                  {r.is_sponsor && (
                    <Badge variant="accent" className="bg-gold text-white border-gold">
                      Sponsor
                    </Badge>
                  )}
                  {r.is_verified && <Badge variant="info">موثّقة</Badge>}
                  <Badge variant={meta.badge}>{meta.label}</Badge>
                </div>
                <span className={`text-mocha transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
              </button>

              {expanded && (
                <div className="grid gap-5 border-t border-latte bg-paper/50 p-4 sm:grid-cols-2">
                  <div>
                    <SectionTitle>التصنيف والحالة</SectionTitle>
                    <Field label="نوع الشركة" helper="مجرد وسم للعرض -- أي شركة تقدر تملك محاصيل ومنتجات بغض النظر عن النوع">
                      <select
                        value={r.business_type}
                        onChange={(e) => setBusinessType(r.id, e.target.value as BusinessType)}
                        className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
                      >
                        <option value="roaster">محمصة</option>
                        <option value="cafe">كوفي شوب</option>
                      </select>
                    </Field>
                    <div className="mt-3">
                      {r.status === 'pending' ? (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => setStatus(r.id, 'approved')}>
                            قبول الشركة
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setStatus(r.id, 'rejected')}>
                            رفض
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge variant={meta.badge}>{meta.label}</Badge>
                          <Button
                            size="sm"
                            variant="link"
                            onClick={() => setStatus(r.id, r.status === 'approved' ? 'rejected' : 'approved')}
                          >
                            تغيير
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="mt-3 text-xs text-mocha">
                      رخصة تجارية: <span dir="ltr">{r.trade_license_number ?? '—'}</span>
                    </p>
                    <div className="mt-3">
                      <Field label="العنوان/الموقع" helper="اختياري -- يظهر بصفحة الشركة إذا موجود">
                        <input
                          defaultValue={r.location ?? ''}
                          onBlur={(e) => saveField(r.id, 'location', e.target.value)}
                          placeholder="مثال: دبي، الجميرا"
                          className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
                        />
                      </Field>
                    </div>
                  </div>

                  <div>
                    <SectionTitle>الظهور والترويج</SectionTitle>
                    <Toggle
                      checked={r.is_verified}
                      onChange={(v) => toggle(r.id, 'is_verified', v)}
                      label="شركة موثّقة"
                      helper="يظهر شعار التوثيق الأزرق بجانب اسمها بالتطبيق"
                    />
                    <Toggle
                      checked={r.is_sponsor}
                      onChange={(v) => toggle(r.id, 'is_sponsor', v)}
                      label="Sponsor"
                      helper="تطلع فوق باقي الشركات العادية بالقوائم"
                    />
                    <Toggle
                      checked={r.is_advertiser}
                      onChange={(v) => toggle(r.id, 'is_advertiser', v)}
                      label="إعلان مدفوع"
                      helper="أعلى أولوية بالترتيب، بوسم «إعلان» واضح"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <SectionTitle>الأفيليت والعمولة</SectionTitle>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Toggle
                        checked={r.can_edit_links}
                        onChange={(v) => toggle(r.id, 'can_edit_links', v)}
                        label="فعّل زر الشراء/الزيارة"
                        helper="بدونه ما يظهر أي رابط بالتطبيق"
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
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {(() => {
                        const s = stats[r.id] ?? EMPTY_STATS;
                        const conversionRate = s.clicks > 0 ? ((s.confirmedPurchases / s.clicks) * 100).toFixed(0) : '—';
                        return (
                          <>
                            <div className="rounded-lg border border-latte bg-white p-2 text-center">
                              <p className="text-[10px] text-mocha">نقرات</p>
                              <p className="text-sm font-bold text-coffee">{s.clicks}</p>
                            </div>
                            <div className="rounded-lg border border-latte bg-white p-2 text-center">
                              <p className="text-[10px] text-mocha">مشتريات مؤكدة</p>
                              <p className="text-sm font-bold text-coffee">{s.confirmedPurchases}</p>
                            </div>
                            <div className="rounded-lg border border-latte bg-white p-2 text-center">
                              <p className="text-[10px] text-mocha">
                                معدل التحويل
                                <InfoTip text="نسبة النقرات اللي تحولت لشراء مؤكد فعلاً (مشتريات مؤكدة ÷ نقرات)." />
                              </p>
                              <p className="text-sm font-bold text-coffee">{conversionRate === '—' ? conversionRate : `${conversionRate}%`}</p>
                            </div>
                            <div className="rounded-lg border border-gold/50 bg-sand p-2 text-center">
                              <p className="text-[10px] text-mocha">العمولة المستحقة</p>
                              <p className="text-sm font-bold text-gold">{s.commissionOwed.toFixed(2)} د.إ</p>
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
                            <InfoTip text="هذا الرابط تعطيه للشركة عشان ترسل لك تأكيد كل عملية شراء تلقائياً -- بدونه ما تقدر تحسب عمولتك بدقة." />
                          </>
                        }
                      >
                        <div className="flex items-center gap-1.5">
                          <input
                            readOnly
                            value={`${WEBHOOK_BASE_URL}?token=${r.postback_secret}`}
                            dir="ltr"
                            onFocus={(e) => e.target.select()}
                            className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-[11px] text-coffee outline-none"
                          />
                          <Button size="sm" variant="outline" className="shrink-0 text-[11px]" onClick={() => copyWebhookUrl(r.id, r.postback_secret)}>
                            {copiedId === r.id ? 'تم النسخ ✓' : 'نسخ'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 text-[11px] text-stone hover:border-red-400 hover:text-red-600"
                            onClick={() => rotatePostbackSecret(r.id)}
                          >
                            تجديد
                          </Button>
                        </div>
                      </Field>
                    </div>

                    <div className="mt-3 grid gap-2">
                      <Field label="كود الخصم للعميل">
                        <input
                          defaultValue={r.promo_code ?? ''}
                          onBlur={(e) => saveField(r.id, 'promo_code', e.target.value.toUpperCase())}
                          placeholder="BARISTADROP10"
                          dir="ltr"
                          className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
                        />
                      </Field>
                      <Field label="نص الخصم" helper="يظهر بجانب الزر بالتطبيق، مثال: «خصم 15%»">
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
                    <SectionTitle>الحدود المسموحة</SectionTitle>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="عدد المحاصيل" helper="الحد الافتراضي 5 للحساب المجاني">
                        <input
                          defaultValue={r.bean_limit}
                          onBlur={(e) => saveLimit(r.id, 'bean_limit', e.target.value)}
                          type="number"
                          min={0}
                          dir="ltr"
                          className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
                        />
                      </Field>
                      <Field label="عدد المنتجات" helper="الحد الافتراضي 5 للحساب المجاني">
                        <input
                          defaultValue={r.product_limit}
                          onBlur={(e) => saveLimit(r.id, 'product_limit', e.target.value)}
                          type="number"
                          min={0}
                          dir="ltr"
                          className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
                        />
                      </Field>
                    </div>
                  </div>

                  <div>
                    <SectionTitle>منيو من شركة موردة</SectionTitle>
                    <Field label="تورّدها محمصة" helper="اختياري -- يحدد أي محاصيل تقدر تختارها بمنيوها كوصفات جاهزة، بجانب محاصيلها المباشرة">
                      <select
                        value={r.supplying_roaster_id ?? ''}
                        onChange={(e) => setSupplyingRoaster(r.id, e.target.value)}
                        className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
                      >
                        <option value="">— بدون —</option>
                        {rows
                          .filter((opt) => opt.id !== r.id)
                          .map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.name}
                            </option>
                          ))}
                      </select>
                    </Field>
                  </div>

                  <div>
                    <SectionTitle>حساب البوابة</SectionTitle>
                    {r.owner_id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gold">
                          {users.find((u) => u.id === r.owner_id)?.email ?? r.owner_id}
                        </span>
                        <Button size="sm" variant="link" onClick={() => unlinkOwner(r.id)}>
                          فك الربط
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <input
                          value={ownerInput[r.id] ?? ''}
                          onChange={(e) => setOwnerInput((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          placeholder="إيميل حساب الشركة"
                          dir="ltr"
                          className="flex-1 rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
                        />
                        <Button size="sm" variant="secondary" onClick={() => linkOwner(r.id)}>
                          ربط
                        </Button>
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

export const BusinessesTab = memo(BusinessesTabImpl);
