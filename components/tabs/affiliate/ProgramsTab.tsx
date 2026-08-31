'use client';

import { StatCardSkeletonGrid } from '@/components/ui/Skeleton';
import { memo, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { adminFetch, adminFetchJson } from '@/lib/adminApiClient';
import { Field, SectionTitle } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { AlertDialog } from '@/components/ui/AlertDialog';
import { useToast } from '@/components/ui/Toast';

const TRACKING_METHODS = [
  { value: 'redirect', label: 'redirect' },
  { value: 'pixel', label: 'pixel' },
  { value: 'coupon', label: 'coupon' },
  { value: 'api_only', label: 'api_only' },
];
const CONVERSION_METHODS = [
  { value: 'postback', label: 'postback' },
  { value: 'webhook', label: 'webhook' },
  { value: 'api', label: 'api' },
  { value: 'csv', label: 'csv' },
  { value: 'pixel', label: 'pixel' },
  { value: 'manual', label: 'manual' },
];

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
  external_program_id: string | null;
  affiliate_account_id: string | null;
  start_date: string | null;
  end_date: string | null;
  configuration: Record<string, unknown>;
  legacy_roaster_id: string | null;
  legacy_supplier_id: string | null;
};

type IntegrationRow = {
  id: string;
  affiliate_program_id: string;
  provider_code: string;
  status: 'active' | 'degraded' | 'disabled';
  configuration: Record<string, unknown>;
  last_sync_at: string | null;
  last_sync_error: string | null;
};

type CredentialRow = { id: string; credential_type: string; status: string; created_at: string; expires_at: string | null };

// status اختياري -- الشبكات/المحمصات/المورّدين ما لهم status نعرضه هنا،
// لكن التجّار (merchants) يرجعون status ونستبعد المؤرشفين من قوائم الاختيار (G-03).
type Option = { id: string; name: string; status?: string };

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

const emptyForm = {
  name: '',
  merchantId: '',
  networkId: '',
  commissionModel: 'percentage',
  currency: 'AED',
  trackingMethod: 'redirect',
  conversionMethod: 'postback',
  externalProgramId: '',
  affiliateAccountId: '',
  startDate: '',
  endDate: '',
};

