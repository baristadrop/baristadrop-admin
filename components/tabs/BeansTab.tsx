'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { DirhamIcon } from '@/components/icons/DirhamIcon';

type RoasterInfo = {
  name: string;
  is_verified: boolean;
  affiliate_base_url: string | null;
  commission_percent: number | null;
};

type BeanRow = {
  id: string;
  name: string;
  origin: string | null;
  process: string | null;
  roast_level: string | null;
  price: number | null;
  image_url: string | null;
  source_url: string | null;
  created_at: string;
  roasters: RoasterInfo | null;
  suggester: { full_name: string | null } | null;
};

export function BeansTab() {
  const [rows, setRows] = useState<BeanRow[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from('beans')
      .select(
        'id, name, origin, process, roast_level, price, image_url, source_url, created_at, roasters(name, is_verified, affiliate_base_url, commission_percent), suggester:profiles(full_name)'
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .returns<BeanRow[]>();
    setRows(data ?? []);
    if (data && data.length > 0 && !selectedId) setSelectedId(data[0].id);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const decide = async (id: string, status: 'approved' | 'rejected') => {
    setBusy(true);
    await supabase.from('beans').update({ status }).eq('id', id);
    setBusy(false);
    setSelectedId(null);
    load();
  };

  if (!rows) return <p className="text-mocha">تحميل...</p>;
  if (rows.length === 0) return <p className="text-mocha">ما فيه محاصيل بانتظار المراجعة 🎉</p>;

  const selected = rows.find((r) => r.id === selectedId) ?? rows[0];

  return (
    <div className="flex gap-6">
      <div className="w-72 shrink-0 rounded-2xl border border-latte bg-white">
        {rows.map((b) => (
          <button
            key={b.id}
            onClick={() => setSelectedId(b.id)}
            className={`block w-full border-b border-latte/60 p-3 text-right last:border-0 ${
              selected.id === b.id ? 'bg-sand/60' : 'hover:bg-sand/20'
            }`}
          >
            <p className="text-sm font-medium text-ink">{b.name}</p>
            <p className="text-xs text-mocha">{b.roasters?.name ?? '—'}</p>
            <p className="mt-1 text-[11px] text-stone">{new Date(b.created_at).toLocaleDateString('ar')}</p>
          </button>
        ))}
      </div>

      <div className="flex-1 rounded-2xl border border-latte bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-[var(--font-el-messiri)] text-xl text-ink">{selected.name}</h2>
            <p className="text-sm text-mocha">من {selected.roasters?.name ?? '—'}</p>
          </div>
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => decide(selected.id, 'approved')}
              className="rounded-full bg-gold px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              قبول
            </button>
            <button
              disabled={busy}
              onClick={() => decide(selected.id, 'rejected')}
              className="rounded-full border border-latte px-4 py-2 text-sm text-coffee disabled:opacity-50"
            >
              رفض
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Detail label="المنشأ" value={selected.origin} />
          <Detail label="المعالجة" value={selected.process} />
          <Detail label="درجة التحميص" value={selected.roast_level} />
          <Detail
            label="السعر"
            value={
              selected.price ? (
                <span className="inline-flex items-center gap-1">
                  {selected.price} <DirhamIcon />
                </span>
              ) : null
            }
          />
          <Detail label="اقترحه" value={selected.suggester?.full_name} />
          <Detail label="تاريخ الاقتراح" value={new Date(selected.created_at).toLocaleString('ar')} />
        </div>

        {selected.source_url && (
          <div className="mt-4">
            <p className="mb-1 text-xs text-mocha">رابط مصدر مقترَح</p>
            <a
              href={selected.source_url}
              target="_blank"
              rel="noreferrer"
              dir="ltr"
              className="block break-all rounded-lg bg-sand/40 p-2 text-xs text-coffee underline"
            >
              {selected.source_url}
            </a>
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-dashed border-gold/50 bg-gold/5 p-4">
          <p className="mb-2 text-sm font-bold text-coffee">معلومات الأفيليت لهذي المحمصة</p>
          {selected.roasters?.affiliate_base_url ? (
            <>
              <p className="break-all text-xs text-mocha" dir="ltr">
                {selected.roasters.affiliate_base_url}
              </p>
              <p className="mt-1 text-xs text-coffee">
                نسبتك: {selected.roasters.commission_percent ?? '—'}%
                {!selected.roasters.is_verified && ' · المحمصة لسه غير موثّقة'}
              </p>
            </>
          ) : (
            <p className="text-xs text-mocha">ما فيه رابط أفيليت مسجّل لهذي المحمصة بعد — تقدر تضيفه من تبويب المحامص.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-stone">{label}</p>
      <p className="text-sm text-ink">{value || '—'}</p>
    </div>
  );
}
