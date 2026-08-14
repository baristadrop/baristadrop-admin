'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useAdminAuth } from '@/lib/useAdminAuth';
import { OverviewTab } from './tabs/OverviewTab';
import { TrackingTab } from './tabs/TrackingTab';
import { RecipesTab } from './tabs/RecipesTab';
import { BeansTab } from './tabs/BeansTab';
import { BusinessesTab } from './tabs/BusinessesTab';
import { SuppliersTab } from './tabs/SuppliersTab';
import { TeamTab } from './tabs/TeamTab';
import { TopBeansTab } from './tabs/TopBeansTab';
import { ProductsTab } from './tabs/ProductsTab';
import { OrdersTab } from './tabs/OrdersTab';
import { SubscribersTab } from './tabs/SubscribersTab';
import { NotificationsTab } from './tabs/NotificationsTab';

// مؤجّل عمداً (dynamic import) -- مكتبة الرسوم البيانية (recharts) لازم ما
// تثقّل الحزمة الأساسية لباقي التبويبات اللي ما تحتاجها، تُحمَّل بس أول ما
// حد يفتح هذا التبويب فعلياً.
const MonetizationTab = dynamic(() => import('./tabs/MonetizationTab').then((m) => m.MonetizationTab), {
  loading: () => <p className="text-mocha">تحميل...</p>,
  ssr: false,
});
import {
  OverviewIcon,
  PulseIcon,
  TrophyIcon,
  CupIcon,
  BeanIcon,
  StorefrontIcon,
  TruckIcon,
  BagIcon,
  ReceiptIcon,
  UsersIcon,
  ShieldIcon,
  BellIcon,
  CoinIcon,
} from './icons/NavIcons';

export type TabKey =
  | 'overview'
  | 'tracking'
  | 'top'
  | 'recipes'
  | 'beans'
  | 'businesses'
  | 'suppliers'
  | 'store'
  | 'orders'
  | 'subscribers'
  | 'monetization'
  | 'notifications'
  | 'team';

type NavTab = { key: TabKey; label: string; Icon: (props: { className?: string }) => React.JSX.Element };
type NavGroup = { label: string; tabs: NavTab[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'نظرة عامة وتحليلات',
    tabs: [
      { key: 'overview', label: 'نظرة عامة', Icon: OverviewIcon },
      { key: 'tracking', label: 'التتبع', Icon: PulseIcon },
      { key: 'top', label: 'أفضل 10 محاصيل', Icon: TrophyIcon },
    ],
  },
  {
    label: 'قائمة المراجعة',
    tabs: [
      { key: 'recipes', label: 'الوصفات المعلّقة', Icon: CupIcon },
      { key: 'beans', label: 'المحاصيل المعلّقة', Icon: BeanIcon },
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
    label: 'الفريق',
    tabs: [{ key: 'team', label: 'الفريق', Icon: ShieldIcon }],
  },
];

const ALL_TABS: NavTab[] = NAV_GROUPS.flatMap((g) => g.tabs);

export function Dashboard() {
  const { profile, session, signOut } = useAdminAuth();
  const [active, setActive] = useState<TabKey>('overview');
  const activeLabel = ALL_TABS.find((t) => t.key === active)?.label ?? '';

  return (
    <div className="min-h-screen bg-ink lg:flex">
      <aside className="border-b border-mocha/30 bg-coffee lg:h-screen lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-l">
        <div className="px-5 py-5">
          <h1 className="font-[var(--font-cormorant)] text-xl font-bold tracking-wide text-gold">BARISTA DROP</h1>
          <p className="text-xs text-stone">لوحة التحكم</p>
        </div>

        <nav className="flex flex-col gap-5 px-3 pb-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-2 text-[11px] font-semibold tracking-wide text-stone">{group.label}</p>
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
                          ? 'bg-gold text-ink shadow-sm'
                          : 'text-sand hover:bg-white/5'
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-ink' : 'text-stone'}`} />
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

        <main className="px-6 py-8">
          {active === 'overview' && <OverviewTab onNavigate={setActive} />}
          {active === 'tracking' && <TrackingTab />}
          {active === 'top' && <TopBeansTab />}
          {active === 'recipes' && <RecipesTab />}
          {active === 'beans' && <BeansTab />}
          {active === 'businesses' && <BusinessesTab />}
          {active === 'suppliers' && <SuppliersTab />}
          {active === 'store' && <ProductsTab />}
          {active === 'orders' && <OrdersTab />}
          {active === 'subscribers' && <SubscribersTab />}
          {active === 'monetization' && <MonetizationTab />}
          {active === 'notifications' && <NotificationsTab />}
          {active === 'team' && <TeamTab />}
        </main>
      </div>
    </div>
  );
}
