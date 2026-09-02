'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { InfoTip } from '../ui/InfoTip';
import { GrowthChart } from './monetization/GrowthChart';
import { FilterBar } from '@/components/ui/FilterBar';

type Stats = {
  total_users: number;
  active_premium: number;
  trial_premium: number;
  credits_only_users: number;
  converted_users: number;
  premium_revenue_ios_aed: number;
  premium_revenue_android_aed: number;
  credits_revenue_recurring_aed: number;
  credits_revenue_onetime_aed: number;
};

const PERIOD_FILTERS: { value: 'all' | 'month'; label: string }[] = [
  { value: 'all', label: 'كل الوقت' },
  { value: 'month', label: 'هذا الشهر' },
];

function periodSince(period: 'all' | 'month'): string | undefined {
  if (period !== 'month') return undefined;
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function StatCard({
  label,
  value,
  info,
  size = 'sm',
}: {
  label: React.ReactNode;
  value: number | string;
  info?: string;
  size?: 'lg' | 'sm';
}) {
  const isLg = size === 'lg';
  return (
    <div
      className={`rounded-2xl border bg-paper text-right shadow-sm ${
        isLg ? 'border-gold/40 p-6' : 'border-latte p-5'
      }`}
    >
      <p className="flex items-center justify-end gap-1 text-sm text-mocha">
        {info && <InfoTip text={info} />}
        {label}
      </p>
      <p
        className={`mt-1.5 font-[var(--font-el-messiri)] text-ink ${
          isLg ? 'text-[2.75rem] leading-none' : 'text-3xl'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function aed(n: number) {
  return `${n.toLocaleString('ar', { maximumFractionDigits: 0 })} د.إ`;
}

export function MonetizationTab() {
  const [period, setPeriod] = useState<'all' | 'month'>('all');
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    supabase
      .rpc('get_monetization_stats', { p_since: periodSince(period) ?? null })
      .then(({ data }) => setStats((data as Stats[])?.[0] ?? null));
  }, [period]);

  const conversionRate =
    stats && stats.total_users > 0 ? ((stats.converted_users / stats.total_users) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      <FilterBar options={PERIOD_FILTERS} value={period} onChange={(v) => setPeriod(v as 'all' | 'month')} />

      <GrowthChart />

      {!stats ? (
        <p className="text-mocha">تحميل...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="إجمالي المستخدمين" value={stats.total_users} size="lg" />
            <StatCard
              label="معدل التحويل"
              value={`${conversionRate}%`}
              info="نسبة المستخدمين اللي تحوّلوا لمشترك بريميوم أو اشتروا كريدت، من إجمالي المستخدمين."
              size="lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="مشتركي بريميوم"
              value={stats.active_premium + stats.trial_premium}
              info={`${stats.active_premium} فعّال، ${stats.trial_premium} بالتجربة المجانية.`}
            />
            <StatCard
              label="مستخدمي كريدت فقط"
              value={stats.credits_only_users}
              info="اشتروا كريدت أو استخدموا الكريدت المجاني، بدون أي اشتراك بريميوم."
            />
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold tracking-wide text-stone">
              إيراد الاشتراكات (منفصل حسب المتجر عمداً -- عمولة كل متجر مختلفة)
            </p>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-2">
              <StatCard label="إيراد آبل (iOS)" value={aed(stats.premium_revenue_ios_aed)} />
              <StatCard label="إيراد جوجل (Android)" value={aed(stats.premium_revenue_android_aed)} />
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold tracking-wide text-stone">إيراد الكريدت</p>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-2">
              <StatCard
                label="عملاء متكررين"
                value={aed(stats.credits_revenue_recurring_aed)}
                info="من مستخدمين اشتروا حزمة كريدت أكثر من مرة."
              />
              <StatCard
                label="عملاء مرة وحدة"
                value={aed(stats.credits_revenue_onetime_aed)}
                info="من مستخدمين اشتروا حزمة كريدت مرة وحدة بس."
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
