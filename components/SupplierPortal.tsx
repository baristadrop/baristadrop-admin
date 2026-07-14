'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '@/lib/useAdminAuth';

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

  return (
    <div className="min-h-screen">
      <header className="border-b border-latte bg-cream/90 px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <h1 className="font-[var(--font-cormorant)] text-2xl font-bold text-ink">
            BARISTA DROP <span className="text-base font-normal text-mocha">· بوابة المورّد</span>
          </h1>
          <button
            onClick={() => signOut()}
            className="rounded-full border border-latte px-3 py-1.5 text-sm text-coffee hover:bg-sand"
          >
            تسجيل خروج
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {supplier === undefined && <p className="text-mocha">تحميل...</p>}

        {supplier === null && (
          <div className="rounded-2xl border border-dashed border-stone bg-sand/40 p-6 text-center text-mocha">
            حسابك مو مربوط بأي مورّد بعد. تواصل مع فريق باريستا دروب عشان يربطون حسابك بشركتك.
          </div>
        )}

        {supplier && (
          <>
            <div className="mb-6 rounded-2xl border border-latte bg-white p-5">
              <p className="font-[var(--font-el-messiri)] text-xl text-ink">{supplier.name}</p>
              <p className="text-sm text-mocha">
                {supplier.country} · {supplier.categories.join('، ')}
              </p>
              <p className="mt-1 text-xs text-stone">
                {supplier.is_verified ? 'مورّد موثّق ✓' : 'بانتظار التوثيق'} ·{' '}
                {STATUS_LABEL[supplier.status]}
              </p>
            </div>

            <form onSubmit={handleSave} className="rounded-2xl border border-latte bg-white p-5">
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
                className="mt-3 rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-cream disabled:opacity-50"
              >
                {saving ? '...' : 'حفظ'}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
