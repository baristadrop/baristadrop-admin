'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Counts = {
  pendingRecipes: number;
  pendingBeans: number;
  pendingSuppliers: number;
  totalRoasters: number;
  totalSuppliers: number;
  totalProfiles: number;
  affiliateClicks: number;
  subscriptionInterests: number;
};

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-latte bg-white p-5">
      <p className="text-sm text-mocha">{label}</p>
      <p className="mt-1 font-[var(--font-el-messiri)] text-3xl text-ink">{value}</p>
    </div>
  );
}

export function OverviewTab() {
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    const load = async () => {
      const [recipes, beans, suppliers, roasters, allSuppliers, profiles, clicks, subInterests] =
        await Promise.all([
          supabase.from('recipes').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('beans').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('suppliers').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('roasters').select('id', { count: 'exact', head: true }),
          supabase.from('suppliers').select('id', { count: 'exact', head: true }),
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('affiliate_clicks').select('id', { count: 'exact', head: true }),
          supabase.from('subscription_interests').select('id', { count: 'exact', head: true }),
        ]);
      setCounts({
        pendingRecipes: recipes.count ?? 0,
        pendingBeans: beans.count ?? 0,
        pendingSuppliers: suppliers.count ?? 0,
        totalRoasters: roasters.count ?? 0,
        totalSuppliers: allSuppliers.count ?? 0,
        totalProfiles: profiles.count ?? 0,
        affiliateClicks: clicks.count ?? 0,
        subscriptionInterests: subInterests.count ?? 0,
      });
    };
    load();
  }, []);

  if (!counts) return <p className="text-mocha">تحميل...</p>;

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="وصفات بانتظار المراجعة" value={counts.pendingRecipes} />
        <StatCard label="محاصيل بانتظار المراجعة" value={counts.pendingBeans} />
        <StatCard label="موردين بانتظار المراجعة" value={counts.pendingSuppliers} />
        <StatCard label="إجمالي المحامص" value={counts.totalRoasters} />
        <StatCard label="إجمالي الموردين" value={counts.totalSuppliers} />
        <StatCard label="إجمالي المستخدمين" value={counts.totalProfiles} />
        <StatCard label="ضغطات روابط الشراء" value={counts.affiliateClicks} />
        <StatCard label="طلبات اهتمام بالاشتراك" value={counts.subscriptionInterests} />
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-stone bg-sand/40 p-5 text-sm text-mocha">
        <strong className="text-coffee">الزيارات وتنزيلات التطبيق:</strong> لسه ما مربوطة —
        تحتاج تفعيل PostHog بتطبيق الجوال أول عشان يكون عندنا أرقام حقيقية نعرضها هنا.
      </div>
    </div>
  );
}
