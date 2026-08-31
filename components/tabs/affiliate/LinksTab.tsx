'use client';

import { StatCardSkeletonGrid } from '@/components/ui/Skeleton';
import { Fragment, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { adminFetch, adminFetchJson } from '@/lib/adminApiClient';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { AlertDialog } from '@/components/ui/AlertDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';

type LinkRow = {
  id: string;
  affiliate_program_id: string;
  product_id: string | null;
  name: string;
  destination_url: string;
  tracking_template: string | null;
  token: string;
  status: 'active' | 'paused' | 'expired';
  click_count?: number;
};

// status اختياري -- البرامج ترجعه ونستبعد المؤرشفة من قائمة الاختيار (G-03).
type Option = { id: string; name: string; status?: string };
type ProductOption = { id: string; name: string; external_url: string | null };

const GO_BASE_URL = 'https://admin.baristadrop.com/api/go';
const LINKS_API = '/api/admin/affiliate/links';
const PROGRAMS_API = '/api/admin/affiliate/programs';

const STATUS_META: Record<LinkRow['status'], { label: string; badge: BadgeVariant }> = {
  active: { label: 'نشط', badge: 'success' },
  paused: { label: 'موقوف', badge: 'warning' },
  expired: { label: 'منتهي', badge: 'danger' },
};

const emptyForm = { programId: '', name: '', destinationUrl: '', productId: '', trackingTemplate: '', token: '' };

type EditForm = { name: string; destination_url: string; product_id: string; tracking_template: string };

export function LinksTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<LinkRow[] | null>(null);
  const [programs, setPrograms] = useState<Option[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNoLinkProducts, setShowNoLinkProducts] = useState(false);
  // G-02: تعديل صف كامل
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  // G-04: حذف رابط
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    const [linksRes, programsRes, { data: productRows }] = await Promise.all([
      adminFetch(`${LINKS_API}?limit=100`),
      adminFetch(`${PROGRAMS_API}?limit=100`),
      supabase.from('products').select('id, name, external_url').eq('status', 'approved').eq('is_active', true).order('name').returns<ProductOption[]>(),
    ]);
    const linksBody = await linksRes.json().catch(() => ({}));
    const programsBody = await programsRes.json().catch(() => ({}));
    if (linksRes.ok) setRows(linksBody.data ?? []);
    else setError(linksBody.error ?? 'فشل تحميل الروابط');
    setPrograms(programsBody.data ?? []);
    setProducts(productRows ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const createLink = async () => {
    if (!form.programId || !form.name.trim() || !form.destinationUrl.trim()) return;
    setSaving(true);
    setError(null);
    const res = await adminFetchJson(LINKS_API, {
      method: 'POST',
      body: JSON.stringify({
        affiliate_program_id: form.programId,
        name: form.name.trim(),
        destination_url: form.destinationUrl.trim(),
        product_id: form.productId || null,
        tracking_template: form.trackingTemplate.trim() || null,
        token: form.token.trim() || undefined,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setForm(emptyForm);
      setShowAdd(false);
      toast({ title: 'تم إنشاء الرابط', variant: 'success' });
      load();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'فشل إنشاء الرابط');
    }
  };

  const setStatus = async (id: string, status: LinkRow['status']) => {
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, status } : r)) ?? null);
    const res = await adminFetchJson(`${LINKS_API}?id=${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'فشل تحديث الحالة');
      load();
    }
  };

  // G-02: فتح وضع التعديل لصف
  const startEdit = (l: LinkRow) => {
    setEditingId(l.id);
    setEditForm({
      name: l.name,
      destination_url: l.destination_url,
      product_id: l.product_id ?? '',
      tracking_template: l.tracking_template ?? '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const saveEdit = async () => {
    if (!editingId || !editForm) return;
    const dest = editForm.destination_url.trim();
    if (!editForm.name.trim() || !dest) {
      setError('الاسم ورابط الوجهة مطلوبان');
      return;
    }
    if (!/^https?:\/\//i.test(dest)) {
      setError('رابط الوجهة لازم يبدأ بـ http:// أو https://');
      return;
    }
    setSavingEdit(true);
    setError(null);
    const res = await adminFetchJson(`${LINKS_API}?id=${editingId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: editForm.name.trim(),
        destination_url: dest,
        product_id: editForm.product_id || null,
        tracking_template: editForm.tracking_template.trim() || null,
      }),
    });
    setSavingEdit(false);
    if (res.ok) {
      cancelEdit();
      toast({ title: 'تم حفظ التغييرات', variant: 'success' });
      load();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'فشل الحفظ');
    }
  };

  // G-04: حذف رابط نهائياً
  const deleteLink = async (id: string) => {
    setDeleteId(null);
    const res = await adminFetchJson(`${LINKS_API}?id=${id}`, { method: 'DELETE' });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      toast({ title: `تم حذف الرابط${body.clicksDeleted ? ` و${body.clicksDeleted} حدث نقر` : ''}`, variant: 'success' });
      load();
    } else {
      toast({ title: 'فشل حذف الرابط', description: body.error, variant: 'destructive' });
    }
  };

  const copyGoUrl = (id: string, token: string) => {
    navigator.clipboard.writeText(`${GO_BASE_URL}/${token}`).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((v) => (v === id ? null : v)), 1500);
    });
  };

  const linkedProductIds = new Set(rows?.map((r) => r.product_id).filter(Boolean));
  const productsWithoutLinks = products.filter((p) => !linkedProductIds.has(p.id));
  const activePrograms = programs.filter((p) => p.status !== 'archived'); // G-03

  const quickCreateFor = (product: ProductOption) => {
    setForm((f) => ({ ...f, productId: product.id, name: product.name, destinationUrl: product.external_url ?? f.destinationUrl }));
    setShowNoLinkProducts(false);
    setShowAdd(true);
  };

  const previewTemplate = form.trackingTemplate.trim()
    ? form.trackingTemplate
        .replaceAll('{token}', form.token.trim() || 'abc123')
        .replaceAll('{click_id}', 'CLICK_ID')
        .replaceAll('{program_id}', form.programId || 'PROGRAM_ID')
    : null;

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
        <p className="text-xs text-mocha">كل رابط له توكن فريد -- استخدم رابط /go/{'{token}'} بدل الرابط المباشر عشان يتسجّل الكليك والإحالة.</p>
        <Button size="sm" onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? 'إلغاء' : '+ رابط جديد'}
        </Button>
      </div>

      <div className="rounded-xl border border-dashed border-latte bg-sand/30 px-3 py-2 text-[11px] text-mocha">
        <div className="flex items-center justify-between gap-2">
          <span>ملاحظة: الروابط لا تتولد تلقائياً عند إضافة منتج. أنشئ رابط تتبع لكل منتج تريد تتبع إحالاته.</span>
          {productsWithoutLinks.length > 0 && (
            <Button size="sm" variant="link" onClick={() => setShowNoLinkProducts((v) => !v)}>
              {productsWithoutLinks.length} منتج بدون رابط
            </Button>
          )}
        </div>
        {showNoLinkProducts && (
          <div className="mt-2 space-y-1.5 border-t border-latte pt-2">
            {productsWithoutLinks.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg bg-white px-2 py-1.5">
                <span className="text-coffee">{p.name}</span>
                <Button size="sm" variant="outline" onClick={() => quickCreateFor(p)}>
                  إنشاء رابط
                </Button>
              </div>
            ))}
          </div>
        )}
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
              {activePrograms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="الاسم *">
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="h-8 text-xs" />
          </Field>
          <Field label="منتج مرتبط (اختياري)">
            <Select
              value={form.productId}
              onChange={(v) => {
                const p = products.find((pr) => pr.id === v);
                setForm((f) => ({ ...f, productId: v, destinationUrl: p?.external_url || f.destinationUrl }));
              }}
              options={[{ value: '', label: '— بدون منتج —' }, ...products.map((p) => ({ value: p.id, label: p.name }))]}
              className="h-8 text-xs"
            />
          </Field>
          <Field label="رابط الوجهة *" helper="الرابط الحقيقي لصفحة المنتج/المتجر -- يُملأ تلقائياً لو اخترت منتج">
            <Input
              value={form.destinationUrl}
              onChange={(e) => setForm((f) => ({ ...f, destinationUrl: e.target.value }))}
              dir="ltr"
              placeholder="https://..."
              className="h-8 text-xs"
            />
          </Field>
          <Field label="رمز مخصص (اختياري)" helper="16 حرف hex أو نص مخصص (6+ أحرف) -- يُستخدم في /go/{token}، فارغ = يتولّد تلقائياً">
            <Input value={form.token} onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))} dir="ltr" placeholder="my-campaign-2026" className="h-8 text-xs" />
          </Field>
          <Field label="قالب رابط التتبع (اختياري)" helper="placeholders: {token}, {click_id}, {program_id}">
            <Input
              value={form.trackingTemplate}
              onChange={(e) => setForm((f) => ({ ...f, trackingTemplate: e.target.value }))}
              dir="ltr"
              placeholder="https://merchant.com/go?ref={token}&subid={click_id}"
              className="h-8 text-xs"
            />
          </Field>
          {previewTemplate && (
            <p dir="ltr" className="break-all rounded-lg bg-white p-2 text-[11px] text-mocha sm:col-span-2">
              معاينة: {previewTemplate}
            </p>
          )}
          <div className="flex items-end">
            <Button size="sm" onClick={createLink} disabled={saving || !form.programId || !form.name.trim() || !form.destinationUrl.trim()}>
              {saving ? 'جاري الحفظ...' : 'إنشاء'}
            </Button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState title="ما فيه روابط بعد" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-latte bg-white shadow-sm">
          <table className="w-full min-w-[820px] text-right text-sm">
            <thead className="bg-sand/60 text-[11px] uppercase tracking-wide text-mocha">
              <tr>
                <th className="px-3 py-2">الاسم</th>
                <th className="px-3 py-2">البرنامج</th>
                <th className="px-3 py-2">المنتج</th>
                <th className="px-3 py-2">كليكات</th>
                <th className="px-3 py-2">الحالة</th>
                <th className="px-3 py-2">رابط /go</th>
                <th className="px-3 py-2">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const isEditing = editingId === l.id;
                return (
                  <Fragment key={l.id}>
                    <tr className="border-t border-latte">
                      <td className="px-3 py-2 font-medium text-ink">{l.name}</td>
                      <td className="px-3 py-2 text-xs text-mocha">{programs.find((p) => p.id === l.affiliate_program_id)?.name ?? '—'}</td>
                      <td className="px-3 py-2 text-xs text-mocha">{products.find((p) => p.id === l.product_id)?.name ?? '—'}</td>
                      <td className="px-3 py-2 font-[var(--font-el-messiri)] tabular-nums text-coffee">{l.click_count ?? 0}</td>
                      <td className="px-3 py-2">
                        <Select
                          value={l.status}
                          onChange={(v) => setStatus(l.id, v as LinkRow['status'])}
                          options={Object.entries(STATUS_META).map(([v, m]) => ({ value: v, label: m.label }))}
                          className="h-7 w-28 border-0 bg-transparent px-2 text-[10px] font-medium"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Button size="sm" variant="link" onClick={() => copyGoUrl(l.id, l.token)}>
                          {copiedId === l.id ? 'تم النسخ ✓' : 'نسخ الرابط'}
                        </Button>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => (isEditing ? cancelEdit() : startEdit(l))}>
                            {isEditing ? 'إغلاق' : 'تعديل'}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] text-danger" onClick={() => setDeleteId(l.id)}>
                            حذف
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {isEditing && editForm && (
                      <tr className="border-t border-latte bg-paper/50">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="الاسم *">
                              <Input value={editForm.name} onChange={(e) => setEditForm((f) => f && { ...f, name: e.target.value })} className="h-8 text-xs" />
                            </Field>
                            <Field label="منتج مرتبط">
                              <select
                                value={editForm.product_id}
                                onChange={(e) => {
                                  const p = products.find((pr) => pr.id === e.target.value);
                                  setEditForm((f) => f && { ...f, product_id: e.target.value, destination_url: p?.external_url || f.destination_url });
                                }}
                                className="w-full rounded-lg border border-latte bg-white px-2 py-1.5 text-xs outline-none focus:border-gold"
                              >
                                <option value="">— بدون منتج —</option>
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label="رابط الوجهة *" helper="يبدأ بـ http:// أو https:// -- يُملأ تلقائياً لو غيّرت المنتج">
                              <Input
                                value={editForm.destination_url}
                                onChange={(e) => setEditForm((f) => f && { ...f, destination_url: e.target.value })}
                                dir="ltr"
                                className="h-8 text-xs"
                              />
                            </Field>
                            <Field label="قالب رابط التتبع" helper="placeholders: {token}, {click_id}, {program_id}">
                              <Input
                                value={editForm.tracking_template}
                                onChange={(e) => setEditForm((f) => f && { ...f, tracking_template: e.target.value })}
                                dir="ltr"
                                className="h-8 text-xs"
                              />
                            </Field>
                            <p className="text-[11px] text-stone sm:col-span-2">التوكن في /go/{'{token}'} لا يتغيّر عند التعديل.</p>
                            <div className="flex gap-2 sm:col-span-2">
                              <Button size="sm" onClick={saveEdit} disabled={savingEdit}>
                                {savingEdit ? 'جاري الحفظ...' : 'حفظ'}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={cancelEdit}>
                                إلغاء
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog
        open={deleteId !== null}
        title="حذف الرابط"
        description="سيتم حذف الرابط وجميع أحداث النقر المرتبطة. لا يمكن التراجع."
        confirmLabel="حذف"
        destructive
        onConfirm={() => deleteId && deleteLink(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
