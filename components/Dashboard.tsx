'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Sidebar, type SidebarGroup } from '@/components/ui/Sidebar';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { ToastProvider } from '@/components/ui/Toast';
import { OverviewTab } from './tabs/OverviewTab';
import { TrackingTab } from './tabs/TrackingTab';
import { ProductClicksTab } from './tabs/ProductClicksTab';
import { RecipesTab } from './tabs/RecipesTab';
import { BeansTab } from './tabs/BeansTab';
import { MarketplaceListingsTab } from './tabs/MarketplaceListingsTab';
import { BusinessesTab } from './tabs/BusinessesTab';
import { SuppliersTab } from './tabs/SuppliersTab';
import { TeamTab } from './tabs/TeamTab';
import { TopBeansTab } from './tabs/TopBeansTab';
import { ProductsTab } from './tabs/ProductsTab';
import { OrdersTab } from './tabs/OrdersTab';
import { SubscribersTab } from './tabs/SubscribersTab';
import { NotificationsTab } from './tabs/NotificationsTab';
import { MerchantsTab } from './tabs/affiliate/MerchantsTab';
import { NetworksTab } from './tabs/affiliate/NetworksTab';
import { ProgramsTab } from './tabs/affiliate/ProgramsTab';
import { LinksTab } from './tabs/affiliate/LinksTab';
import { ConversionsTab } from './tabs/affiliate/ConversionsTab';
import { AccountingTab } from './tabs/affiliate/AccountingTab';
import { ReconciliationTab } from './tabs/affiliate/ReconciliationTab';
import { PayoutsTab } from './tabs/affiliate/PayoutsTab';
import { JobsTab } from './tabs/affiliate/JobsTab';

// مؤجّل عمداً (dynamic import) -- مكتبة الرسوم البيانية (recharts) لازم ما
// تثقّل الحزمة الأساسية لباقي التبويبات اللي ما تحتاجها، تُحمَّل بس أول ما
// حد يفتح هذا التبويب فعلياً.
const MonetizationTab = dynamic(() => import('./tabs/MonetizationTab').then((m) => m.MonetizationTab), {
  loading: () => <p className="text-mocha">تحميل...</p>,
  ssr: false,
});
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
  const [counts, setCounts] = useState({ recipes: 0, beans: 0, marketplaceListings: 0 });

  useEffect(() => {
    (async () => {
      const [{ data: stats }, { count: listingsCount }] = await Promise.all([
        supabase.rpc('get_overview_stats').single<{ pending_recipes: number; pending_beans: number }>(),
        supabase.from('marketplace_listings').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
      ]);
      setCounts({
        recipes: stats?.pending_recipes ?? 0,
        beans: stats?.pending_beans ?? 0,
        marketplaceListings: listingsCount ?? 0,
      });
    })();
  }, []);

  const navGroups = buildNavGroups(counts);
  const allTabs = navGroups.flatMap((g) => g.tabs);
  const activeLabel = allTabs.find((t) => t.key === active)?.label ?? '';

  const headerBrand = (
    <div>
      <h1 className="font-[var(--font-cormorant)] text-xl font-bold tracking-wide text-gold">BARISTA DROP</h1>
      <p className="text-xs text-sand/80">لوحة التحكم</p>
    </div>
  );

  return (
    <ToastProvider>
      <div className="min-h-screen bg-ink lg:flex">
        <Sidebar groups={navGroups} active={active} onSelect={setActive} header={headerBrand} />

        <div className="min-w-0 flex-1">
          <PageHeader title={activeLabel}>
            <span className="rounded-full bg-white/10 px-3 py-1.5 font-medium text-sand">
              {profile?.full_name || session?.user.email}
            </span>
            <Button variant="outline" size="sm" onClick={() => signOut()} className="border-mocha/40 bg-transparent text-sand hover:border-gold hover:bg-white/5">
              تسجيل خروج
            </Button>
          </PageHeader>

          <main id="main-content" className="min-h-screen bg-canvas px-6 py-8">
          {active === 'overview' && <OverviewTab onNavigate={setActive} />}
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
