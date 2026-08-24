'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';

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
  dose: string | null;
  tool: string | null;
  pours: string | null;
  notes: string | null;
  image_url: string | null;
  created_at: string;
  beans: {
    name: string;
    origin: string | null;
    process: string | null;
    image_url: string | null;
    roasters: RoasterInfo | null;
  } | null;
  submitter: { full_name: string | null } | null;
};

const isXbloom = (m: string) => m === 'xbloom_hot' || m === 'xbloom_cold';
const isCold = (m: string) => m === 'xbloom_cold' || m === 'v60_cold';

export function RecipesTab() {
  const [rows, setRows] = useState<RecipeRow[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from('recipes')
      .select(
        'id, method, xbloom_link, grinder, grind, temp, ratio, water, dose, tool, pours, notes, image_url, created_at, beans(name, origin, process, image_url, roasters!beans_roaster_id_fkey(name, is_verified, affiliate_base_url, commission_percent)), submitter:profiles!recipes_user_id_fkey(full_name)'
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

  if (!rows) return <p className="text-mocha">تحميل...</p>;
  if (rows.length === 0) return <EmptyState title="ما فيه وصفات بانتظار المراجعة 🎉" />;

  const selected = rows.find((r) => r.id === selectedId) ?? rows[0];

  const decide = async (status: 'approved' | 'rejected', edits?: Partial<RecipeRow>) => {
    setBusy(true);
    if (status === 'approved' && edits) await supabase.from('recipes').update(edits).eq('id', selected.id);
    await supabase.from('recipes').update({ status }).eq('id', selected.id);
    setBusy(false);
    setSelectedId(null);
    load();
  };

  const saveEdits = async (edits: Partial<RecipeRow>) => {
    setSaving(true);
    await supabase.from('recipes').update(edits).eq('id', selected.id);
    setSaving(false);
    load();
  };

  return (
    <div className="flex gap-6">
      <div className="w-72 shrink-0 rounded-2xl border border-latte bg-white shadow-sm">
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

      <RecipeReviewPanel key={selected.id} selected={selected} busy={busy} saving={saving} onDecide={decide} onSaveEdits={saveEdits} />
    </div>
  );
}

function RecipeReviewPanel({
  selected,
  busy,
  saving,
  onDecide,
  onSaveEdits,
}: {
  selected: RecipeRow;
  busy: boolean;
  saving: boolean;
  onDecide: (status: 'approved' | 'rejected', edits?: Partial<RecipeRow>) => void;
  onSaveEdits: (edits: Partial<RecipeRow>) => void;
}) {
  const [cold, setCold] = useState(isCold(selected.method));
  const [dose, setDose] = useState(selected.dose ?? '');
  const [tool, setTool] = useState(selected.tool ?? '');
  const [ratio, setRatio] = useState(selected.ratio ?? '');
  const [pours, setPours] = useState(selected.pours ?? '');
  const [temp, setTemp] = useState(selected.temp ?? '');
  const [water, setWater] = useState(selected.water ?? '');

  const xbloom = isXbloom(selected.method);
  const buildEdits = (): Partial<RecipeRow> => ({
    method: `${xbloom ? 'xbloom' : 'v60'}_${cold ? 'cold' : 'hot'}`,
    dose: dose.trim() || null,
    tool: tool.trim() || null,
    ratio: ratio.trim() || null,
    pours: pours.trim() || null,
    temp: temp.trim() || null,
    water: water.trim() || null,
  });

  return (
    <div className="flex-1 rounded-2xl border border-latte bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-[var(--font-el-messiri)] text-xl text-ink">{selected.beans?.name}</h2>
          <p className="text-sm text-mocha">
            {selected.beans?.origin} {selected.beans?.process ? `· ${selected.beans.process}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button disabled={busy} onClick={() => onDecide('approved', buildEdits())}>
            قبول
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => onDecide('rejected')}>
            رفض
          </Button>
        </div>
      </div>

      {selected.beans?.image_url && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-latte">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selected.beans.image_url}
            alt={selected.beans.name}
            className="max-h-96 w-full object-contain bg-sand/30"
          />
        </div>
      )}

      <div className="mt-4">
        <p className="mb-1 text-xs text-stone">حار أو بارد؟ (تأكد منها بنفسك — يمديها تكون غلط)</p>
        <div className="flex gap-2">
          <button
            onClick={() => setCold(false)}
            className={`rounded-full border px-4 py-1.5 text-sm ${!cold ? 'border-gold bg-gold text-white' : 'border-latte text-coffee'}`}
          >
            حار
          </button>
          <button
            onClick={() => setCold(true)}
            className={`rounded-full border px-4 py-1.5 text-sm ${cold ? 'border-gold bg-gold text-white' : 'border-latte text-coffee'}`}
          >
            بارد
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <EditableField label="كمية البن" value={dose} onChange={setDose} />
        <EditableField label="الأداة" value={tool} onChange={setTool} />
        <EditableField label="النسبة" value={ratio} onChange={setRatio} />
        <EditableField label="عدد الصبات" value={pours} onChange={setPours} />
        <EditableField label="الحرارة" value={temp} onChange={setTemp} />
        <EditableField label="كمية الماء" value={water} onChange={setWater} />
      </div>

      <Button variant="outline" size="sm" onClick={() => onSaveEdits(buildEdits())} disabled={saving} className="mt-3">
        {saving ? '...' : 'حفظ التعديلات'}
      </Button>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Detail label="آلة الطحن (يدوي)" value={selected.grinder} />
        <Detail label="درجة الطحن (يدوي)" value={selected.grind} />
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
  );
}

function EditableField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="mb-1 text-xs text-stone">{label}</p>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
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
