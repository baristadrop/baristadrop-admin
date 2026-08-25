'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Session } from '@supabase/supabase-js';
import { Sidebar, type SidebarGroup } from '@/components/ui/Sidebar';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { ToastProvider } from '@/components/ui/Toast';
import { StatCardSkeletonGrid, TableSkeleton, Skeleton } from '@/components/ui/Skeleton';

// كل التبويبات محمّلة ديناميكياً (dynamic import) -- كل واحد يتحمّل بس أول
// ما الأدمن يفتحه فعلياً، بدل ما تتحمّل كلها الـ23 مع أول طلب وتخنق سيرفر
// التطوير (RAM/CPU) بلا داعٍ. ملاحظة: Turbopack يحتاج الـ options object
// مكتوب inline بكل نداء (ما يقبل مرجع لمتغيّر مشترك).
const OverviewTab = dynamic(() => import('./tabs/OverviewTab').then((m) => m.OverviewTab), {
  loading: () => <StatCardSkeletonGrid />,
  ssr: false,
});
const TrackingTab = dynamic(() => import('./tabs/TrackingTab').then((m) => m.TrackingTab), {
  loading: () => <StatCardSkeletonGrid />,
  ssr: false,
});
const ProductClicksTab = dynamic(() => import('./tabs/ProductClicksTab').then((m) => m.ProductClicksTab), {
  loading: () => <StatCardSkeletonGrid />,
  ssr: false,
});
const TopBeansTab = dynamic(() => import('./tabs/TopBeansTab').then((m) => m.TopBeansTab), {
  loading: () => <StatCardSkeletonGrid />,
  ssr: false,
});
const RecipesTab = dynamic(() => import('./tabs/RecipesTab').then((m) => m.RecipesTab), {
  loading: () => <TableSkeleton />,
  ssr: false,
});
const BeansTab = dynamic(() => import('./tabs/BeansTab').then((m) => m.BeansTab), {
  loading: () => <TableSkeleton />,
  ssr: false,
});
const MarketplaceListingsTab = dynamic(() => import('./tabs/MarketplaceListingsTab').then((m) => m.MarketplaceListingsTab), {
  loading: () => <TableSkeleton />,
  ssr: false,
});
const BusinessesTab = dynamic(() => import('./tabs/BusinessesTab').then((m) => m.BusinessesTab), {
  loading: () => <TableSkeleton />,
  ssr: false,
});
const SuppliersTab = dynamic(() => import('./tabs/SuppliersTab').then((m) => m.SuppliersTab), {
  loading: () => <TableSkeleton />,
  ssr: false,
});
const ProductsTab = dynamic(() => import('./tabs/ProductsTab').then((m) => m.ProductsTab), {
  loading: () => <TableSkeleton />,
  ssr: false,
});
const OrdersTab = dynamic(() => import('./tabs/OrdersTab').then((m) => m.OrdersTab), {
  loading: () => <TableSkeleton />,
  ssr: false,
});
const SubscribersTab = dynamic(() => import('./tabs/SubscribersTab').then((m) => m.SubscribersTab), {
  loading: () => <TableSkeleton />,
  ssr: false,
});
const MerchantsTab = dynamic(() => import('./tabs/affiliate/MerchantsTab').then((m) => m.MerchantsTab), {
  loading: () => <TableSkeleton />,
  ssr: false,
});
const NetworksTab = dynamic(() => import('./tabs/affiliate/NetworksTab').then((m) => m.NetworksTab), {
  loading: () => <TableSkeleton />,
  ssr: false,
});
const ProgramsTab = dynamic(() => import('./tabs/affiliate/ProgramsTab').then((m) => m.ProgramsTab), {
  loading: () => <TableSkeleton />,
  ssr: false,
});
const LinksTab = dynamic(() => import('./tabs/affiliate/LinksTab').then((m) => m.LinksTab), {
  loading: () => <TableSkeleton />,
  ssr: false,
});
const ConversionsTab = dynamic(() => import('./tabs/affiliate/ConversionsTab').then((m) => m.ConversionsTab), {
  loading: () => <TableSkeleton />,
  ssr: false,
});
const AccountingTab = dynamic(() => import('./tabs/affiliate/AccountingTab').then((m) => m.AccountingTab), {
  loading: () => <TableSkeleton />,
  ssr: false,
});
const ReconciliationTab = dynamic(() => import('./tabs/affiliate/ReconciliationTab').then((m) => m.ReconciliationTab), {
  loading: () => <TableSkeleton />,
  ssr: false,
});
const PayoutsTab = dynamic(() => import('./tabs/affiliate/PayoutsTab').then((m) => m.PayoutsTab), {
  loading: () => <TableSkeleton />,
  ssr: false,
});
const JobsTab = dynamic(() => import('./tabs/affiliate/JobsTab').then((m) => m.JobsTab), {
  loading: () => <TableSkeleton />,
  ssr: false,
});
const TeamTab = dynamic(() => import('./tabs/TeamTab').then((m) => m.TeamTab), {
  loading: () => <Skeleton className="h-64 w-full" />,
  ssr: false,
});
const NotificationsTab = dynamic(() => import('./tabs/NotificationsTab').then((m) => m.NotificationsTab), {
  loading: () => <Skeleton className="h-64 w-full" />,
  ssr: false,
});
const MonetizationTab = dynamic(() => import('./tabs/MonetizationTab').then((m) => m.MonetizationTab), {
  loading: () => <StatCardSkeletonGrid />,
  ssr: false,
});

