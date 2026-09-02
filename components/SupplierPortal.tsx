'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '@/lib/useAdminAuth';
import { uploadBusinessLogo } from '@/lib/logoUpload';
import { PortalShell } from '@/components/PortalShell';
import { OwnerProductsPanel } from '@/components/OwnerProductsPanel';
import { SUPPLIER_CATEGORIES } from '@/components/tabs/SuppliersTab';

type Supplier = {
  id: string;
  name: string;
  country: string;
  categories: string[];
  website: string;
  logo_url: string | null;
  is_verified: boolean;
  status: 'pending' | 'approved' | 'rejected';
};

const STATUS_LABEL: Record<Supplier['status'], string> = {
  pending: 'بانتظار المراجعة',
  approved: 'مقبول ✓',
  rejected: 'مرفوض',
};

export function SupplierPortal() {
  const { session, signOut } = useAdminAuth();
  const [supplier, setSupplier] = useState<Supplier | null | undefined>(undefined);
  const [website, setWebsite] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const load = async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from('suppliers')
      .select('id, name, country, categories, website, logo_url, is_verified, status')
      .eq('owner_id', session.user.id)
      .maybeSingle();
    setSupplier(data ?? null);
    setWebsite(data?.website ?? '');
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier) return;
    setSaving(true);
    setMessage(null);
    const { error } = await supabase
      .from('suppliers')
      .update({ website: website.trim() })
      .eq('id', supplier.id);
    setMessage(error ? 'صار خطأ، جرّب مرة ثانية' : 'تم الحفظ ✓');
    setSaving(false);
  };

  const toggleCategory = async (category: string) => {
    if (!supplier) return;
    const next = supplier.categories.includes(category)
      ? supplier.categories.filter((c) => c !== category)
      : [...supplier.categories, category];
    setSupplier({ ...supplier, categories: next });
    await supabase.from('suppliers').update({ categories: next }).eq('id', supplier.id);
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supplier) return;
    setUploadingLogo(true);
    const logoUrl = await uploadBusinessLogo('suppliers', supplier.id, file);
    if (logoUrl) setSupplier({ ...supplier, logo_url: logoUrl });
    setUploadingLogo(false);
  };

  return (
    <PortalShell
      subtitle="بوابة المورّد"
      title={supplier ? supplier.name : 'بوابة المورّد'}
      userLabel={session?.user.email}
      onSignOut={() => signOut()}
    >
        {supplier === undefined && <p className="text-mocha">تحميل...</p>}

        {supplier === null && (
          <div className="rounded-2xl border border-dashed border-stone bg-sand/40 p-6 text-center text-mocha">
            حسابك مو مربوط بأي مورّد بعد. تواصل مع فريق باريستا دروب عشان يربطون حسابك بشركتك.
          </div>
        )}

        {supplier && (
          <>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone">الملف الشخصي</p>
            <div className="mb-6 flex items-center gap-4 rounded-2xl border border-latte bg-paper p-5 shadow-sm">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-latte bg-sand">
                {supplier.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={supplier.logo_url} alt={supplier.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs text-stone">لا يوجد</span>
                )}
              </div>
              <div className="flex-1">
                <p className="font-[var(--font-el-messiri)] text-xl text-ink">{supplier.name}</p>
                <p className="text-sm text-mocha">{supplier.country}</p>
                <p className="mt-1 text-xs text-stone">
                  {supplier.is_verified ? 'مورّد موثّق ✓' : 'بانتظار التوثيق'} · {STATUS_LABEL[supplier.status]}
                </p>
                <label className="mt-2 inline-block cursor-pointer text-xs text-gold underline">
                  {uploadingLogo ? 'جاري الرفع...' : 'تغيير الشعار'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} disabled={uploadingLogo} />
                </label>
              </div>
            </div>

            <div className="mb-6 rounded-2xl border border-latte bg-paper p-5 shadow-sm">
              <p className="mb-1 font-[var(--font-el-messiri)] text-base text-ink">فئات منتجاتك</p>
              <p className="mb-3 text-xs text-mocha">اختر كل الفئات اللي تنطبق عليك -- تحدد صورة الخلفية اللي تظهر خلف بطاقتك بالتطبيق</p>
              <div className="flex flex-wrap gap-2">
                {SUPPLIER_CATEGORIES.map((c) => {
                  const active = supplier.categories.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCategory(c)}
                      className={`rounded-full border px-3 py-1.5 text-xs ${
                        active ? 'border-gold bg-gold text-on-gold' : 'border-latte text-coffee'
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleSave} className="rounded-2xl border border-latte bg-paper p-5 shadow-sm">
              <p className="mb-3 font-[var(--font-el-messiri)] text-base text-ink">تعديل رابط المتجر</p>
              {message && <p className="mb-3 rounded-lg bg-sand px-3 py-2 text-sm text-coffee">{message}</p>}
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://..."
                dir="ltr"
                className="w-full rounded-lg border border-latte bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
              />
              <button
                type="submit"
                disabled={saving}
                className="mt-3 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-on-gold disabled:opacity-50"
              >
                {saving ? '...' : 'حفظ'}
              </button>
            </form>

            <p className="mb-2 mt-6 text-xs font-medium uppercase tracking-wide text-stone">المنتجات</p>
            <OwnerProductsPanel ownerType="supplier" ownerId={supplier.id} />
          </>
        )}
    </PortalShell>
  );
}
