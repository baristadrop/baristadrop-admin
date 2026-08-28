'use client';

import { StatCardSkeletonGrid } from '@/components/ui/Skeleton';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { adminFetchJson } from '@/lib/adminApiClient';
import { DirhamIcon } from '@/components/icons/DirhamIcon';
import { Button } from '@/components/ui/Button';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { FilterBar } from '@/components/ui/FilterBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Textarea } from '@/components/ui/Textarea';

type ListingStatus = 'pending_payment' | 'pending_review' | 'active' | 'rejected' | 'sold' | 'expired' | 'removed';

type ListingRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  category: string;
  condition: 'new' | 'like_new' | 'used' | 'for_parts';
  price_aed: number;
  country: string;
  city: string;
  photo_urls: string[];
  contact_phone: string | null;
  contact_whatsapp: string | null;
  listing_fee_aed: number | null;
  paid_at: string | null;
  status: ListingStatus;
  rejection_reason: string | null;
  created_at: string;
  owner: { full_name: string | null } | null;
};

const STATUS_META: Record<ListingStatus, { label: string; badge: BadgeVariant }> = {
  pending_payment: { label: 'بانتظار الدفع', badge: 'neutral' },
  pending_review: { label: 'قيد المراجعة', badge: 'warning' },
  active: { label: 'نشط', badge: 'success' },
  rejected: { label: 'مرفوض', badge: 'danger' },
  sold: { label: 'مباع', badge: 'info' },
  expired: { label: 'منتهي', badge: 'neutral' },
  removed: { label: 'محذوف', badge: 'neutral' },
};

const CONDITION_LABEL: Record<ListingRow['condition'], string> = {
  new: 'جديد',
  like_new: 'كالجديد',
  used: 'مستعمل',
  for_parts: 'لقطع الغيار',
};

const COLUMNS =
  'id, owner_id, title, description, category, condition, price_aed, country, city, photo_urls, contact_phone, contact_whatsapp, listing_fee_aed, paid_at, status, rejection_reason, created_at, owner:profiles!marketplace_listings_owner_id_fkey(full_name)';

