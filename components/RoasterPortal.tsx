'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '@/lib/useAdminAuth';
import { uploadBusinessLogo } from '@/lib/logoUpload';
import { DirhamIcon } from '@/components/icons/DirhamIcon';
import { PortalShell } from '@/components/PortalShell';

type Roaster = {
  id: string;
  name: string;
  country: string;
  is_verified: boolean;
  logo_url: string | null;
};

type Bean = {
  id: string;
  name: string;
  origin: string | null;
  process: string | null;
  flavor_notes: string[] | null;
  price: number | null;
  status: 'pending' | 'approved' | 'rejected';
  avg_rating: number;
  reviews_count: number;
};

export function RoasterPortal() {
  const { session, signOut } = useAdminAuth();
  const [roaster, setRoaster] = useState<Roaster | null | undefined>(undefined);
  const [beans, setBeans] = useState<Bean[]>([]);
  const [name, setName] = useState('');
  const [origin, setOrigin] = useState('');
  const [process, setProcess] = useState('');
  const [flavorNotes, setFlavorNotes] = useState('');
  const [price, setPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const load = async () => {
    if (!session?.user) return;
    const { data: r } = await supabase
      .from('roasters')
      .select('id, name, country, is_verified, logo_url')
      .eq('owner_id', session.user.id)
      .maybeSingle();
    setRoaster(r ?? null);

    if (r) {
      const { data: b } = await supabase
        .from('beans')
        .select('id, name, origin, process, flavor_notes, price, status, avg_rating, reviews_count')
        .eq('roaster_id', r.id)
        .order('created_at', { ascending: false })
        .returns<Bean[]>();
      setBeans(b ?? []);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  const handleAddBean = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roaster) return;
    setSubmitting(true);
    setMessage(null);
    const notes = flavorNotes
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);
    const { error } = await supabase.from('beans').insert({
      roaster_id: roaster.id,
      name: name.trim(),
      origin: origin.trim() || null,
      process: process.trim() || null,
      flavor_notes: notes,
      price: price.trim() ? Number(price) : null,
      status: 'pending',
    });
    if (error) {
      setMessage('صار خطأ، جرّب مرة ثانية');
    } else {
      setName('');
      setOrigin('');
      setProcess('');
      setFlavorNotes('');
      setPrice('');
      setMessage('تم إرسال المحصول للمراجعة ✓');
      load();
    }
    setSubmitting(false);
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !roaster) return;
    setUploadingLogo(true);
    const logoUrl = await uploadBusinessLogo('roasters', roaster.id, file);
    if (logoUrl) setRoaster({ ...roaster, logo_url: logoUrl });
    setUploadingLogo(false);
  };

  const STATUS_LABEL: Record<Bean['status'], string> = {
    pending: 'بانتظار المراجعة',
    approved: 'مقبول ✓',
    rejected: 'مرفوض',
  };

  return (
    <PortalShell
      subtitle="بوابة المحمصة"
      title={roaster ? roaster.name : 'بوابة المحمصة'}
      userLabel={session?.user.email}
      onSignOut={() => signOut()}
    >
        {roaster === undefined && <p className="text-mocha">تحميل...</p>}

        {roaster === null && (
          <div className="rounded-2xl border border-dashed border-stone bg-sand/40 p-6 text-center text-mocha">
            حسابك مو مربوط بأي محمصة بعد. تواصل مع فريق باريستا دروب عشان يربطون حسابك بمحمصتك.
          </div>
        )}

        {roaster && (
          <>
            <div className="mb-6 flex items-center gap-4 rounded-2xl border border-latte bg-white p-5 shadow-sm">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-latte bg-sand">
                {roaster.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={roaster.logo_url} alt={roaster.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs text-stone">لا يوجد</span>
                )}
              </div>
              <div className="flex-1">
                <p className="font-[var(--font-el-messiri)] text-xl text-ink">{roaster.name}</p>
                <p className="text-sm text-mocha">
                  {roaster.country} {roaster.is_verified ? '· محمصة موثّقة ✓' : '· بانتظار التوثيق'}
                </p>
                <label className="mt-2 inline-block cursor-pointer text-xs text-gold underline">
                  {uploadingLogo ? 'جاري الرفع...' : 'تغيير الشعار'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} disabled={uploadingLogo} />
                </label>
              </div>
            </div>

            <form onSubmit={handleAddBean} className="mb-6 rounded-2xl border border-latte bg-white p-5 shadow-sm">
              <p className="mb-3 font-[var(--font-el-messiri)] text-base text-ink">أضف محصول جديد</p>
              {message && <p className="mb-3 rounded-lg bg-sand px-3 py-2 text-sm text-coffee">{message}</p>}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="اسم المحصول"
                  required
                  className="rounded-lg border border-latte bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
                />
                <input
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="المنشأ (مثال: إثيوبيا · قيدب)"
                  className="rounded-lg border border-latte bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
                />
                <input
                  value={process}
                  onChange={(e) => setProcess(e.target.value)}
                  placeholder="المعالجة (مغسولة / طبيعية / عسلية)"
                  className="rounded-lg border border-latte bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
                />
                <input
                  value={flavorNotes}
                  onChange={(e) => setFlavorNotes(e.target.value)}
                  placeholder="نكهات القهوة (افصل بينها بفاصلة: توت، شوكولاتة، حمضيات)"
                  className="rounded-lg border border-latte bg-paper px-3 py-2 text-sm outline-none focus:border-gold sm:col-span-2"
                />
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="السعر (د.إ)"
                  type="number"
                  className="rounded-lg border border-latte bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
                />
              </div>
              <button
                type="submit"
                disabled={submitting || !name.trim()}
                className="mt-3 rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-cream disabled:opacity-50"
              >
                {submitting ? '...' : 'إرسال للمراجعة'}
              </button>
            </form>

            <p className="mb-3 font-[var(--font-el-messiri)] text-base text-ink">محاصيلك</p>
            <div className="overflow-hidden rounded-2xl border border-latte bg-white shadow-sm">
              {beans.length === 0 && <p className="p-4 text-sm text-mocha">ما أضفت أي محصول بعد.</p>}
              {beans.map((b) => (
                <div key={b.id} className="flex items-center justify-between border-b border-latte/60 p-4 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-ink">{b.name}</p>
                    <p className="inline-flex flex-wrap items-center gap-1 text-xs text-mocha">
                      <span>{b.origin}</span>
                      {b.process && <span>· {b.process}</span>}
                      {b.price != null && (
                        <span className="inline-flex items-center gap-1">
                          · {b.price} <DirhamIcon />
                        </span>
                      )}
                    </p>
                    {b.flavor_notes && b.flavor_notes.length > 0 && (
                      <p className="mt-1 flex flex-wrap gap-1">
                        {b.flavor_notes.map((n) => (
                          <span key={n} className="rounded-full bg-sand px-2 py-0.5 text-xs text-coffee">
                            {n}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-stone">{STATUS_LABEL[b.status]}</p>
                    {b.reviews_count > 0 && (
                      <p className="text-xs text-gold">★ {b.avg_rating.toFixed(1)} ({b.reviews_count})</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
    </PortalShell>
  );
}
