'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { adminFetch, adminFetchJson } from '@/lib/adminApiClient';
import { Field, SectionTitle } from '@/components/ui/Field';

const PROGRAMS_API = '/api/admin/affiliate/programs';
const MERCHANTS_API = '/api/admin/affiliate/merchants';
const NETWORKS_API = '/api/admin/affiliate/networks';

type ProgramRow = {
  id: string;
  name: string;
  merchant_id: string;
  network_id: string | null;
  tracking_method: string;
  conversion_method: string;
  commission_model: string;
  currency: string;
  status: 'active' | 'paused' | 'expired' | 'archived';
};

type IntegrationRow = {
  id: string;
  affiliate_program_id: string;
  provider_code: string;
  status: 'active' | 'degraded' | 'disabled';
  configuration: Record<string, unknown>;
};

type CredentialRow = { id: string; credential_type: string; status: string; created_at: string };

type Option = { id: string; name: string };

const PROVIDER_CODES = [
  { code: 'direct', label: 'تاجر مباشر (بدون شبكة وسيطة)' },
  { code: 'awin', label: 'Awin' },
  { code: 'cj', label: 'CJ' },
  { code: 'amazon', label: 'Amazon' },
];

const CREDENTIAL_TYPES = ['api_key', 'api_secret', 'affiliate_id', 'publisher_id', 'postback_secret', 'webhook_secret'];

const STATUS_META: Record<ProgramRow['status'], { label: string; className: string }> = {
  active: { label: 'نشط', className: 'bg-green-100 text-green-700' },
  paused: { label: 'موقوف مؤقتاً', className: 'bg-amber-100 text-amber-700' },
  expired: { label: 'منتهي', className: 'bg-red-100 text-red-700' },
  archived: { label: 'مؤرشف', className: 'bg-stone/20 text-stone' },
};

const emptyForm = { name: '', merchantId: '', networkId: '', commissionModel: 'percentage', currency: 'AED' };

