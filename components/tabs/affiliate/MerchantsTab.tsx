'use client';

import { StatCardSkeletonGrid } from '@/components/ui/Skeleton';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { adminFetch, adminFetchJson } from '@/lib/adminApiClient';
import { Field, SectionTitle } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

type MerchantRow = {
  id: string;
  name: string;
  legal_name: string | null;
  website_url: string | null;
  country: string | null;
  currency: string;
  status: 'active' | 'suspended' | 'archived';
  external_reference: string | null;
  timezone: string;
  roaster_id: string | null;
  supplier_id: string | null;
};

type BusinessOption = { id: string; name: string };

const STATUS_META: Record<MerchantRow['status'], { label: string; badge: BadgeVariant }> = {
  active: { label: 'نشط', badge: 'success' },
  suspended: { label: 'موقوف', badge: 'warning' },
  archived: { label: 'مؤرشف', badge: 'neutral' },
};

const emptyForm = {
  name: '',
  legalName: '',
  country: '',
  currency: 'AED',
  roasterId: '',
  supplierId: '',
  externalReference: '',
  timezone: 'Asia/Dubai',
};
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
        external_reference: form.externalReference.trim() || null,
        timezone: form.timezone.trim() || 'Asia/Dubai',
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

  const saveField = async (
    id: string,
    field: 'legal_name' | 'website_url' | 'country' | 'currency' | 'external_reference' | 'timezone',
    value: string
  ) => {
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, [field]: value.trim() || null } : r)) ?? null);
    const res = await adminFetchJson(`${API_URL}?id=${id}`, { method: 'PATCH', body: JSON.stringify({ [field]: value.trim() || null }) });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'فشل الحفظ');
      load();
    }
  };

  if (!rows) return <StatCardSkeletonGrid />;

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
        <Button size="sm" onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? 'إلغاء' : '+ تاجر جديد'}
        </Button>
      </div>

      {showAdd && (
        <div className="grid gap-3 rounded-2xl border border-gold/40 bg-sand/40 p-4 sm:grid-cols-2">
          <Field label="الاسم *">
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="h-8 text-xs" />
          </Field>
          <Field label="الاسم القانوني">
            <Input value={form.legalName} onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))} className="h-8 text-xs" />
          </Field>
          <Field label="الدولة">
            <Input
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              placeholder="AE / SA / KW..."
              dir="ltr"
              className="h-8 text-xs"
            />
          </Field>
          <Field label="العملة">
            <Input value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} dir="ltr" className="h-8 text-xs" />
          </Field>
          <Field label="مرجع خارجي (اختياري)" helper="external_reference">
            <Input
              value={form.externalReference}
              onChange={(e) => setForm((f) => ({ ...f, externalReference: e.target.value }))}
              dir="ltr"
              className="h-8 text-xs"
            />
          </Field>
          <Field label="المنطقة الزمنية">
            <Input value={form.timezone} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))} dir="ltr" className="h-8 text-xs" />
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
            <Button size="sm" onClick={createMerchant} disabled={saving || !form.name.trim()}>
              {saving ? 'جاري الحفظ...' : 'إنشاء'}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {rows.length === 0 && !showAdd && <EmptyState title="ما فيه تجار بعد" />}
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
                <Badge variant={meta.badge}>{meta.label}</Badge>
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
                      <Input defaultValue={m.legal_name ?? ''} onBlur={(e) => saveField(m.id, 'legal_name', e.target.value)} className="h-8 text-xs" />
                    </Field>
                    <Field label="رابط الموقع">
                      <Input defaultValue={m.website_url ?? ''} onBlur={(e) => saveField(m.id, 'website_url', e.target.value)} dir="ltr" className="h-8 text-xs" />
                    </Field>
                    <Field label="مرجع خارجي" helper="external_reference">
                      <Input
                        defaultValue={m.external_reference ?? ''}
                        onBlur={(e) => saveField(m.id, 'external_reference', e.target.value)}
                        dir="ltr"
                        className="h-8 text-xs"
                      />
                    </Field>
                    <Field label="المنطقة الزمنية">
                      <Input defaultValue={m.timezone} onBlur={(e) => saveField(m.id, 'timezone', e.target.value)} dir="ltr" className="h-8 text-xs" />
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
