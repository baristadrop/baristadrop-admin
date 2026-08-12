'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '@/lib/useAdminAuth';
import { uploadBusinessLogo } from '@/lib/logoUpload';
import { DirhamIcon } from '@/components/icons/DirhamIcon';
import { PortalShell } from '@/components/PortalShell';
import { OwnerProductsPanel } from '@/components/OwnerProductsPanel';

type Business = {
  id: string;
  name: string;
  country: string;
  business_type: 'roaster' | 'cafe';
  location: string | null;
  is_verified: boolean;
  status: 'pending' | 'approved' | 'rejected';
  logo_url: string | null;
  bean_limit: number;
  supplying_roaster_id: string | null;
  supplying_roaster: { name: string } | null;
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

type MenuBean = {
  id: string;
  name: string;
  status: 'pending' | 'approved' | 'rejected';
};

const STATUS_LABEL: Record<Bean['status'], string> = {
  pending: 'بانتظار المراجعة',
  approved: 'مقبول ✓',
  rejected: 'مرفوض',
};

const TYPE_LABEL: Record<Business['business_type'], string> = { roaster: 'محمصة', cafe: 'كوفي شوب' };

/** بوابة الشركة الموحّدة (محمصة أو كوفي شوب) -- دمج RoasterPortal وCafePortal
 * القديمين بعد توحيد الجدولين. business_type مجرد وسم عرض: أي شركة تقدر
 * تضيف محاصيلها المباشرة (كانت حصرية للمحامص)، وأيضاً (اختياري وإضافي، مو
 * بديل) تنسّق منيو من محاصيل شركة موردة ثانية لو مربوطة بواحدة. */
export function BusinessPortal() {
  const { session, signOut } = useAdminAuth();
  const [business, setBusiness] = useState<Business | null | undefined>(undefined);
  const [beans, setBeans] = useState<Bean[]>([]);
  const [name, setName] = useState('');
  const [origin, setOrigin] = useState('');
  const [process, setProcess] = useState('');
  const [flavorNotes, setFlavorNotes] = useState('');
  const [price, setPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [location, setLocation] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [menuBeans, setMenuBeans] = useState<MenuBean[]>([]);
  const [menuBeanIds, setMenuBeanIds] = useState<Set<string>>(new Set());

  const load = async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from('roasters')
      .select(
        'id, name, country, business_type, location, is_verified, status, logo_url, bean_limit, supplying_roaster_id, supplying_roaster:supplying_roaster_id ( name )'
      )
      .eq('owner_id', session.user.id)
      .maybeSingle();
    const b = (data as unknown as Business) ?? null;
    setBusiness(b);
    setLocation(b?.location ?? '');

    if (b) {
      const [{ data: beanRows }, { data: menuRows }, menuBeansRes] = await Promise.all([
        supabase
          .from('beans')
          .select('id, name, origin, process, flavor_notes, price, status, avg_rating, reviews_count')
          .eq('roaster_id', b.id)
          .order('created_at', { ascending: false })
          .returns<Bean[]>(),
        supabase.from('cafe_beans').select('bean_id').eq('cafe_id', b.id),
        b.supplying_roaster_id
          ? supabase.from('beans').select('id, name, status').eq('roaster_id', b.supplying_roaster_id).returns<MenuBean[]>()
          : Promise.resolve({ data: [] as MenuBean[] }),
      ]);
      setBeans(beanRows ?? []);
      setMenuBeanIds(new Set((menuRows ?? []).map((r) => r.bean_id as string)));
      setMenuBeans(menuBeansRes.data ?? []);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  const handleAddBean = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) return;
    setSubmitting(true);
    setMessage(null);
    const notes = flavorNotes
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);
    const { error } = await supabase.from('beans').insert({
      roaster_id: business.id,
      name: name.trim(),
      origin: origin.trim() || null,
      process: process.trim() || null,
      flavor_notes: notes,
      price: price.trim() ? Number(price) : null,
      status: 'pending',
    });
    if (error) {
      setMessage(
        error.message.includes('BEAN_LIMIT_REACHED')
          ? `وصلت للحد المسموح (${business.bean_limit} محاصيل). تواصل مع فريق باريستا دروب لزيادة الحد.`
          : 'صار خطأ، جرّب مرة ثانية'
      );
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
    if (!file || !business) return;
    setUploadingLogo(true);
    const logoUrl = await uploadBusinessLogo('roasters', business.id, file);
    if (logoUrl) setBusiness({ ...business, logo_url: logoUrl });
    setUploadingLogo(false);
  };

  const saveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) return;
    setSavingLocation(true);
    setLocationMessage(null);
    const { error } = await supabase.from('roasters').update({ location: location.trim() || null }).eq('id', business.id);
    setLocationMessage(error ? 'صار خطأ، جرّب مرة ثانية' : 'تم الحفظ ✓');
    setSavingLocation(false);
  };

  const toggleMenuBean = async (beanId: string) => {
    if (!business) return;
    const inMenu = menuBeanIds.has(beanId);
    const next = new Set(menuBeanIds);
    if (inMenu) {
      next.delete(beanId);
      await supabase.from('cafe_beans').delete().eq('cafe_id', business.id).eq('bean_id', beanId);
    } else {
      next.add(beanId);
      await supabase.from('cafe_beans').insert({ cafe_id: business.id, bean_id: beanId });
    }
    setMenuBeanIds(next);
  };

  return (
    <PortalShell
      subtitle={business ? `بوابة ${TYPE_LABEL[business.business_type]}` : 'بوابة الشركة'}
      title={business ? business.name : 'بوابة الشركة'}
      userLabel={session?.user.email}
      onSignOut={() => signOut()}
    >
        {business === undefined && <p className="text-mocha">تحميل...</p>}

        {business === null && (
          <div className="rounded-2xl border border-dashed border-stone bg-sand/40 p-6 text-center text-mocha">
            حسابك مو مربوط بأي شركة بعد. تواصل مع فريق باريستا دروب عشان يربطون حسابك بشركتك.
          </div>
        )}

        {business && (
          <>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone">الملف الشخصي</p>
            <div className="mb-6 flex items-center gap-4 rounded-2xl border border-latte bg-white p-5 shadow-sm">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-latte bg-sand">
                {business.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={business.logo_url} alt={business.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs text-stone">لا يوجد</span>
                )}
              </div>
              <div className="flex-1">
                <p className="font-[var(--font-el-messiri)] text-xl text-ink">{business.name}</p>
                <p className="text-sm text-mocha">
                  {business.country} · {TYPE_LABEL[business.business_type]}{' '}
                  {business.is_verified ? '· موثّقة ✓' : '· بانتظار التوثيق'}
                </p>
                {business.supplying_roaster && (
                  <p className="mt-1 inline-block rounded-full bg-sand px-3 py-1 text-xs text-coffee">
                    توردها: {business.supplying_roaster.name}
                  </p>
                )}
                <label className="mt-2 block cursor-pointer text-xs text-gold underline">
                  {uploadingLogo ? 'جاري الرفع...' : 'تغيير الشعار'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} disabled={uploadingLogo} />
                </label>
              </div>
            </div>

            <form onSubmit={saveLocation} className="mb-6 rounded-2xl border border-latte bg-white p-5 shadow-sm">
              <p className="mb-3 font-[var(--font-el-messiri)] text-base text-ink">تعديل الموقع/العنوان</p>
              {locationMessage && <p className="mb-3 rounded-lg bg-sand px-3 py-2 text-sm text-coffee">{locationMessage}</p>}
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="مثال: دبي، الجميرا"
                className="w-full rounded-lg border border-latte bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
              />
              <button
                type="submit"
                disabled={savingLocation}
                className="mt-3 rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-cream disabled:opacity-50"
              >
                {savingLocation ? '...' : 'حفظ'}
              </button>
            </form>

            <p className="mb-2 mt-2 text-xs font-medium uppercase tracking-wide text-stone">المحاصيل</p>
            <form onSubmit={handleAddBean} className="mb-6 rounded-2xl border border-latte bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-[var(--font-el-messiri)] text-base text-ink">أضف محصول جديد</p>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    beans.length >= business.bean_limit ? 'bg-red-100 text-red-700' : 'bg-sand text-mocha'
                  }`}
                >
                  {beans.length} / {business.bean_limit}
                </span>
              </div>
              {message && <p className="mb-3 rounded-lg bg-sand px-3 py-2 text-sm text-coffee">{message}</p>}
              {beans.length >= business.bean_limit && (
                <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  وصلت للحد المسموح بحسابك الحالي. تواصل مع فريق باريستا دروب لزيادة الحد.
                </p>
              )}
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
                disabled={submitting || !name.trim() || beans.length >= business.bean_limit}
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

            <p className="mb-2 mt-6 text-xs font-medium uppercase tracking-wide text-stone">منيو من شركة موردة</p>
            <div className="rounded-2xl border border-latte bg-white p-5 shadow-sm">
              <p className="mb-1 font-[var(--font-el-messiri)] text-base text-ink">منيو إضافي (اختياري)</p>
              <p className="mb-3 text-xs text-mocha">
                بجانب محاصيلك المباشرة فوق، تقدر تختار محاصيل جاهزة من شركة موردة تعرضها بمنيوك -- تواصل مع فريق
                باريستا دروب عشان يربطونك بشركة موردة.
              </p>
              {!business.supplying_roaster_id && (
                <p className="text-sm text-stone">حسابك مو مربوط بشركة موردة بعد.</p>
              )}
              {business.supplying_roaster_id && menuBeans.length === 0 && (
                <p className="text-sm text-stone">ما فيه محاصيل عند الشركة المورّدة بعد.</p>
              )}
              <div className="flex flex-col gap-2">
                {menuBeans.map((b) => (
                  <label key={b.id} className="flex items-center gap-2 rounded-lg border border-latte px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={menuBeanIds.has(b.id)}
                      onChange={() => toggleMenuBean(b.id)}
                      disabled={b.status !== 'approved'}
                    />
                    <span className="flex-1 text-ink">{b.name}</span>
                    {b.status !== 'approved' && <span className="text-xs text-stone">(بانتظار موافقة الأدمن)</span>}
                  </label>
                ))}
              </div>
            </div>

            <p className="mb-2 mt-6 text-xs font-medium uppercase tracking-wide text-stone">المنتجات</p>
            <OwnerProductsPanel ownerType="roaster" ownerId={business.id} />
          </>
        )}
    </PortalShell>
  );
}
