'use client';

import { useState } from 'react';
import { useAdminAuth } from '@/lib/useAdminAuth';
import { OverviewTab } from './tabs/OverviewTab';
import { RecipesTab } from './tabs/RecipesTab';
import { BeansTab } from './tabs/BeansTab';
import { RoastersTab } from './tabs/RoastersTab';
import { SuppliersTab } from './tabs/SuppliersTab';
import { TeamTab } from './tabs/TeamTab';
import { TopBeansTab } from './tabs/TopBeansTab';
import { ProductsTab } from './tabs/ProductsTab';
import { OrdersTab } from './tabs/OrdersTab';
import { SubscribersTab } from './tabs/SubscribersTab';

const TABS = [
  { key: 'overview', label: 'نظرة عامة' },
  { key: 'top', label: 'أفضل 10 محاصيل' },
  { key: 'recipes', label: 'الوصفات المعلّقة' },
  { key: 'beans', label: 'المحاصيل المعلّقة' },
  { key: 'roasters', label: 'المحامص' },
  { key: 'suppliers', label: 'الموردين' },
  { key: 'store', label: 'متجري' },
  { key: 'orders', label: 'الطلبات' },
  { key: 'subscribers', label: 'المشتركين' },
  { key: 'team', label: 'الفريق' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function Dashboard() {
  const { profile, session, signOut } = useAdminAuth();
  const [active, setActive] = useState<TabKey>('overview');

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-latte bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <h1 className="font-[var(--font-cormorant)] text-2xl font-bold tracking-wide text-ink">
            BARISTA DROP <span className="text-base font-normal text-mocha">· لوحة التحكم</span>
          </h1>
          <div className="flex items-center gap-3 text-sm text-mocha">
            <span>{profile?.full_name || session?.user.email}</span>
            <button
              onClick={() => signOut()}
              className="rounded-full border border-latte px-3 py-1.5 text-coffee hover:bg-sand"
            >
              تسجيل خروج
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-6 pb-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                active === tab.key ? 'bg-ink text-cream' : 'bg-white text-coffee border border-latte'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {active === 'overview' && <OverviewTab />}
        {active === 'top' && <TopBeansTab />}
        {active === 'recipes' && <RecipesTab />}
        {active === 'beans' && <BeansTab />}
        {active === 'roasters' && <RoastersTab />}
        {active === 'suppliers' && <SuppliersTab />}
        {active === 'store' && <ProductsTab />}
        {active === 'orders' && <OrdersTab />}
        {active === 'subscribers' && <SubscribersTab />}
        {active === 'team' && <TeamTab />}
      </main>
    </div>
  );
}
