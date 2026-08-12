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
  flavor_notes: string[] | null;
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
  const [saving, setSaving] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [originDraft, setOriginDraft] = useState('');
  const [flavorNotesDraft, setFlavorNotesDraft] = useState('');

  const load = async () => {
    const { data } = await supabase
      .from('beans')
      .select(
        'id, name, origin, process, flavor_notes, roast_level, price, image_url, source_url, created_at, roasters!beans_roaster_id_fkey(name, is_verified, affiliate_base_url, commission_percent), suggester:profiles(full_name)'
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

  if (!rows) return <p className="text-mocha">تحميل...</p>;
  if (rows.length === 0) return <p className="text-mocha">ما فيه محاصيل بانتظار المراجعة 🎉</p>;

  const selected = rows.find((r) => r.id === selectedId) ?? rows[0];

  const edits = () => ({
    name: nameDraft.trim() || selected.name,
    origin: originDraft.trim() || null,
    flavor_notes: flavorNotesDraft
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean),
  });

  const saveEdits = async () => {
    setSaving(true);
    await supabase.from('beans').update(edits()).eq('id', selected.id);
    setSaving(false);
    load();
  };

  const decide = async (status: 'approved' | 'rejected') => {
    setBusy(true);
    if (status === 'approved') {
      await supabase.from('beans').update(edits()).eq('id', selected.id);
    }
    await supabase.from('beans').update({ status }).eq('id', selected.id);
    setBusy(false);
    setSelectedId(null);
    load();
  };

  return (
    <div className="flex gap-6">
      <div className="w-72 shrink-0 rounded-2xl border border-latte bg-white shadow-sm">
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

      <BeanReviewPanel
        key={selected.id}
        selected={selected}
        busy={busy}
        saving={saving}
        onDecide={decide}
        onSaveEdits={saveEdits}
        nameDraft={nameDraft}
        setNameDraft={setNameDraft}
        originDraft={originDraft}
        setOriginDraft={setOriginDraft}
        flavorNotesDraft={flavorNotesDraft}
        setFlavorNotesDraft={setFlavorNotesDraft}
      />
    </div>
  );
}

function BeanReviewPanel({
  selected,
  busy,
  saving,
  onDecide,
  onSaveEdits,
  nameDraft,
  setNameDraft,
  originDraft,
  setOriginDraft,
  flavorNotesDraft,
  setFlavorNotesDraft,
}: {
  selected: BeanRow;
  busy: boolean;
  saving: boolean;
  onDecide: (status: 'approved' | 'rejected') => void;
  onSaveEdits: () => void;
  nameDraft: string;
  setNameDraft: (v: string) => void;
  originDraft: string;
  setOriginDraft: (v: string) => void;
  flavorNotesDraft: string;
  setFlavorNotesDraft: (v: string) => void;
}) {
  // يهيّئ المسودات من بيانات المحصول المختار — يعاد كل ما تغيّر المحصول (بفضل key={selected.id} بالأعلى)
  const [initialized, setInitialized] = useState(false);
  if (!initialized) {
    setNameDraft(selected.name);
    setOriginDraft(selected.origin ?? '');
    setFlavorNotesDraft((selected.flavor_notes ?? []).join(', '));
    setInitialized(true);
  }

  return (
    <div className="flex-1 rounded-2xl border border-latte bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            placeholder="اسم المحصول"
            className="w-full rounded-lg border border-latte bg-paper px-3 py-2 font-[var(--font-el-messiri)] text-xl text-ink outline-none focus:border-gold"
          />
          <p className="mt-1 text-sm text-mocha">من {selected.roasters?.name ?? '—'}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            disabled={busy}
            onClick={() => onDecide('approved')}
            className="rounded-full bg-gold px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            قبول
          </button>
          <button
            disabled={busy}
            onClick={() => onDecide('rejected')}
            className="rounded-full border border-latte px-4 py-2 text-sm text-coffee disabled:opacity-50"
          >
            رفض
          </button>
        </div>
      </div>

      {selected.image_url && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-latte">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selected.image_url} alt={selected.name} className="max-h-96 w-full object-contain bg-sand/30" />
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs text-stone">المنشأ (شوفه بالصورة وعدّله لو لازم)</p>
          <input
            value={originDraft}
            onChange={(e) => setOriginDraft(e.target.value)}
            placeholder="مثال: إثيوبيا · قيدب"
            className="w-full rounded-lg border border-latte bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </div>
        <div>
          <p className="mb-1 text-xs text-stone">نكهات القهوة (افصل بفاصلة، شوفها بالصورة وعدّلها لو لازم)</p>
          <input
            value={flavorNotesDraft}
            onChange={(e) => setFlavorNotesDraft(e.target.value)}
            placeholder="توت، شوكولاتة، حمضيات"
            className="w-full rounded-lg border border-latte bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </div>
      </div>

      <button
        onClick={onSaveEdits}
        disabled={saving}
        className="mt-3 rounded-full border border-gold px-4 py-1.5 text-xs font-bold text-gold disabled:opacity-50"
      >
        {saving ? '...' : 'حفظ التعديلات'}
      </button>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
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