function ProgramsTabImpl() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ProgramRow[] | null>(null);
  const [merchants, setMerchants] = useState<Option[]>([]);
  const [networks, setNetworks] = useState<Option[]>([]);
  const [roasters, setRoasters] = useState<Option[]>([]);
  const [suppliers, setSuppliers] = useState<Option[]>([]);
  const [integrations, setIntegrations] = useState<Record<string, IntegrationRow>>({});
  const [credentials, setCredentials] = useState<Record<string, CredentialRow[]>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [detailForm, setDetailForm] = useState<Record<string, Partial<ProgramRow> & { configurationText?: string }>>({});
  const [configError, setConfigError] = useState<Record<string, string>>({});
  const [savingDetail, setSavingDetail] = useState<string | null>(null);
  const [credForm, setCredForm] = useState<{ type: string; value: string }>({ type: CREDENTIAL_TYPES[0], value: '' });
  const [saving, setSaving] = useState(false);
  const [credMsg, setCredMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // G-01: تدوير/حذف بيانات الاعتماد
  const [rotatingCredId, setRotatingCredId] = useState<string | null>(null);
  const [rotateValue, setRotateValue] = useState('');
  const [credBusyId, setCredBusyId] = useState<string | null>(null);
  const [deleteCredId, setDeleteCredId] = useState<string | null>(null);
  // G-03: أرشفة البرنامج
  const [archiveProgramId, setArchiveProgramId] = useState<string | null>(null);
  // G-06: تأكيد نقل البرنامج لتاجر ثاني
  const [merchantChange, setMerchantChange] = useState<{ programId: string; newMerchantId: string; convCount: number; linkCount: number } | null>(null);

  const load = async () => {
    const [programsRes, merchantsRes, networksRes, { data: integ }, { data: roasterRows }, { data: supplierRows }] = await Promise.all([
      adminFetch(`${PROGRAMS_API}?limit=100`),
      adminFetch(`${MERCHANTS_API}?limit=100`),
      adminFetch(`${NETWORKS_API}?limit=100`),
      supabase
        .from('affiliate_provider_integrations')
        .select('id, affiliate_program_id, provider_code, status, configuration, last_sync_at, last_sync_error')
        .returns<IntegrationRow[]>(),
      supabase.from('roasters').select('id, name').order('name').returns<Option[]>(),
      supabase.from('suppliers').select('id, name').order('name').returns<Option[]>(),
    ]);
    const programsBody = await programsRes.json().catch(() => ({}));
    const merchantsBody = await merchantsRes.json().catch(() => ({}));
    const networksBody = await networksRes.json().catch(() => ({}));
    if (programsRes.ok) setRows(programsBody.data ?? []);
    else setError(programsBody.error ?? 'فشل تحميل البرامج');
    setMerchants(merchantsBody.data ?? []);
    setNetworks(networksBody.data ?? []);
    setRoasters(roasterRows ?? []);
    setSuppliers(supplierRows ?? []);
    const byProgram: Record<string, IntegrationRow> = {};
    for (const i of integ ?? []) byProgram[i.affiliate_program_id] = i;
    setIntegrations(byProgram);

    if (integ && integ.length > 0) {
      const { data: creds } = await supabase
        .from('affiliate_provider_credentials')
        .select('id, integration_id, credential_type, status, created_at, expires_at')
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
        tracking_method: form.trackingMethod,
        conversion_method: form.conversionMethod,
        external_program_id: form.externalProgramId.trim() || null,
        affiliate_account_id: form.affiliateAccountId.trim() || null,
        start_date: form.startDate || null,
        end_date: form.endDate || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setForm(emptyForm);
      setShowAdd(false);
      toast({ title: 'تم إنشاء البرنامج', variant: 'success' });
      load();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'فشل إنشاء البرنامج');
    }
  };

  const saveDetail = async (id: string) => {
    const patch = detailForm[id];
    if (!patch) return;
    const { configurationText, ...rest } = patch;
    const body: Record<string, unknown> = { ...rest };
    if (configurationText !== undefined) {
      try {
        body.configuration = configurationText.trim() ? JSON.parse(configurationText) : {};
        setConfigError((prev) => ({ ...prev, [id]: '' }));
      } catch {
        setConfigError((prev) => ({ ...prev, [id]: 'صيغة JSON غير صحيحة' }));
        return;
      }
    }
    setSavingDetail(id);
    const res = await adminFetchJson(`${PROGRAMS_API}?id=${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    setSavingDetail(null);
    if (res.ok) {
      toast({ title: 'تم الحفظ', variant: 'success' });
      setDetailForm((prev) => ({ ...prev, [id]: {} }));
      load();
    } else {
      const resBody = await res.json().catch(() => ({}));
      toast({ title: 'فشل الحفظ', description: resBody.error, variant: 'destructive' });
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

  // G-01: تدوير بيانة اعتماد -- تحذف القديمة وتدرج الجديدة (سيرفر).
  const rotateCredential = async (credId: string) => {
    if (!rotateValue.trim()) return;
    setCredBusyId(credId);
    const res = await adminFetchJson(`/api/admin/affiliate/credentials?id=${credId}`, {
      method: 'PATCH',
      body: JSON.stringify({ value: rotateValue.trim() }),
    });
    setCredBusyId(null);
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setRotatingCredId(null);
      setRotateValue('');
      toast({ title: 'تم تدوير البيانات', variant: 'success' });
      load();
    } else {
      toast({ title: 'فشل التدوير', description: body.error, variant: 'destructive' });
    }
  };

  // G-01: حذف (إلغاء) بيانة اعتماد.
  const deleteCredential = async (credId: string) => {
    setCredBusyId(credId);
    const res = await adminFetchJson(`/api/admin/affiliate/credentials?id=${credId}`, { method: 'DELETE' });
    setCredBusyId(null);
    setDeleteCredId(null);
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      toast({ title: 'تم حذف البيانات', variant: 'success' });
      if (body.remaining === 0) {
        toast({ title: 'تحذير: لا توجد بيانات اعتماد متبقية لهذا التكامل', variant: 'destructive' });
      }
      load();
    } else {
      toast({ title: 'فشل الحذف', description: body.error, variant: 'destructive' });
    }
  };

  // G-06: عند تغيير التاجر بقائمة التفاصيل، نجيب عدد التحويلات/الروابط المتأثرة
  // ونطلب تأكيد قبل الحفظ.
  const requestMerchantChange = async (programId: string, newMerchantId: string) => {
    const [{ count: convCount }, { count: linkCount }] = await Promise.all([
      supabase.from('affiliate_conversions').select('id', { count: 'exact', head: true }).eq('affiliate_program_id', programId),
      supabase.from('affiliate_links').select('id', { count: 'exact', head: true }).eq('affiliate_program_id', programId),
    ]);
    setMerchantChange({ programId, newMerchantId, convCount: convCount ?? 0, linkCount: linkCount ?? 0 });
  };

  const confirmMerchantChange = async () => {
    if (!merchantChange) return;
    const { programId, newMerchantId } = merchantChange;
    setMerchantChange(null);
    const res = await adminFetchJson(`${PROGRAMS_API}?id=${programId}`, { method: 'PATCH', body: JSON.stringify({ merchant_id: newMerchantId }) });
    if (res.ok) {
      toast({ title: 'تم نقل البرنامج للتاجر الجديد', variant: 'success' });
      load();
    } else {
      const body = await res.json().catch(() => ({}));
      toast({ title: 'فشل النقل', description: body.error, variant: 'destructive' });
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
          <Field label="طريقة التتبّع">
            <Select value={form.trackingMethod} onChange={(v) => setForm((f) => ({ ...f, trackingMethod: v }))} options={TRACKING_METHODS} />
          </Field>
          <Field label="طريقة التحويل">
            <Select value={form.conversionMethod} onChange={(v) => setForm((f) => ({ ...f, conversionMethod: v }))} options={CONVERSION_METHODS} />
          </Field>
          {form.networkId && (
            <>
              <Field label="معرّف البرنامج عند الشبكة" helper="external_program_id">
                <Input
                  dir="ltr"
                  value={form.externalProgramId}
                  onChange={(e) => setForm((f) => ({ ...f, externalProgramId: e.target.value }))}
                  className="h-8 text-xs"
                />
              </Field>
              <Field label="معرّف حسابنا لدى الشبكة" helper="affiliate_account_id">
                <Input
                  dir="ltr"
                  value={form.affiliateAccountId}
                  onChange={(e) => setForm((f) => ({ ...f, affiliateAccountId: e.target.value }))}
                  className="h-8 text-xs"
                />
              </Field>
            </>
          )}
          <Field label="تاريخ البداية (اختياري)">
            <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className="h-8 text-xs" />
          </Field>
          <Field label="تاريخ النهاية (اختياري)">
            <Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} className="h-8 text-xs" />
          </Field>
          <div className="sm:col-span-2">
            <Button onClick={createProgram} disabled={saving || !form.name.trim() || !form.merchantId} size="sm">
              {saving ? 'جاري الحفظ...' : 'إنشاء'}
            </Button>
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
                          onClick={() => (s === 'archived' ? setArchiveProgramId(p.id) : setStatus(p.id, s))}
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
                    <SectionTitle>حقول إضافية</SectionTitle>
                    <div className="grid gap-3 rounded-xl border border-latte bg-white p-3 sm:grid-cols-2">
                      <Field label="التاجر" helper="تغيير التاجر يؤثر على التحويلات والروابط المرتبطة">
                        <select
                          value={p.merchant_id}
                          onChange={(e) => e.target.value !== p.merchant_id && requestMerchantChange(p.id, e.target.value)}
                          className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
                        >
                          {merchants
                            .filter((m) => m.status !== 'archived' || m.id === p.merchant_id) // G-03: استبعاد المؤرشفين (إلا الحالي)
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                        </select>
                      </Field>
                      <Field label="معرّف البرنامج عند الشبكة">
                        <Input
                          dir="ltr"
                          className="h-8 text-xs"
                          defaultValue={p.external_program_id ?? ''}
                          onChange={(e) => setDetailForm((f) => ({ ...f, [p.id]: { ...f[p.id], external_program_id: e.target.value || null } }))}
                        />
                      </Field>
                      <Field label="معرّف حسابنا لدى الشبكة">
                        <Input
                          dir="ltr"
                          className="h-8 text-xs"
                          defaultValue={p.affiliate_account_id ?? ''}
                          onChange={(e) => setDetailForm((f) => ({ ...f, [p.id]: { ...f[p.id], affiliate_account_id: e.target.value || null } }))}
                        />
                      </Field>
                      <Field label="تاريخ البداية">
                        <Input
                          type="date"
                          className="h-8 text-xs"
                          defaultValue={p.start_date ?? ''}
                          onChange={(e) => setDetailForm((f) => ({ ...f, [p.id]: { ...f[p.id], start_date: e.target.value || null } }))}
                        />
                      </Field>
                      <Field label="تاريخ النهاية">
                        <Input
                          type="date"
                          className="h-8 text-xs"
                          defaultValue={p.end_date ?? ''}
                          onChange={(e) => setDetailForm((f) => ({ ...f, [p.id]: { ...f[p.id], end_date: e.target.value || null } }))}
                        />
                      </Field>
                      <Field label="محمصة قديمة مرتبطة (legacy)">
                        <select
                          defaultValue={p.legacy_roaster_id ?? ''}
                          onChange={(e) => setDetailForm((f) => ({ ...f, [p.id]: { ...f[p.id], legacy_roaster_id: e.target.value || null } }))}
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
                      <Field label="مورد قديم مرتبط (legacy)">
                        <select
                          defaultValue={p.legacy_supplier_id ?? ''}
                          onChange={(e) => setDetailForm((f) => ({ ...f, [p.id]: { ...f[p.id], legacy_supplier_id: e.target.value || null } }))}
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
                        <Field label="الإعدادات (configuration JSON)" helper={configError[p.id] || undefined}>
                          <Textarea
                            dir="ltr"
                            rows={4}
                            className="font-mono text-xs"
                            error={configError[p.id]}
                            defaultValue={JSON.stringify(p.configuration ?? {}, null, 2)}
                            onChange={(e) => setDetailForm((f) => ({ ...f, [p.id]: { ...f[p.id], configurationText: e.target.value } }))}
                          />
                        </Field>
                      </div>
                      <div className="sm:col-span-2">
                        <Button size="sm" onClick={() => saveDetail(p.id)} disabled={savingDetail === p.id || !detailForm[p.id]}>
                          {savingDetail === p.id ? 'جاري الحفظ...' : 'حفظ الحقول الإضافية'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <SectionTitle>ربط أدابتر المزوّد</SectionTitle>
                    {integration ? (
                      <div className="space-y-3 rounded-xl border border-latte bg-white p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs text-coffee">
                            مربوط بأدابتر <strong>{integration.provider_code}</strong>
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              integration.status === 'active'
                                ? 'bg-success-bg text-success'
                                : integration.status === 'degraded'
                                  ? 'bg-warning-bg text-warning'
                                  : 'bg-danger-bg text-danger'
                            }`}
                          >
                            {integration.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-mocha">
                          {integration.last_sync_at ? `آخر مزامنة: ${new Date(integration.last_sync_at).toLocaleString('ar')}` : 'لم تتم مزامنة بعد'}
                        </p>
                        {integration.last_sync_error && (
                          <p className="rounded-lg bg-danger-bg px-2 py-1 text-[11px] text-danger">{integration.last_sync_error}</p>
                        )}
                        {integration.configuration && Object.keys(integration.configuration).length > 0 && (
                          <details className="text-[11px] text-mocha">
                            <summary className="cursor-pointer font-semibold text-stone">الإعدادات (configuration)</summary>
                            <pre dir="ltr" className="mt-1 overflow-x-auto rounded-lg bg-sand/50 p-2 text-[10px]">
                              {JSON.stringify(integration.configuration, null, 2)}
                            </pre>
                          </details>
                        )}
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
                            <div className="flex flex-col gap-1.5">
                              {(credentials[integration.id] ?? []).map((c) => {
                                const expiresAt = c.expires_at ? new Date(c.expires_at) : null;
                                const daysLeft = expiresAt ? (expiresAt.getTime() - Date.now()) / 86400000 : null;
                                const expiryBadge =
                                  daysLeft === null ? null : daysLeft < 0 ? (
                                    <span className="rounded-full bg-danger-bg px-1.5 py-0.5 text-[9px] text-danger">
                                      منتهي {expiresAt!.toLocaleDateString('ar')}
                                    </span>
                                  ) : daysLeft <= 30 ? (
                                    <span className="rounded-full bg-warning-bg px-1.5 py-0.5 text-[9px] text-warning">
                                      ينتهي {expiresAt!.toLocaleDateString('ar')}
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-success-bg px-1.5 py-0.5 text-[9px] text-success">✓</span>
                                  );

                                if (rotatingCredId === c.id) {
                                  return (
                                    <div key={c.id} className="flex flex-wrap items-center gap-1.5">
                                      <span className="text-[10px] text-mocha">{c.credential_type}:</span>
                                      <input
                                        value={rotateValue}
                                        onChange={(e) => setRotateValue(e.target.value)}
                                        type="password"
                                        dir="ltr"
                                        placeholder="القيمة الجديدة"
                                        className="min-w-[160px] flex-1 rounded-lg border border-latte bg-white px-2 py-1 text-[11px] outline-none focus:border-gold"
                                      />
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 px-2 text-[9px]"
                                        disabled={credBusyId === c.id || !rotateValue.trim()}
                                        onClick={() => rotateCredential(c.id)}
                                      >
                                        {credBusyId === c.id ? '...' : 'حفظ'}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 px-2 text-[9px]"
                                        onClick={() => {
                                          setRotatingCredId(null);
                                          setRotateValue('');
                                        }}
                                      >
                                        إلغاء
                                      </Button>
                                    </div>
                                  );
                                }

                                return (
                                  <div key={c.id} className="flex items-center gap-1.5">
                                    <span
                                      title={`أضيف: ${new Date(c.created_at).toLocaleDateString('ar')}`}
                                      className="inline-flex items-center gap-1 rounded-full bg-sand px-2 py-0.5 text-[10px] text-coffee"
                                    >
                                      {c.credential_type} ✓ {expiryBadge}
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-2 text-[9px]"
                                      onClick={() => {
                                        setRotatingCredId(c.id);
                                        setRotateValue('');
                                      }}
                                    >
                                      تدوير
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-2 text-[9px] text-danger"
                                      onClick={() => setDeleteCredId(c.id)}
                                    >
                                      حذف
                                    </Button>
                                  </div>
                                );
                              })}
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

      <AlertDialog
        open={deleteCredId !== null}
        title="حذف بيانات الاعتماد"
        description="هل أنت متأكد؟ سيتم حذف بيانة الاعتماد نهائياً. لن يتمكن النظام من مزامنة التحويلات حتى إضافة بديل."
        confirmLabel="حذف"
        destructive
        onConfirm={() => deleteCredId && deleteCredential(deleteCredId)}
        onCancel={() => setDeleteCredId(null)}
      />

      <AlertDialog
        open={archiveProgramId !== null}
        title="أرشفة البرنامج"
        description={`سيتم أرشفة البرنامج "${rows.find((r) => r.id === archiveProgramId)?.name ?? ''}". لن يظهر في القوائم المنسدلة، والتحويلات والروابط المرتبطة ستتأثر. البيانات محفوظة.`}
        confirmLabel="أرشفة"
        destructive={false}
        onConfirm={() => {
          if (archiveProgramId) setStatus(archiveProgramId, 'archived');
          setArchiveProgramId(null);
        }}
        onCancel={() => setArchiveProgramId(null)}
      />

      <AlertDialog
        open={merchantChange !== null}
        title="تغيير تاجر البرنامج"
        description={
          merchantChange
            ? `تغيير التاجر سيؤثر على ${merchantChange.convCount} تحويل و${merchantChange.linkCount} رابط مرتبط. هل أنت متأكد؟`
            : ''
        }
        confirmLabel="تأكيد النقل"
        destructive={false}
        onConfirm={confirmMerchantChange}
        onCancel={() => setMerchantChange(null)}
      />
    </div>
  );
}

export const ProgramsTab = memo(ProgramsTabImpl);
