'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '@/lib/useAdminAuth';

type Cafe = {
  id: string;
  name: string;
  country: string;
  location: string | null;
  is_verified: boolean;
  status: 'pending' | 'approved' | 'rejected';
  supplying_roaster: { name: string } | null;
};

const STATUS_LABEL: Record<Cafe['status'], string> = {
  pending: 'بانتظار المراجعة',
  approved: 'مقبول ✓',
  rejected: 'مرفوض',
};

export function CafePortal() {
  const { session, signOut } = useAdminAuth();
  const [cafe, setCafe] = useState<Cafe | null | undefined>(undefined);
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from('cafes')
      .select('id, name, country, location, is_verified, status, supplying_roaster:supplying_roaster_id ( name )')
      .eq('owner_id', session.user.id)
      .maybeSingle();
    setCafe((data as unknown as Cafe) ?? null);
    setLocation(data?.location ?? '');
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cafe) return;
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.from('cafes').update({ location: location.trim() || null }).eq('id', cafe.id);
    setMessage(error ? 'صار خطأ، جرّب مرة ثانية' : 'تم الحفظ ✓');
    setSaving(false);
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-latte bg-cream/90 px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <h1 className="font-[var(--font-cormorant)] text-2xl font-bold text-ink">
            BARISTA DROP <span className="text-base font-normal text-mocha">· بوابة الكوفي شوب</span>
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
        {cafe === undefined && <p className="text-mocha">تحميل...</p>}

        {cafe === null && (
          <div className="rounded-2xl border border-dashed border-stone bg-sand/40 p-6 text-center text-mocha">
            حسابك مو مربوط بأي كوفي شوب بعد. تواصل مع فريق باريستا دروب عشان يربطون حسابك بمحلك.
          </div>
        )}

        {cafe && (
          <>
            <div className="mb-6 rounded-2xl border border-latte bg-white p-5">
              <p className="font-[var(--font-el-messiri)] text-xl text-ink">{cafe.name}</p>
              <p className="text-sm text-mocha">{cafe.country}</p>
              <p className="mt-1 text-xs text-stone">
                {cafe.is_verified ? 'كوفي شوب موثّق ✓' : 'بانتظار التوثيق'} · {STATUS_LABEL[cafe.status]}
              </p>
              {cafe.supplying_roaster && (
                <p className="mt-2 inline-block rounded-full bg-sand px-3 py-1 text-xs text-coffee">
                  توردها: {cafe.supplying_roaster.name}
                </p>
              )}
            </div>

            <form onSubmit={handleSave} className="rounded-2xl border border-latte bg-white p-5">
              <p className="mb-3 font-[var(--font-el-messiri)] text-base text-ink">تعديل الموقع/العنوان</p>
              {message && <p className="mb-3 rounded-lg bg-sand px-3 py-2 text-sm text-coffee">{message}</p>}
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="مثال: دبي، الجميرا"
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
