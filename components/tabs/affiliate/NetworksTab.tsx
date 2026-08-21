'use client';

import { useEffect, useState } from 'react';
import { adminFetch, adminFetchJson } from '@/lib/adminApiClient';
import { Field, SectionTitle } from '@/components/ui/Field';

const API_URL = '/api/admin/affiliate/networks';

type NetworkRow = {
  id: string;
  name: string;
  code: string;
  website_url: string | null;
  api_base_url: string | null;
  status: 'active' | 'inactive' | 'deprecated';
  integration_type: string | null;
};

const STATUS_META: Record<NetworkRow['status'], { label: string; className: string }> = {
  active: { label: 'مفعّلة', className: 'bg-green-100 text-green-700' },
  inactive: { label: 'موقوفة', className: 'bg-amber-100 text-amber-700' },
  deprecated: { label: 'قديمة', className: 'bg-red-100 text-red-700' },
};

export function NetworksTab() {
  const [rows, setRows] = useState<NetworkRow[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await adminFetch(`${API_URL}?limit=100`);
    const body = await res.json().catch(() => ({}));
    if (res.ok) setRows(body.data ?? []);
    else setError(body.error ?? 'فشل تحميل الشبكات');
  };

  useEffect(() => {
    load();
  }, []);

  const setStatus = async (id: string, status: NetworkRow['status']) => {
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, status } : r)) ?? null);
    const res = await adminFetchJson(`${API_URL}?id=${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'فشل تحديث الحالة');
      load();
    }
  };

  const saveField = async (id: string, field: 'website_url' | 'api_base_url', value: string) => {
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
      <p className="text-xs text-mocha">
        الشبكات الوسيطة اللي ممكن برامج الأفيليت تُربط معها (Awin/CJ/Amazon/...) -- كودها (`code`) هو نفسه
        provider_code المستخدم بأدابتر المزوّد المطابق. 6 شبكات قياسية مزروعة مسبقاً؛ "تاجر مباشر" هو الافتراضي
        لأي برنامج بدون شبكة وسيطة (نفس نظام الأفيليت البسيط الحالي).
      </p>

      <div className="space-y-2">
        {rows.map((n) => {
          const expanded = expandedId === n.id;
          const meta = STATUS_META[n.status];
          return (
            <div key={n.id} className="overflow-hidden rounded-2xl border border-latte bg-white shadow-sm">
              <button onClick={() => setExpandedId(expanded ? null : n.id)} className="flex w-full items-center gap-3 p-3 text-right">
                <div className="flex-1">
                  <p className="font-medium text-ink">{n.name}</p>
                  <p dir="ltr" className="text-left text-xs text-mocha">
                    {n.code}
                  </p>
                </div>
                <span className="text-[11px] text-stone">{n.integration_type ?? '—'}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.className}`}>{meta.label}</span>
                <span className={`text-mocha transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
              </button>

              {expanded && (
                <div className="grid gap-3 border-t border-latte bg-paper/50 p-4 sm:grid-cols-2">
                  <div>
                    <SectionTitle>الحالة</SectionTitle>
                    <div className="flex gap-2">
                      {(['active', 'inactive', 'deprecated'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setStatus(n.id, s)}
                          className={`rounded-full border px-3 py-1.5 text-xs ${
                            n.status === s ? 'border-gold bg-gold text-white' : 'border-latte text-coffee'
                          }`}
                        >
                          {STATUS_META[s].label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Field label="رابط الموقع">
                      <input
                        defaultValue={n.website_url ?? ''}
                        onBlur={(e) => saveField(n.id, 'website_url', e.target.value)}
                        dir="ltr"
                        placeholder="https://..."
                        className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
                      />
                    </Field>
                    <Field label="رابط API الأساسي">
                      <input
                        defaultValue={n.api_base_url ?? ''}
                        onBlur={(e) => saveField(n.id, 'api_base_url', e.target.value)}
                        dir="ltr"
                        placeholder="https://api...."
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
