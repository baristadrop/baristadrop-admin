'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Field } from '@/components/ui/Field';

type LinkRow = {
  id: string;
  affiliate_program_id: string;
  name: string;
  destination_url: string;
  token: string;
  status: 'active' | 'paused' | 'expired';
};

type Option = { id: string; name: string };

const GO_BASE_URL = 'https://admin.baristadrop.com/api/go';

const STATUS_META: Record<LinkRow['status'], { label: string; className: string }> = {
  active: { label: 'نشط', className: 'bg-green-100 text-green-700' },
  paused: { label: 'موقوف', className: 'bg-amber-100 text-amber-700' },
  expired: { label: 'منتهي', className: 'bg-red-100 text-red-700' },
};

const emptyForm = { programId: '', name: '', destinationUrl: '' };

export function LinksTab() {
  const [rows, setRows] = useState<LinkRow[] | null>(null);
  const [programs, setPrograms] = useState<Option[]>([]);
  const [clickCounts, setClickCounts] = useState<Record<string, number>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = async () => {
    const [{ data }, { data: p }] = await Promise.all([
      supabase.from('affiliate_links').select('*').order('name').returns<LinkRow[]>(),
      supabase.from('affiliate_programs').select('id, name').order('name').returns<Option[]>(),
    ]);
    setRows(data ?? []);
    setPrograms(p ?? []);

    if (data && data.length > 0) {
      const counts: Record<string, number> = {};
      await Promise.all(
        data.map(async (link) => {
          const { count } = await supabase
            .from('affiliate_click_events')
            .select('id', { count: 'exact', head: true })
            .eq('affiliate_link_id', link.id);
          counts[link.id] = count ?? 0;
        })
      );
      setClickCounts(counts);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createLink = async () => {
    if (!form.programId || !form.name.trim() || !form.destinationUrl.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('affiliate_links').insert({
      affiliate_program_id: form.programId,
      name: form.name.trim(),
      destination_url: form.destinationUrl.trim(),
    });
    setSaving(false);
    if (!error) {
      setForm(emptyForm);
      setShowAdd(false);
      load();
    }
  };

  const setStatus = async (id: string, status: LinkRow['status']) => {
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, status } : r)) ?? null);
    await supabase.from('affiliate_links').update({ status }).eq('id', id);
  };

  const copyGoUrl = (id: string, token: string) => {
    navigator.clipboard.writeText(`${GO_BASE_URL}/${token}`).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((v) => (v === id ? null : v)), 1500);
    });
  };

  if (!rows) return <p className="text-mocha">تحميل...</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-mocha">كل رابط له توكن فريد -- استخدم رابط /go/{'{token}'} بدل الرابط المباشر عشان يتسجّل الكليك والإحالة.</p>
        <button onClick={() => setShowAdd((v) => !v)} className="rounded-full bg-ink px-4 py-1.5 text-xs font-bold text-cream">
          {showAdd ? 'إلغاء' : '+ رابط جديد'}
        </button>
      </div>

      {showAdd && (
        <div className="grid gap-3 rounded-2xl border border-gold/40 bg-sand/40 p-4 sm:grid-cols-2">
          <Field label="البرنامج *">
            <select
              value={form.programId}
              onChange={(e) => setForm((f) => ({ ...f, programId: e.target.value }))}
              className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
            >
              <option value="">اختر...</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="الاسم *">
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
            />
          </Field>
          <Field label="رابط الوجهة *" helper="الرابط الحقيقي لصفحة المنتج/المتجر">
            <input
              value={form.destinationUrl}
              onChange={(e) => setForm((f) => ({ ...f, destinationUrl: e.target.value }))}
              dir="ltr"
              placeholder="https://..."
              className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
            />
          </Field>
          <div className="flex items-end">
            <button
              onClick={createLink}
              disabled={saving || !form.programId || !form.name.trim() || !form.destinationUrl.trim()}
              className="rounded-full bg-gold px-5 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {saving ? 'جاري الحفظ...' : 'إنشاء'}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-latte bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-right text-sm">
          <thead className="bg-sand/60 text-[11px] uppercase tracking-wide text-mocha">
            <tr>
              <th className="px-3 py-2">الاسم</th>
              <th className="px-3 py-2">البرنامج</th>
              <th className="px-3 py-2">كليكات</th>
              <th className="px-3 py-2">الحالة</th>
              <th className="px-3 py-2">رابط /go</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-mocha">
                  ما فيه روابط بعد.
                </td>
              </tr>
            )}
            {rows.map((l) => {
              const meta = STATUS_META[l.status];
              return (
                <tr key={l.id} className="border-t border-latte">
                  <td className="px-3 py-2 font-medium text-ink">{l.name}</td>
                  <td className="px-3 py-2 text-xs text-mocha">{programs.find((p) => p.id === l.affiliate_program_id)?.name ?? '—'}</td>
                  <td className="px-3 py-2 font-[var(--font-el-messiri)] tabular-nums text-coffee">{clickCounts[l.id] ?? 0}</td>
                  <td className="px-3 py-2">
                    <select
                      value={l.status}
                      onChange={(e) => setStatus(l.id, e.target.value as LinkRow['status'])}
                      className={`rounded-full border-0 px-2 py-0.5 text-[10px] font-medium outline-none ${meta.className}`}
                    >
                      {Object.entries(STATUS_META).map(([v, m]) => (
                        <option key={v} value={v}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => copyGoUrl(l.id, l.token)} className="text-[11px] text-mocha underline">
                      {copiedId === l.id ? 'تم النسخ ✓' : 'نسخ الرابط'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
