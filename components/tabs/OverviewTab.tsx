'use client';

import { StatCardSkeletonGrid } from '@/components/ui/Skeleton';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { TabKey } from '../Dashboard';
import { StatCard } from '@/components/ui/StatCard';

type Counts = {
  pendingRecipes: number;
  pendingBeans: number;
  pendingBusinesses: number;
  pendingSuppliers: number;
  pendingProducts: number;
  totalBusinesses: number;
  totalSuppliers: number;
  totalProfiles: number;
  activeSubscribers: number;
  totalOrders: number;
};

type Engagement = {
  affiliateClicks: number;
  subscriptionInterests: number;
};

type PostHogStats = {
  connected: boolean;
  uniqueVisitors30d: number;
  appOpens30d: number;
  newInstalls30d: number;
};

type ActivityItem = {
  id: string;
  kind: 'recipe' | 'bean' | 'business' | 'supplier' | 'product' | 'order' | 'subscriber';
  title: string;
  subtitle: string;
  createdAt: string;
  tab: TabKey;
};

type TopBean = {
  id: string;
  name: string;
  avg_rating: number;
  reviews_count: number;
  roasters: { name: string } | null;
};

const KIND_LABEL: Record<ActivityItem['kind'], string> = {
  recipe: 'وصفة جديدة',
  bean: 'محصول جديد',
  business: 'شركة جديدة',
  supplier: 'مورّد جديد',
  product: 'منتج جديد',
  order: 'طلب جديد',
  subscriber: 'اشتراك جديد',
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-xs font-semibold tracking-wide text-stone">{children}</p>;
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `قبل ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `قبل ${hours} س`;
  const days = Math.floor(hours / 24);
  return `قبل ${days} يوم`;
}

export function OverviewTab({ onNavigate }: { onNavigate: (tab: TabKey) => void }) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [ph, setPh] = useState<PostHogStats | null>(null);
  const [loadingPh, setLoadingPh] = useState(true);
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);
  const [topBeans, setTopBeans] = useState<TopBean[] | null>(null);

  useEffect(() => {
    const load = async () => {
      // طلب واحد بدل 12 طلب متزامن -- كانت تسبب أحياناً أخطاء 503 من تجاوز
      // حد اتصالات Supabase، بجانب إبطاء التحميل بدون داعٍ.
      const [{ data: statsRows }, sessionRes] = await Promise.all([
        supabase.rpc('get_overview_stats'),
        supabase.auth.getSession(),
      ]);
      const stats = (
        statsRows as
          | {
              pending_recipes: number;
              pending_beans: number;
              pending_businesses: number;
              pending_suppliers: number;
              pending_products: number;
              total_businesses: number;
              total_suppliers: number;
              total_profiles: number;
              active_subscribers: number;
              total_orders: number;
              affiliate_clicks: number;
              subscription_interests: number;
            }[]
          | null
      )?.[0];

      setCounts({
        pendingRecipes: stats?.pending_recipes ?? 0,
        pendingBeans: stats?.pending_beans ?? 0,
        pendingBusinesses: stats?.pending_businesses ?? 0,
        pendingSuppliers: stats?.pending_suppliers ?? 0,
        pendingProducts: stats?.pending_products ?? 0,
        totalBusinesses: stats?.total_businesses ?? 0,
        totalSuppliers: stats?.total_suppliers ?? 0,
        totalProfiles: stats?.total_profiles ?? 0,
        activeSubscribers: stats?.active_subscribers ?? 0,
        totalOrders: stats?.total_orders ?? 0,
      });

      setEngagement({
        affiliateClicks: stats?.affiliate_clicks ?? 0,
        subscriptionInterests: stats?.subscription_interests ?? 0,
      });

      const token = sessionRes.data.session?.access_token;
      if (token) {
        const phRes = await fetch('/api/admin/posthog-stats', { headers: { Authorization: `Bearer ${token}` } });
        if (phRes.ok) setPh(await phRes.json());
      }
      setLoadingPh(false);

      // آخر التحديثات — مصادر متعددة تندمج بقائمة واحدة مرتبة بالوقت، عشان
      // يشوف الأدمن كل جديد بنظرة وحدة بدون ما يفتح كل تبويب لحاله.
      const [latestRecipes, latestBeans, latestBusinesses, latestSuppliers, latestProducts, latestOrders, latestSubs] =
        await Promise.all([
          supabase.from('recipes').select('id, xbloom_link, created_at').order('created_at', { ascending: false }).limit(5),
          supabase.from('beans').select('id, name, created_at').order('created_at', { ascending: false }).limit(5),
          supabase.from('roasters').select('id, name, business_type, created_at').order('created_at', { ascending: false }).limit(5),
          supabase.from('suppliers').select('id, name, created_at').order('created_at', { ascending: false }).limit(5),
          supabase.from('products').select('id, name, created_at').order('created_at', { ascending: false }).limit(5),
          supabase
            .from('orders')
            .select('id, order_number, customer_name, total, created_at')
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('subscriptions')
            .select('id, customer_name, created_at')
            .order('created_at', { ascending: false })
            .limit(5),
        ]);

      const items: ActivityItem[] = [
        ...(latestRecipes.data ?? []).map((r) => ({
          id: `recipe-${r.id}`,
          kind: 'recipe' as const,
          title: 'وصفة جديدة',
          subtitle: r.xbloom_link ? 'رابط xBloom مرفق' : '—',
          createdAt: r.created_at,
          tab: 'recipes' as const,
        })),
        ...(latestBeans.data ?? []).map((b) => ({
          id: `bean-${b.id}`,
          kind: 'bean' as const,
          title: b.name || 'محصول بلا اسم',
          subtitle: 'محصول جديد',
          createdAt: b.created_at,
          tab: 'beans' as const,
        })),
        ...(latestBusinesses.data ?? []).map((r) => ({
          id: `business-${r.id}`,
          kind: 'business' as const,
          title: r.name,
          subtitle: r.business_type === 'cafe' ? 'كوفي شوب جديد' : 'محمصة جديدة',
          createdAt: r.created_at,
          tab: 'businesses' as const,
        })),
        ...(latestSuppliers.data ?? []).map((s) => ({
          id: `supplier-${s.id}`,
          kind: 'supplier' as const,
          title: s.name,
          subtitle: 'مورّد جديد',
          createdAt: s.created_at,
          tab: 'suppliers' as const,
        })),
        ...(latestProducts.data ?? []).map((p) => ({
          id: `product-${p.id}`,
          kind: 'product' as const,
          title: p.name,
          subtitle: 'منتج جديد',
          createdAt: p.created_at,
          tab: 'store' as const,
        })),
        ...(latestOrders.data ?? []).map((o) => ({
          id: `order-${o.id}`,
          kind: 'order' as const,
          title: `طلب #${o.order_number}`,
          subtitle: `${o.customer_name ?? '—'} · ${o.total ?? 0} د.إ`,
          createdAt: o.created_at,
          tab: 'orders' as const,
        })),
        ...(latestSubs.data ?? []).map((s) => ({
          id: `sub-${s.id}`,
          kind: 'subscriber' as const,
          title: s.customer_name ?? 'مشترك جديد',
          subtitle: 'اشتراك شهري',
          createdAt: s.created_at,
          tab: 'subscribers' as const,
        })),
      ];

      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setActivity(items.slice(0, 10));

      const { data: topData } = await supabase
        .from('beans')
        .select('id, name, avg_rating, reviews_count, roasters!beans_roaster_id_fkey(name)')
        .eq('status', 'approved')
        .gt('reviews_count', 0)
        .order('avg_rating', { ascending: false })
        .order('reviews_count', { ascending: false })
        .limit(3)
        .returns<TopBean[]>();
      setTopBeans(topData ?? []);
    };
    load();
  }, []);

  if (!counts) return <StatCardSkeletonGrid />;

  const totalPending =
    counts.pendingRecipes +
    counts.pendingBeans +
    counts.pendingBusinesses +
    counts.pendingSuppliers +
    counts.pendingProducts;

  return (
    <div className="flex flex-col gap-8">
      {totalPending > 0 && (
        <div className="rounded-2xl border border-gold/60 bg-sand px-5 py-4 text-sm text-coffee">
          <strong className="font-[var(--font-el-messiri)] text-base text-ink">{totalPending}</strong> عنصر بانتظار
          مراجعتك الآن — شوف قسم "قائمة المراجعة" تحت.
        </div>
      )}

      <div>
        <SectionTitle>قائمة المراجعة</SectionTitle>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="وصفات معلّقة" value={counts.pendingRecipes} urgent onClick={() => onNavigate('recipes')} />
          <StatCard label="محاصيل معلّقة" value={counts.pendingBeans} urgent onClick={() => onNavigate('beans')} />
          <StatCard label="شركات معلّقة" value={counts.pendingBusinesses} urgent onClick={() => onNavigate('businesses')} />
          <StatCard label="موردين معلّقين" value={counts.pendingSuppliers} urgent onClick={() => onNavigate('suppliers')} />
          <StatCard label="منتجات معلّقة" value={counts.pendingProducts} urgent onClick={() => onNavigate('store')} />
        </div>
      </div>

      <div>
        <SectionTitle>لمحة الأعمال</SectionTitle>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="إجمالي المستخدمين" value={counts.totalProfiles} />
          <StatCard label="إجمالي الشركات" value={counts.totalBusinesses} onClick={() => onNavigate('businesses')} />
          <StatCard label="إجمالي الموردين" value={counts.totalSuppliers} onClick={() => onNavigate('suppliers')} />
          <StatCard label="مشتركين نشطين" value={counts.activeSubscribers} onClick={() => onNavigate('subscribers')} />
          <StatCard label="إجمالي الطلبات" value={counts.totalOrders} onClick={() => onNavigate('orders')} />
        </div>
      </div>

      <div>
        <SectionTitle>الزوار والتفاعل</SectionTitle>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="ضغطات روابط الشراء" value={engagement?.affiliateClicks ?? '—'} />
          <StatCard label="اهتمام بالاشتراك" value={engagement?.subscriptionInterests ?? '—'} />
          {ph?.connected ? (
            <>
              <StatCard label="زوار فريدين (٣٠ يوم)" value={ph.uniqueVisitors30d} />
              <StatCard label="تثبيتات جديدة (٣٠ يوم)" value={ph.newInstalls30d} />
            </>
          ) : !loadingPh ? (
            <div className="col-span-2 flex items-center rounded-2xl border border-dashed border-stone bg-sand/40 px-4 py-3 text-xs text-mocha">
              بيانات PostHog غير متاحة الحين
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <SectionTitle>آخر التحديثات</SectionTitle>
          <div className="flex flex-col divide-y divide-latte/60 rounded-2xl border border-latte bg-white shadow-sm">
            {activity === null ? (
              <p className="p-4 text-sm text-mocha">تحميل...</p>
            ) : activity.length === 0 ? (
              <p className="p-4 text-sm text-mocha">ولا تحديث بعد</p>
            ) : (
              activity.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.tab)}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-right transition hover:bg-sand/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                    <p className="text-xs text-mocha">
                      {KIND_LABEL[item.kind]} · {item.subtitle}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-stone">{timeAgo(item.createdAt)}</span>
                </button>
              ))
            )}
          </div>
        </div>

        <div>
          <SectionTitle>أفضل المحاصيل تقييماً</SectionTitle>
          <div className="flex flex-col divide-y divide-latte/60 rounded-2xl border border-latte bg-white shadow-sm">
            {topBeans === null ? (
              <p className="p-4 text-sm text-mocha">تحميل...</p>
            ) : topBeans.length === 0 ? (
              <p className="p-4 text-sm text-mocha">ولا تقييمات حقيقية بعد</p>
            ) : (
              topBeans.map((b, i) => (
                <button
                  key={b.id}
                  onClick={() => onNavigate('top')}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-right transition hover:bg-sand/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {i + 1}. {b.name}
                    </p>
                    <p className="text-xs text-mocha">{b.roasters?.name ?? '—'}</p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-gold">
                    ★ {b.avg_rating.toFixed(1)} ({b.reviews_count})
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