// خفيف ويُستخدم فوراً في الهيدر -- يبقى static.
import { HelpPanel } from './tabs/affiliate/HelpPanel';
import { BeanIcon } from './icons/NavIcons';
import {
  OverviewIcon,
  PulseIcon,
  TrophyIcon,
  CupIcon,
  StorefrontIcon,
  TruckIcon,
  BagIcon,
  ReceiptIcon,
  UsersIcon,
  ShieldIcon,
  BellIcon,
  CoinIcon,
  CursorClickIcon,
  NetworkIcon,
  TargetIcon,
  LinkIcon,
  ScaleIcon,
  WalletIcon,
  TagIcon,
} from './icons/LucideNavIcons';

export type TabKey =
  | 'overview'
  | 'tracking'
  | 'productClicks'
  | 'top'
  | 'recipes'
  | 'beans'
  | 'marketplaceListings'
  | 'businesses'
  | 'suppliers'
  | 'store'
  | 'orders'
  | 'subscribers'
  | 'monetization'
  | 'notifications'
  | 'team'
  | 'affiliateMerchants'
  | 'affiliateNetworks'
  | 'affiliatePrograms'
  | 'affiliateLinks'
  | 'affiliateConversions'
  | 'affiliateAccounting'
  | 'affiliateReconciliation'
  | 'affiliatePayouts'
  | 'affiliateJobs';

type NavGroup = SidebarGroup<TabKey>;

function buildNavGroups(counts: { recipes: number; beans: number; marketplaceListings: number }): NavGroup[] {
  return [
  {
    label: 'نظرة عامة وتحليلات',
    tabs: [
      { key: 'overview', label: 'نظرة عامة', Icon: OverviewIcon },
      { key: 'tracking', label: 'التتبع', Icon: PulseIcon },
      { key: 'productClicks', label: 'نقرات كل منتج', Icon: CursorClickIcon },
      { key: 'top', label: 'أفضل 10 محاصيل', Icon: TrophyIcon },
    ],
  },
  {
    label: 'قائمة المراجعة',
    tabs: [
      { key: 'recipes', label: 'الوصفات المعلّقة', Icon: CupIcon, badge: counts.recipes },
      { key: 'beans', label: 'المحاصيل المعلّقة', Icon: BeanIcon, badge: counts.beans },
      { key: 'marketplaceListings', label: 'سوق المعدات المستعملة', Icon: TagIcon, badge: counts.marketplaceListings },
    ],
  },
  {
    label: 'الشركاء',
    tabs: [
      { key: 'businesses', label: 'الشركات', Icon: StorefrontIcon },
      { key: 'suppliers', label: 'الموردين', Icon: TruckIcon },
    ],
  },
  {
    label: 'المتجر والطلبات',
    tabs: [
      { key: 'store', label: 'متجري', Icon: BagIcon },
      { key: 'orders', label: 'الطلبات', Icon: ReceiptIcon },
      { key: 'subscribers', label: 'المشتركين', Icon: UsersIcon },
    ],
  },
  {
    label: 'الاشتراكات والكريدت',
    tabs: [{ key: 'monetization', label: 'بريميوم وكريدت', Icon: CoinIcon }],
  },
  {
    label: 'التسويق',
    tabs: [{ key: 'notifications', label: 'الإشعارات', Icon: BellIcon }],
  },
  {
    label: 'برنامج الأفيليت',
    tabs: [
      { key: 'affiliateMerchants', label: 'التجار', Icon: StorefrontIcon },
      { key: 'affiliateNetworks', label: 'الشبكات', Icon: NetworkIcon },
      { key: 'affiliatePrograms', label: 'البرامج', Icon: TargetIcon },
      { key: 'affiliateLinks', label: 'الروابط', Icon: LinkIcon },
    ],
  },
  {
    label: 'محاسبة الأفيليت',
    tabs: [
      { key: 'affiliateConversions', label: 'التحويلات', Icon: ReceiptIcon },
      { key: 'affiliateAccounting', label: 'العمولات', Icon: CoinIcon },
      { key: 'affiliateReconciliation', label: 'التسوية', Icon: ScaleIcon },
      { key: 'affiliatePayouts', label: 'المدفوعات', Icon: WalletIcon },
      { key: 'affiliateJobs', label: 'الوظائف', Icon: PulseIcon },
    ],
  },
  {
    label: 'الفريق',
    tabs: [{ key: 'team', label: 'الفريق', Icon: ShieldIcon }],
  },
  ];
}

