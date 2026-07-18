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
};

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-latte bg-white p-5 shadow-sm">
      <p className="text-sm text-mocha">{label}</p>
      <p className="mt-1 font-[var(--font-el-messiri)] text-3xl text-ink">{value}</p>
    </div>
  );
}

export function OverviewTab() {
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    const load = async () => {
      const [recipes, beans, suppliers, roasters, allSuppliers, profiles] = await Promise.all([
        supabase.from('recipes').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('beans').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('suppliers').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('roasters').select('id', { count: 'exact', head: true }),
        supabase.from('suppliers').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
      ]);
      setCounts({
        pendingRecipes: recipes.count ?? 0,
        pendingBeans: beans.count ?? 0,
        pendingSuppliers: suppliers.count ?? 0,
        totalRoasters: roasters.count ?? 0,
        totalSuppliers: allSuppliers.count ?? 0,
        totalProfiles: profiles.count ?? 0,
      });
    };
    load();
  }, []);

  if (!counts) return <p className="text-mocha">تحميل...</p>;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      <StatCard label="وصفات بانتظار المراجعة" value={counts.pendingRecipes} />
      <StatCard label="محاصيل بانتظار المراجعة" value={counts.pendingBeans} />
      <StatCard label="موردين بانتظار المراجعة" value={counts.pendingSuppliers} />
      <StatCard label="إجمالي المحامص" value={counts.totalRoasters} />
      <StatCard label="إجمالي الموردين" value={counts.totalSuppliers} />
      <StatCard label="إجمالي المستخدمين" value={counts.totalProfiles} />
    </div>
  );
}
