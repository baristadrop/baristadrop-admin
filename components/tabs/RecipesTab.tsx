'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type RoasterInfo = {
  name: string;
  is_verified: boolean;
  affiliate_base_url: string | null;
  commission_percent: number | null;
};

type RecipeRow = {
  id: string;
  method: string;
  xbloom_link: string | null;
  grinder: string | null;
  grind: string | null;
  temp: string | null;
  ratio: string | null;
  water: string | null;
  notes: string | null;
  image_url: string | null;
  created_at: string;
  beans: { name: string; origin: string | null; process: string | null; roasters: RoasterInfo | null } | null;
  submitter: { full_name: string | null } | null;
};

export function RecipesTab() {
  const [rows, setRows] = useState<RecipeRow[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from('recipes')
      .select(
        'id, method, xbloom_link, grinder, grind, temp, ratio, water, notes, image_url, created_at, beans(name, origin, process, roasters(name, is_verified, affiliate_base_url, commission_percent)), submitter:profiles(full_name)'
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .returns<RecipeRow[]>();
    setRows(data ?? []);
    if (data && data.length > 0 && !selectedId) setSelectedId(data[0].id);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const decide = async (id: string, status: 'approved' | 'rejected') => {
    setBusy(true);
    await supabase.from('recipes').update({ status }).eq('id', id);
    setBusy(false);
    setSelectedId(null);
    load();
  };

  if (!rows) return <p className="text-mocha">تحميل...</p>;
  if (rows.length === 0) return <p className="text-mocha">ما فيه وصفات بانتظار المراجعة 🎉</p>;

  const selected = rows.find((r) => r.id === selectedId) ?? rows[0];

  return (
    <div className="flex gap-6">
      <div className="w-72 shrink-0 rounded-2xl border border-latte bg-white">
        {rows.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelectedId(r.id)}
            className={`block w-full border-b border-latte/60 p-3 text-right last:border-0 ${
              selected.id === r.id ? 'bg-sand/60' : 'hover:bg-sand/20'
            }`}
          >
            <p className="text-sm font-medium text-ink">{r.beans?.name ?? '—'}</p>
            <p className="text-xs text-mocha">{r.beans?.roasters?.name ?? '—'}</p>
            <p className="mt-1 text-[11px] text-stone">
              {new Date(r.created_at).toLocaleDateString('ar')}
            </p>
          </button>
        ))}
      </div>

      <div className="flex-1 rounded-2xl border border-latte bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-[var(--font-el-messiri)] text-xl text-ink">{selected.beans?.name}</h2>
            <p className="text-sm text-mocha">
              {selected.beans?.origin} {selected.beans?.process ? `· ${selected.beans.process}` : ''}
            </p>
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
          <Detail label="طريقة التحضير" value={selected.method} />
          <Detail label="الريشيو" value={selected.ratio} />
          <Detail label="الجرعة" value={selected.grind} />
          <Detail label="الحرارة" value={selected.temp ? `${selected.temp}°` : null} />
          <Detail label="آلة الطحن" value={selected.grinder} />
          <Detail label="بروفايل الماء" value={selected.water} />
          <Detail label="مقدَّمة بواسطة" value={selected.submitter?.full_name} />
          <Detail label="تاريخ التقديم" value={new Date(selected.created_at).toLocaleString('ar')} />
        </div>

        {selected.xbloom_link && (
          <div className="mt-4">
            <p className="mb-1 text-xs text-mocha">رابط xBloom</p>
            <a
              href={selected.xbloom_link}
              target="_blank"
              rel="noreferrer"
              dir="ltr"
              className="block break-all rounded-lg bg-sand/40 p-2 text-xs text-coffee underline"
            >
              {selected.xbloom_link}
            </a>
          </div>
        )}

        {selected.notes && (
          <div className="mt-4">
            <p className="mb-1 text-xs text-mocha">ملاحظات</p>
            <p className="rounded-lg bg-sand/40 p-3 text-sm text-coffee">{selected.notes}</p>
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-dashed border-gold/50 bg-gold/5 p-4">
          <p className="mb-2 text-sm font-bold text-coffee">معلومات الأفيليت لهذي المحمصة</p>
          {selected.beans?.roasters?.affiliate_base_url ? (
            <>
              <p className="break-all text-xs text-mocha" dir="ltr">
                {selected.beans.roasters.affiliate_base_url}
              </p>
              <p className="mt-1 text-xs text-coffee">
                نسبتك: {selected.beans.roasters.commission_percent ?? '—'}%
                {!selected.beans.roasters.is_verified && ' · المحمصة لسه غير موثّقة'}
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

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-stone">{label}</p>
      <p className="text-sm text-ink">{value || '—'}</p>
    </div>
  );
}