export function MarketplaceListingsTab() {
  const [rows, setRows] = useState<ListingRow[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<ListingStatus | 'all'>('pending_review');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reasonDraft, setReasonDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [revenue, setRevenue] = useState<{ total: number; count: number } | null>(null);

  const load = async () => {
    let query = supabase.from('marketplace_listings').select(COLUMNS).order('created_at', { ascending: false });
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    const { data } = await query.returns<ListingRow[]>();
    setRows(data ?? []);
    setSelectedId(null);
    setReasonDraft('');
  };

  const loadRevenue = async () => {
    const { data } = await supabase.from('marketplace_listings').select('listing_fee_aed').not('paid_at', 'is', null);
    const total = (data ?? []).reduce((sum, r) => sum + Number(r.listing_fee_aed ?? 0), 0);
    setRevenue({ total, count: (data ?? []).length });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    loadRevenue();
  }, []);

  const selected = useMemo(() => rows?.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  const approve = async () => {
    if (!selected) return;
    setBusy(true);
    const publishedAt = new Date();
    const expiresAt = new Date(publishedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    await supabase
      .from('marketplace_listings')
      .update({ status: 'active', published_at: publishedAt.toISOString(), expires_at: expiresAt.toISOString() })
      .eq('id', selected.id);
    await adminFetchJson('/api/admin/marketplace/notify-approval', {
      method: 'POST',
      body: JSON.stringify({ listingId: selected.id }),
    }).catch(() => null); // best-effort -- نفس منطق notify-rejection
    setBusy(false);
    load();
    loadRevenue();
  };

  const reject = async () => {
    if (!selected || !reasonDraft.trim()) return;
    setBusy(true);
    await supabase.from('marketplace_listings').update({ status: 'rejected', rejection_reason: reasonDraft.trim() }).eq('id', selected.id);
    await adminFetchJson('/api/admin/marketplace/notify-rejection', {
      method: 'POST',
      body: JSON.stringify({ listingId: selected.id }),
    }).catch(() => null); // best-effort -- سبب الرفض يظهر بشاشة "إعلاناتي" بأي حال
    setBusy(false);
    load();
  };

  if (!rows) return <StatCardSkeletonGrid />;

  return (
    <div className="space-y-3">
      {revenue && (
        <div className="flex items-center gap-2 rounded-2xl border border-gold/40 bg-sand/40 px-4 py-2.5 text-sm text-coffee">
          <DirhamIcon />
          <span className="font-[var(--font-el-messiri)] font-bold tabular-nums">{revenue.total.toFixed(2)}</span>
          <span className="text-xs text-mocha">إيراد رسوم الإعلانات ({revenue.count} إعلان مدفوع)</span>
        </div>
      )}

      <FilterBar
        options={(['pending_review', 'all', 'active', 'rejected', 'sold', 'expired', 'removed'] as const).map((s) => ({
          value: s,
          label: s === 'all' ? 'الكل' : STATUS_META[s].label,
        }))}
        value={statusFilter}
        onChange={(v) => setStatusFilter(v as ListingStatus | 'all')}
      />

      {rows.length === 0 ? (
        <EmptyState title="ما فيه إعلانات بهذي الحالة" />
      ) : (
        <div className="flex gap-6">
          <div className="w-72 shrink-0 rounded-2xl border border-latte bg-white shadow-sm">
            {rows.map((r) => {
              const meta = STATUS_META[r.status];
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    setSelectedId(r.id);
                    setReasonDraft('');
                  }}
                  className={`block w-full border-b border-latte/60 p-3 text-right last:border-0 ${
                    selectedId === r.id ? 'bg-sand/60' : 'hover:bg-sand/20'
                  }`}
                >
                  <p className="text-sm font-medium text-ink">{r.title}</p>
                  <p className="text-xs text-mocha">{r.owner?.full_name ?? '—'}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant={meta.badge}>{meta.label}</Badge>
                    <span className="text-[11px] text-stone">{new Date(r.created_at).toLocaleDateString('ar')}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="flex-1 rounded-2xl border border-latte bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-[var(--font-el-messiri)] text-xl text-ink">{selected.title}</h3>
                  <p className="mt-1 text-sm text-mocha">
                    {CONDITION_LABEL[selected.condition]} · {selected.city} · {selected.country}
                  </p>
                </div>
                {selected.status === 'pending_review' && (
                  <div className="flex shrink-0 gap-2">
                    <Button disabled={busy} onClick={approve}>
                      قبول
                    </Button>
                  </div>
                )}
              </div>

              {selected.photo_urls.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {selected.photo_urls.map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={url} src={url} alt={selected.title} className="h-32 w-full rounded-xl border border-latte object-cover" />
                  ))}
                </div>
              )}

              <p className="mt-4 whitespace-pre-wrap text-sm text-coffee">{selected.description}</p>

              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Detail label="السعر" value={`${Number(selected.price_aed).toFixed(2)} د.إ`} />
                <Detail label="رسم الإعلان" value={selected.listing_fee_aed ? `${Number(selected.listing_fee_aed).toFixed(2)} د.إ` : '—'} />
                <Detail label="واتساب" value={selected.contact_whatsapp ?? '—'} />
                <Detail label="رقم الاتصال" value={selected.contact_phone ?? '—'} />
              </div>

              {selected.status === 'rejected' && selected.rejection_reason && (
                <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-bold text-red-700">سبب الرفض المُرسَل للبائع</p>
                  <p className="mt-1 text-sm text-red-700">{selected.rejection_reason}</p>
                </div>
              )}

              {selected.status === 'pending_review' && (
                <div className="mt-6 rounded-2xl border border-dashed border-stone bg-sand/20 p-4">
                  <p className="mb-2 text-xs text-stone">سبب الرفض (إلزامي لو رفضت) -- يوصل للبائع، ويقدر يصحح ويعيد الإرسال بدون دفع جديد</p>
                  <Textarea
                    value={reasonDraft}
                    onChange={(e) => setReasonDraft(e.target.value)}
                    rows={2}
                    placeholder="مثال: الصورة الثانية غير واضحة، رجاءً ارفع صورة أوضح"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || !reasonDraft.trim()}
                    onClick={reject}
                    className="mt-2 border-red-300 text-red-600 hover:border-red-500 hover:text-red-700"
                  >
                    رفض وإرسال السبب
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-stone">{label}</p>
      <p className="text-sm text-ink">{value || '—'}</p>
    </div>
  );
}
