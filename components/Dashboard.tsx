'use client';

import { useState } from 'react';
import { useAdminAuth } from '@/lib/useAdminAuth';
import { OverviewTab } from './tabs/OverviewTab';
import { RecipesTab } from './tabs/RecipesTab';
import { BeansTab } from './tabs/BeansTab';
import { RoastersTab } from './tabs/RoastersTab';
import { SuppliersTab } from './tabs/SuppliersTab';
import { CafesTab } from './tabs/CafesTab';
import { TeamTab } from './tabs/TeamTab';
import { TopBeansTab } from './tabs/TopBeansTab';
import { ProductsTab } from './tabs/ProductsTab';
import { OrdersTab } from './tabs/OrdersTab';
import { SubscribersTab } from './tabs/SubscribersTab';
import { NetworkTab } from './tabs/NetworkTab';
import {
  OverviewIcon,
  TrophyIcon,
  CupIcon,
  BeanIcon,
  FlameIcon,
  StorefrontIcon,
  TruckIcon,
  BagIcon,
  ReceiptIcon,
  UsersIcon,
  ShieldIcon,
  NetworkIcon,
} from './icons/NavIcons';

const TABS = [
  { key: 'overview', label: 'نظرة عامة', Icon: OverviewIcon },
  { key: 'top', label: 'أفضل 10 محاصيل', Icon: TrophyIcon },
  { key: 'recipes', label: 'الوصفات المعلّقة', Icon: CupIcon },
  { key: 'beans', label: 'المحاصيل المعلّقة', Icon: BeanIcon },
  { key: 'roasters', label: 'المحامص', Icon: FlameIcon },
  { key: 'cafes', label: 'الكوفي شوب', Icon: StorefrontIcon },
  { key: 'suppliers', label: 'الموردين', Icon: TruckIcon },
  { key: 'store', label: 'متجري', Icon: BagIcon },
  { key: 'orders', label: 'الطلبات', Icon: ReceiptIcon },
  { key: 'subscribers', label: 'المشتركين', Icon: UsersIcon },
  { key: 'team', label: 'الفريق', Icon: ShieldIcon },
  { key: 'network', label: 'الشبكة', Icon: NetworkIcon },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function Dashboard() {
  const { profile, session, signOut } = useAdminAuth();
  const [active, setActive] = useState<TabKey>('overview');

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-10 border-b border-latte/70 bg-cream/95 shadow-[0_1px_0_0_rgba(0,0,0,0.02)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <h1 className="font-[var(--font-cormorant)] text-2xl font-bold tracking-wide text-ink">
            BARISTA DROP <span className="text-base font-normal text-mocha">· لوحة التحكم</span>
          </h1>
          <div className="flex items-center gap-3 text-sm text-mocha">
            <span className="rounded-full bg-sand/70 px-3 py-1.5 font-medium text-coffee">
              {profile?.full_name || session?.user.email}
            </span>
            <button
              onClick={() => signOut()}
              className="rounded-full border border-latte px-3 py-1.5 font-medium text-coffee transition hover:border-coffee hover:bg-sand"
            >
              تسجيل خروج
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1.5 overflow-x-auto px-6 pb-3">
          {TABS.map((tab) => {
            const Icon = tab.Icon;
            const isActive = active === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActive(tab.key)}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-ink text-cream shadow-sm'
                    : 'border border-latte bg-white text-coffee hover:border-coffee/40 hover:bg-sand/40'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-gold' : 'text-mocha'}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {active === 'overview' && <OverviewTab />}
        {active === 'top' && <TopBeansTab />}
        {active === 'recipes' && <RecipesTab />}
        {active === 'beans' && <BeansTab />}
        {active === 'roasters' && <RoastersTab />}
        {active === 'cafes' && <CafesTab />}
        {active === 'suppliers' && <SuppliersTab />}
        {active === 'store' && <ProductsTab />}
        {active === 'orders' && <OrdersTab />}
        {active === 'subscribers' && <SubscribersTab />}
        {active === 'team' && <TeamTab />}
        {active === 'network' && <NetworkTab />}
      </main>
    </div>
  );
}
