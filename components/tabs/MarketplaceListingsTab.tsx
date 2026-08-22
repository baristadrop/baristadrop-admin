'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { adminFetchJson } from '@/lib/adminApiClient';
import { DirhamIcon } from '@/components/icons/DirhamIcon';

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
  contact_phone: string;
  listing_fee_aed: number | null;
  paid_at: string | null;
  status: ListingStatus;
  rejection_reason: string | null;
  created_at: string;
  owner: { full_name: string | null } | null;
};

const STATUS_META: Record<ListingStatus, { label: string; className: string }> = {
  pending_payment: { label: 'بانتظار الدفع', className: 'bg-stone/20 text-stone' },
  pending_review: { label: 'قيد المراجعة', className: 'bg-amber-100 text-amber-700' },
  active: { label: 'نشط', className: 'bg-green-100 text-green-700' },
  rejected: { label: 'مرفوض', className: 'bg-red-100 text-red-700' },
  sold: { label: 'مباع', className: 'bg-blue-100 text-blue-700' },
  expired: { label: 'منتهي', className: 'bg-stone/20 text-stone' },
  removed: { label: 'محذوف', className: 'bg-stone/20 text-stone' },
};

const CONDITION_LABEL: Record<ListingRow['condition'], string> = {
  new: 'جديد',
  like_new: 'كالجديد',
  used: 'مستعمل',
  for_parts: 'لقطع الغيار',
};

const COLUMNS =
  'id, owner_id, title, description, category, condition, price_aed, country, city, photo_urls, contact_phone, listing_fee_aed, paid_at, status, rejection_reason, created_at, owner:profiles!marketplace_listings_owner_id_fkey(full_name)';

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

  if (!rows) return <p className="text-mocha">تحميل...</p>;

  return (
    <div className="space-y-3">
      {revenue && (
        <div className="flex items-center gap-2 rounded-2xl border border-gold/40 bg-sand/40 px-4 py-2.5 text-sm text-coffee">
          <DirhamIcon />
          <span className="font-[var(--font-el-messiri)] font-bold tabular-nums">{revenue.total.toFixed(2)}</span>
          <span className="text-xs text-mocha">إيراد رسوم الإعلانات ({revenue.count} إعلان مدفوع)</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(['pending_review', 'all', 'active', 'rejected', 'sold', 'expired', 'removed'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full border px-3 py-1.5 text-xs ${statusFilter === s ? 'border-gold bg-gold text-white' : 'border-latte text-coffee'}`}
          >
            {s === 'all' ? 'الكل' : STATUS_META[s].label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="p-6 text-center text-mocha">ما فيه إعلانات بهذي الحالة.</p>
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
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.className}`}>{meta.label}</span>
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
                    <button
                      disabled={busy}
                      onClick={approve}
                      className="rounded-full bg-gold px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                    >
                      قبول
                    </button>
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
                <Detail label="رقم التواصل" value={selected.contact_phone} />
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
                  <textarea
                    value={reasonDraft}
                    onChange={(e) => setReasonDraft(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-latte bg-white p-2 text-sm outline-none focus:border-gold"
                    placeholder="مثال: الصورة الثانية غير واضحة، رجاءً ارفع صورة أوضح"
                  />
                  <button
                    disabled={busy || !reasonDraft.trim()}
                    onClick={reject}
                    className="mt-2 rounded-full border border-red-300 px-4 py-1.5 text-xs font-bold text-red-600 disabled:opacity-50"
                  >
                    رفض وإرسال السبب
                  </button>
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
