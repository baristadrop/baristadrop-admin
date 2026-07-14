'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '@/lib/useAdminAuth';

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
  const [price, setPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
        .select('id, name, origin, process, price, status, avg_rating, reviews_count')
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
    const { error } = await supabase.from('beans').insert({
      roaster_id: roaster.id,
      name: name.trim(),
      origin: origin.trim() || null,
      process: process.trim() || null,
      price: price.trim() ? Number(price) : null,
      status: 'pending',
    });
    if (error) {
      setMessage('صار خطأ، جرّب مرة ثانية');
    } else {
      setName('');
      setOrigin('');
      setProcess('');
      setPrice('');
      setMessage('تم إرسال المحصول للمراجعة ✓');
      load();
    }
    setSubmitting(false);
  };

  const STATUS_LABEL: Record<Bean['status'], string> = {
    pending: 'بانتظار المراجعة',
    approved: 'مقبول ✓',
    rejected: 'مرفوض',
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-latte bg-cream/90 px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <h1 className="font-[var(--font-cormorant)] text-2xl font-bold text-ink">
            BARISTA DROP <span className="text-base font-normal text-mocha">· بوابة المحمصة</span>
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
        {roaster === undefined && <p className="text-mocha">تحميل...</p>}

        {roaster === null && (
          <div className="rounded-2xl border border-dashed border-stone bg-sand/40 p-6 text-center text-mocha">
            حسابك مو مربوط بأي محمصة بعد. تواصل مع فريق باريستا دروب عشان يربطون حسابك بمحمصتك.
          </div>
        )}

        {roaster && (
          <>
            <div className="mb-6 rounded-2xl border border-latte bg-white p-5">
              <p className="font-[var(--font-el-messiri)] text-xl text-ink">{roaster.name}</p>
              <p className="text-sm text-mocha">
                {roaster.country} {roaster.is_verified ? '· محمصة موثّقة ✓' : '· بانتظار التوثيق'}
              </p>
            </div>

            <form onSubmit={handleAddBean} className="mb-6 rounded-2xl border border-latte bg-white p-5">
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
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="السعر (ر.س)"
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
            <div className="overflow-hidden rounded-2xl border border-latte bg-white">
              {beans.length === 0 && <p className="p-4 text-sm text-mocha">ما أضفت أي محصول بعد.</p>}
              {beans.map((b) => (
                <div key={b.id} className="flex items-center justify-between border-b border-latte/60 p-4 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-ink">{b.name}</p>
                    <p className="text-xs text-mocha">
                      {b.origin} {b.process ? `· ${b.process}` : ''} {b.price ? `· ${b.price} ر.س` : ''}
                    </p>
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
      </main>
    </div>
  );
}
