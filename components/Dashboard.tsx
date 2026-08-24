'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { Session } from '@supabase/supabase-js';
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
  | 'affiliatePayouts';

type NavTab = { key: TabKey; label: string; Icon: (props: { className?: string }) => React.JSX.Element };
type NavGroup = { label: string; tabs: NavTab[] };

const NAV_GROUPS: NavGroup[] = [
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
      { key: 'recipes', label: 'الوصفات المعلّقة', Icon: CupIcon },
      { key: 'beans', label: 'المحاصيل المعلّقة', Icon: BeanIcon },
      { key: 'marketplaceListings', label: 'سوق المعدات المستعملة', Icon: TagIcon },
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
    ],
  },
  {
    label: 'الفريق',
    tabs: [{ key: 'team', label: 'الفريق', Icon: ShieldIcon }],
  },
];

const ALL_TABS: NavTab[] = NAV_GROUPS.flatMap((g) => g.tabs);

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
  const activeLabel = ALL_TABS.find((t) => t.key === active)?.label ?? '';

  return (
    <div className="min-h-screen bg-ink lg:flex">
      <aside className="border-b border-mocha/30 bg-coffee lg:h-screen lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-l">
        <div className="px-5 py-5">
          <h1 className="font-[var(--font-cormorant)] text-xl font-bold tracking-wide text-gold">BARISTA DROP</h1>
          <p className="text-xs text-sand/80">لوحة التحكم</p>
        </div>

        <nav className="flex flex-col gap-5 px-3 pb-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-2 text-[11px] font-semibold tracking-wide text-sand/70">{group.label}</p>
              <div className="flex flex-col gap-1">
                {group.tabs.map((tab) => {
                  const Icon = tab.Icon;
                  const isActive = active === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActive(tab.key)}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
                        isActive
                          ? 'bg-gold text-cream shadow-sm'
                          : 'text-sand hover:bg-white/5'
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-cream' : 'text-sand'}`} />
                      <span className="text-right">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 border-b border-mocha/30 bg-coffee/95 shadow-[0_1px_0_0_rgba(0,0,0,0.2)] backdrop-blur">
          <div className="flex items-center justify-between px-6 py-4">
            <h2 className="font-[var(--font-el-messiri)] text-lg text-cream">{activeLabel}</h2>
            <div className="flex items-center gap-3 text-sm text-stone">
              <span className="rounded-full bg-white/10 px-3 py-1.5 font-medium text-sand">
                {profile?.full_name || session?.user.email}
              </span>
              <button
                onClick={() => signOut()}
                className="rounded-full border border-mocha/40 px-3 py-1.5 font-medium text-sand transition hover:border-gold hover:bg-white/5"
              >
                تسجيل خروج
              </button>
            </div>
          </div>
        </header>

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
          {active === 'team' && <TeamTab />}
        </main>
      </div>
    </div>
  );
}
