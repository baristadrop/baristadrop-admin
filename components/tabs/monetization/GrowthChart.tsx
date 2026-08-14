'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { supabase } from '@/lib/supabase';

type DayRow = {
  day: string;
  new_users: number;
  new_premium_subscribers: number;
  credit_revenue_aed: number;
};

const COLORS = {
  users: '#3a2e24', // coffee
  premium: '#a9793f', // gold
  revenue: '#c9a876', // gold-soft
  grid: '#e2d7c5', // latte -- خط شبكة خفيف، ما يزاحم البيانات
};

function shortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('ar', { day: 'numeric', month: 'short' });
}

function ChartSkeleton() {
  return <div className="h-64 w-full animate-pulse rounded-2xl bg-latte/40" />;
}

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #e2d7c5',
  background: '#ffffff',
  fontSize: 12,
  direction: 'rtl' as const,
};

export function GrowthChart() {
  const [rows, setRows] = useState<DayRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .rpc('get_daily_growth_stats', { p_days: 30 })
      .then(({ data }) => {
        if (!cancelled) setRows((data as DayRow[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!rows) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-latte bg-white p-5 shadow-sm">
        <p className="mb-4 text-sm font-semibold text-coffee">نمو المستخدمين (آخر 30 يوم)</p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={rows} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tickFormatter={shortDate} tick={{ fontSize: 11, fill: '#7a6a57' }} minTickGap={24} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#7a6a57' }} width={28} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(v) => shortDate(String(v))}
              formatter={(value, name) => [value, name === 'new_users' ? 'مستخدمين جدد' : 'مشتركين جدد']}
            />
            <Legend
              formatter={(name) => (name === 'new_users' ? 'مستخدمين جدد' : 'مشتركين بريميوم جدد')}
              wrapperStyle={{ fontSize: 12 }}
            />
            <Line type="monotone" dataKey="new_users" stroke={COLORS.users} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="new_premium_subscribers" stroke={COLORS.premium} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-2xl border border-latte bg-white p-5 shadow-sm">
        <p className="mb-4 text-sm font-semibold text-coffee">إيراد الكريدت اليومي (آخر 30 يوم)</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={rows} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tickFormatter={shortDate} tick={{ fontSize: 11, fill: '#7a6a57' }} minTickGap={24} />
            <YAxis tick={{ fontSize: 11, fill: '#7a6a57' }} width={28} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(v) => shortDate(String(v))}
              formatter={(value) => [`${Number(value).toFixed(2)} د.إ`, 'الإيراد']}
            />
            <Bar dataKey="credit_revenue_aed" fill={COLORS.revenue} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
