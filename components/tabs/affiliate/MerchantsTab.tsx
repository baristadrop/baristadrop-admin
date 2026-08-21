'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { adminFetch, adminFetchJson } from '@/lib/adminApiClient';
import { Field, SectionTitle } from '@/components/ui/Field';

type MerchantRow = {
  id: string;
  name: string;
  legal_name: string | null;
  website_url: string | null;
  country: string | null;
  currency: string;
  status: 'active' | 'suspended' | 'archived';
  roaster_id: string | null;
  supplier_id: string | null;
};

type BusinessOption = { id: string; name: string };

const STATUS_META: Record<MerchantRow['status'], { label: string; className: string }> = {
  active: { label: 'نشط', className: 'bg-green-100 text-green-700' },
  suspended: { label: 'موقوف', className: 'bg-amber-100 text-amber-700' },
  archived: { label: 'مؤرشف', className: 'bg-stone/20 text-stone' },
};

const emptyForm = { name: '', legalName: '', country: '', currency: 'AED', roasterId: '', supplierId: '' };
const API_URL = '/api/admin/affiliate/merchants';

export function MerchantsTab() {
  const [rows, setRows] = useState<MerchantRow[] | null>(null);
  const [roasters, setRoasters] = useState<BusinessOption[]>([]);
  const [suppliers, setSuppliers] = useState<BusinessOption[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [res, { data: r }, { data: s }] = await Promise.all([
      adminFetch(`${API_URL}?limit=100`),
      supabase.from('roasters').select('id, name').order('name').returns<BusinessOption[]>(),
      supabase.from('suppliers').select('id, name').order('name').returns<BusinessOption[]>(),
    ]);
    const body = await res.json().catch(() => ({}));
    if (res.ok) setRows(body.data ?? []);
    else setError(body.error ?? 'فشل تحميل التجار');
    setRoasters(r ?? []);
    setSuppliers(s ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const createMerchant = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    const res = await adminFetchJson(API_URL, {
      method: 'POST',
      body: JSON.stringify({
        name: form.name.trim(),
        legal_name: form.legalName.trim() || null,
        country: form.country.trim() || null,
        currency: form.currency.trim() || 'AED',
        roaster_id: form.roasterId || null,
        supplier_id: form.supplierId || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setForm(emptyForm);
      setShowAdd(false);
      load();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'فشل إنشاء التاجر');
    }
  };

  const setStatus = async (id: string, status: MerchantRow['status']) => {
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, status } : r)) ?? null);
    const res = await adminFetchJson(`${API_URL}?id=${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'فشل تحديث الحالة');
      load();
    }
  };

  const saveField = async (id: string, field: 'legal_name' | 'website_url' | 'country' | 'currency', value: string) => {
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, [field]: value.trim() || null } : r)) ?? null);
    const res = await adminFetchJson(`${API_URL}?id=${id}`, { method: 'PATCH', body: JSON.stringify({ [field]: value.trim() || null }) });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'فشل الحفظ');
      load();
    }
  };

  if (!rows) return <p className="text-mocha">تحميل...</p>;

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
          <button onClick={() => setError(null)} className="mr-2 font-bold">
            ×
          </button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className="text-xs text-mocha">التاجر هو الجهة اللي تبيع المنتج/الخدمة -- ممكن مربوط بمحمصة/مورّد موجود بالتطبيق، أو مستقل تماماً.</p>
        <button onClick={() => setShowAdd((v) => !v)} className="rounded-full bg-ink px-4 py-1.5 text-xs font-bold text-cream">
          {showAdd ? 'إلغاء' : '+ تاجر جديد'}
        </button>
      </div>

      {showAdd && (
        <div className="grid gap-3 rounded-2xl border border-gold/40 bg-sand/40 p-4 sm:grid-cols-2">
          <Field label="الاسم *">
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
            />
          </Field>
          <Field label="الاسم القانوني">
            <input
              value={form.legalName}
              onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))}
              className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
            />
          </Field>
          <Field label="الدولة">
            <input
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              placeholder="AE / SA / KW..."
              dir="ltr"
              className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
            />
          </Field>
          <Field label="العملة">
            <input
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              dir="ltr"
              className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
            />
          </Field>
          <Field label="ربط بمحمصة موجودة (اختياري)">
            <select
              value={form.roasterId}
              onChange={(e) => setForm((f) => ({ ...f, roasterId: e.target.value, supplierId: '' }))}
              className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
            >
              <option value="">بدون</option>
              {roasters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ربط بمورّد موجود (اختياري)">
            <select
              value={form.supplierId}
              onChange={(e) => setForm((f) => ({ ...f, supplierId: e.target.value, roasterId: '' }))}
              className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
            >
              <option value="">بدون</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <button
              onClick={createMerchant}
              disabled={saving || !form.name.trim()}
              className="rounded-full bg-gold px-5 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {saving ? 'جاري الحفظ...' : 'إنشاء'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {rows.length === 0 && !showAdd && <p className="p-6 text-center text-mocha">ما فيه تجار بعد.</p>}
        {rows.map((m) => {
          const expanded = expandedId === m.id;
          const meta = STATUS_META[m.status];
          const linkedName = m.roaster_id
            ? roasters.find((r) => r.id === m.roaster_id)?.name
            : m.supplier_id
              ? suppliers.find((s) => s.id === m.supplier_id)?.name
              : null;
          return (
            <div key={m.id} className="overflow-hidden rounded-2xl border border-latte bg-white shadow-sm">
              <button onClick={() => setExpandedId(expanded ? null : m.id)} className="flex w-full items-center gap-3 p-3 text-right">
                <div className="flex-1">
                  <p className="font-medium text-ink">{m.name}</p>
                  <p className="text-xs text-mocha">{linkedName ? `مربوط بـ ${linkedName}` : m.country ?? '—'}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.className}`}>{meta.label}</span>
                <span className={`text-mocha transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
              </button>

              {expanded && (
                <div className="grid gap-3 border-t border-latte bg-paper/50 p-4 sm:grid-cols-2">
                  <div>
                    <SectionTitle>الحالة</SectionTitle>
                    <div className="flex gap-2">
                      {(['active', 'suspended', 'archived'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setStatus(m.id, s)}
                          className={`rounded-full border px-3 py-1.5 text-xs ${
                            m.status === s ? 'border-gold bg-gold text-white' : 'border-latte text-coffee'
                          }`}
                        >
                          {STATUS_META[s].label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Field label="الاسم القانوني">
                      <input
                        defaultValue={m.legal_name ?? ''}
                        onBlur={(e) => saveField(m.id, 'legal_name', e.target.value)}
                        className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
                      />
                    </Field>
                    <Field label="رابط الموقع">
                      <input
                        defaultValue={m.website_url ?? ''}
                        onBlur={(e) => saveField(m.id, 'website_url', e.target.value)}
                        dir="ltr"
                        className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
                      />
                    </Field>
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