type Profile = { full_name: string | null };

export function Dashboard({
  profile,
  session,
  signOut,
}: {
  profile: Profile | null;
  session: Session | null;
  signOut: () => void;
}) {
  const [active, setActive] = useState<TabKey>('overview');
  // بيانات هذه الأعداد تجيها OverviewTab (نفس الـ RPC اللي محتاجته أصلاً
  // لبطاقاتها) بدل ما نناديها مرة ثانية هنا -- كانت تتكرر مرتين بنفس الطلب.
  const [counts, setCounts] = useState({ recipes: 0, beans: 0, marketplaceListings: 0 });

  const navGroups = useMemo(() => buildNavGroups(counts), [counts]);
  const allTabs = navGroups.flatMap((g) => g.tabs);
  const activeLabel = allTabs.find((t) => t.key === active)?.label ?? '';

  // مرجع ثابت (نفس الـ reference) عبر إعادات الرندر -- ضروري عشان مقارنة
  // React.memo المخصّصة بالـ Sidebar فعلاً تشتغل وما تعيد الرندر بلا داعي.
  const headerBrand = useMemo(
    () => (
      <div>
        <h1 className="font-[var(--font-cormorant)] text-xl font-bold tracking-wide text-gold">BARISTA DROP</h1>
        <p className="text-xs text-sand/80">لوحة التحكم</p>
      </div>
    ),
    []
  );

  return (
    <ToastProvider>
      <div className="min-h-screen bg-ink lg:flex">
        <Sidebar groups={navGroups} active={active} onSelect={setActive} header={headerBrand} />

        <div className="min-w-0 flex-1">
          <PageHeader title={activeLabel}>
            <HelpPanel />
            <span className="rounded-full bg-white/10 px-3 py-1.5 font-medium text-sand">
              {profile?.full_name || session?.user.email}
            </span>
            <Button variant="outline" size="sm" onClick={() => signOut()} className="border-mocha/40 bg-transparent text-sand hover:border-gold hover:bg-white/5">
              تسجيل خروج
            </Button>
          </PageHeader>

          <main id="main-content" className="min-h-screen bg-canvas px-6 py-8">
          {active === 'overview' && <OverviewTab onNavigate={setActive} onCountsUpdate={setCounts} />}
          {active === 'tracking' && <TrackingTab />}
          {active === 'productClicks' && <ProductClicksTab />}
          {active === 'top' && <TopBeansTab />}
          {active === 'recipes' && <RecipesTab />}
          {active === 'beans' && <BeansTab />}
          {active === 'marketplaceListings' && <MarketplaceListingsTab />}
          {active === 'businesses' && <BusinessesTab />}
          {active === 'suppliers' && <SuppliersTab />}
          {active === 'store' && <ProductsTab />}
          {active === 'orders' && <OrdersTab />}
          {active === 'subscribers' && <SubscribersTab />}
          {active === 'monetization' && <MonetizationTab />}
          {active === 'notifications' && <NotificationsTab />}
          {active === 'affiliateMerchants' && <MerchantsTab />}
          {active === 'affiliateNetworks' && <NetworksTab />}
          {active === 'affiliatePrograms' && <ProgramsTab />}
          {active === 'affiliateLinks' && <LinksTab />}
          {active === 'affiliateConversions' && <ConversionsTab />}
          {active === 'affiliateAccounting' && <AccountingTab />}
          {active === 'affiliateReconciliation' && <ReconciliationTab />}
          {active === 'affiliatePayouts' && <PayoutsTab />}
          {active === 'affiliateJobs' && <JobsTab />}
          {active === 'team' && <TeamTab />}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