export function ProgramsTab() {
  const [rows, setRows] = useState<ProgramRow[] | null>(null);
  const [merchants, setMerchants] = useState<Option[]>([]);
  const [networks, setNetworks] = useState<Option[]>([]);
  const [integrations, setIntegrations] = useState<Record<string, IntegrationRow>>({});
  const [credentials, setCredentials] = useState<Record<string, CredentialRow[]>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [credForm, setCredForm] = useState<{ type: string; value: string }>({ type: CREDENTIAL_TYPES[0], value: '' });
  const [saving, setSaving] = useState(false);
  const [credMsg, setCredMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [programsRes, merchantsRes, networksRes, { data: integ }] = await Promise.all([
      adminFetch(`${PROGRAMS_API}?limit=100`),
      adminFetch(`${MERCHANTS_API}?limit=100`),
      adminFetch(`${NETWORKS_API}?limit=100`),
      supabase.from('affiliate_provider_integrations').select('id, affiliate_program_id, provider_code, status, configuration').returns<IntegrationRow[]>(),
    ]);
    const programsBody = await programsRes.json().catch(() => ({}));
    const merchantsBody = await merchantsRes.json().catch(() => ({}));
    const networksBody = await networksRes.json().catch(() => ({}));
    if (programsRes.ok) setRows(programsBody.data ?? []);
    else setError(programsBody.error ?? 'فشل تحميل البرامج');
    setMerchants(merchantsBody.data ?? []);
    setNetworks(networksBody.data ?? []);
    const byProgram: Record<string, IntegrationRow> = {};
    for (const i of integ ?? []) byProgram[i.affiliate_program_id] = i;
    setIntegrations(byProgram);

    if (integ && integ.length > 0) {
      const { data: creds } = await supabase
        .from('affiliate_provider_credentials')
        .select('id, integration_id, credential_type, status, created_at')
        .in('integration_id', integ.map((i) => i.id));
      const byIntegration: Record<string, CredentialRow[]> = {};
      for (const c of creds ?? []) {
        (byIntegration[c.integration_id as unknown as string] ??= []).push(c as unknown as CredentialRow);
      }
      setCredentials(byIntegration);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createProgram = async () => {
    if (!form.name.trim() || !form.merchantId) return;
    setSaving(true);
    setError(null);
    const res = await adminFetchJson(PROGRAMS_API, {
      method: 'POST',
      body: JSON.stringify({
        name: form.name.trim(),
        merchant_id: form.merchantId,
        network_id: form.networkId || null,
        commission_model: form.commissionModel,
        currency: form.currency.trim() || 'AED',
      }),
    });
    setSaving(false);
    if (res.ok) {
      setForm(emptyForm);
      setShowAdd(false);
      load();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'فشل إنشاء البرنامج');
    }
  };

  const setStatus = async (id: string, status: ProgramRow['status']) => {
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, status } : r)) ?? null);
    const res = await adminFetchJson(`${PROGRAMS_API}?id=${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'فشل تحديث الحالة');
      load();
    }
  };

  const createIntegration = async (programId: string, providerCode: string) => {
    const { data } = await supabase
      .from('affiliate_provider_integrations')
      .insert({ affiliate_program_id: programId, provider_code: providerCode, configuration: { tracking: {} } })
      .select('id, affiliate_program_id, provider_code, status, configuration')
      .single();
    if (data) setIntegrations((prev) => ({ ...prev, [programId]: data as IntegrationRow }));
  };

  const addCredential = async (integrationId: string) => {
    if (!credForm.value.trim()) return;
    setCredMsg(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const res = await fetch('/api/admin/affiliate/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session?.access_token}` },
      body: JSON.stringify({ integrationId, credentialType: credForm.type, value: credForm.value.trim() }),
    });
    if (res.ok) {
      setCredForm({ type: CREDENTIAL_TYPES[0], value: '' });
      setCredMsg('تم الحفظ (مشفّر) ✓');
      load();
    } else {
      const body = await res.json().catch(() => ({}));
      setCredMsg(body.error ?? 'فشل الحفظ');
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
        <p className="text-xs text-mocha">البرنامج هو حدّ التكامل الفعلي: تاجر + شبكة (اختياري) + إعدادات تتبّع/تحويل/عمولة.</p>
        <button onClick={() => setShowAdd((v) => !v)} className="rounded-full bg-ink px-4 py-1.5 text-xs font-bold text-cream">
          {showAdd ? 'إلغاء' : '+ برنامج جديد'}
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
          <Field label="التاجر *">
            <select
              value={form.merchantId}
              onChange={(e) => setForm((f) => ({ ...f, merchantId: e.target.value }))}
              className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
            >
              <option value="">اختر...</option>
              {merchants.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="الشبكة (اختياري)">
            <select
              value={form.networkId}
              onChange={(e) => setForm((f) => ({ ...f, networkId: e.target.value }))}
              className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
            >
              <option value="">بدون (تاجر مباشر)</option>
              {networks.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="نموذج العمولة">
            <select
              value={form.commissionModel}
              onChange={(e) => setForm((f) => ({ ...f, commissionModel: e.target.value }))}
              className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
            >
              {['percentage', 'fixed', 'per_item', 'tiered', 'category', 'provider_reported'].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <button
              onClick={createProgram}
              disabled={saving || !form.name.trim() || !form.merchantId}
              className="rounded-full bg-gold px-5 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {saving ? 'جاري الحفظ...' : 'إنشاء'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {rows.length === 0 && !showAdd && <p className="p-6 text-center text-mocha">ما فيه برامج بعد.</p>}
        {rows.map((p) => {
          const expanded = expandedId === p.id;
          const meta = STATUS_META[p.status];
          const integration = integrations[p.id];
          const merchantName = merchants.find((m) => m.id === p.merchant_id)?.name ?? '—';
          return (
            <div key={p.id} className="overflow-hidden rounded-2xl border border-latte bg-white shadow-sm">
              <button onClick={() => setExpandedId(expanded ? null : p.id)} className="flex w-full items-center gap-3 p-3 text-right">
                <div className="flex-1">
                  <p className="font-medium text-ink">{p.name}</p>
                  <p className="text-xs text-mocha">{merchantName}</p>
                </div>
                {integration && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] text-blue-700">{integration.provider_code}</span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.className}`}>{meta.label}</span>
                <span className={`text-mocha transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
              </button>

              {expanded && (
                <div className="grid gap-4 border-t border-latte bg-paper/50 p-4 sm:grid-cols-2">
                  <div>
                    <SectionTitle>الحالة</SectionTitle>
                    <div className="flex flex-wrap gap-2">
                      {(['active', 'paused', 'expired', 'archived'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setStatus(p.id, s)}
                          className={`rounded-full border px-3 py-1.5 text-xs ${
                            p.status === s ? 'border-gold bg-gold text-white' : 'border-latte text-coffee'
                          }`}
                        >
                          {STATUS_META[s].label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 text-[11px] text-mocha">
                      {p.tracking_method} · {p.conversion_method} · {p.commission_model} · {p.currency}
                    </p>
                  </div>

                  <div className="sm:col-span-2">
                    <SectionTitle>ربط أدابتر المزوّد</SectionTitle>
                    {integration ? (
                      <div className="space-y-3 rounded-xl border border-latte bg-white p-3">
                        <p className="text-xs text-coffee">
                          مربوط بأدابتر <strong>{integration.provider_code}</strong>
                        </p>
                        {integration.provider_code !== 'direct' && (
                          <div className="space-y-2 border-t border-latte pt-3">
                            <p className="text-[11px] font-semibold text-stone">بيانات الاعتماد (مشفّرة)</p>
                            <div className="flex flex-wrap items-end gap-2">
                              <select
                                value={credForm.type}
                                onChange={(e) => setCredForm((f) => ({ ...f, type: e.target.value }))}
                                className="rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
                              >
                                {CREDENTIAL_TYPES.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                              <input
                                value={credForm.value}
                                onChange={(e) => setCredForm((f) => ({ ...f, value: e.target.value }))}
                                placeholder="القيمة السرية"
                                dir="ltr"
                                type="password"
                                className="min-w-[180px] flex-1 rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
                              />
                              <button
                                onClick={() => addCredential(integration.id)}
                                className="rounded-lg bg-ink px-3 py-1.5 text-xs text-cream"
                              >
                                حفظ
                              </button>
                            </div>
                            {credMsg && <p className="text-[11px] text-mocha">{credMsg}</p>}
                            <div className="flex flex-wrap gap-1.5">
                              {(credentials[integration.id] ?? []).map((c) => (
                                <span key={c.id} className="rounded-full bg-sand px-2 py-0.5 text-[10px] text-coffee">
                                  {c.credential_type} ✓
                                </span>
                              ))}
                              {(credentials[integration.id] ?? []).length === 0 && (
                                <span className="text-[11px] text-stone">ما فيه بيانات اعتماد محفوظة بعد</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {PROVIDER_CODES.map((pc) => (
                          <button
                            key={pc.code}
                            onClick={() => createIntegration(p.id, pc.code)}
                            className="rounded-full border border-latte px-3 py-1.5 text-xs text-coffee hover:border-gold"
                          >
                            {pc.label}
                          </button>
                        ))}
                      </div>
                    )}
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
