'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
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
  users: '#171a2b', // coffee
  premium: '#5b5fc7', // gold (indigo)
  revenue: '#6165c9', // gold-soft
  grid: '#dcdce6', // latte -- خط شبكة خفيف، ما يزاحم البيانات
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
  border: '1px solid #dcdce6',
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

  const lastIndex = rows.length - 1;
  const endpointDot = (color: string) => (props: { cx?: number; cy?: number; index?: number }) => {
    if (props.index !== lastIndex || props.cx == null || props.cy == null) return <g key={props.index} />;
    return (
      <g key="endpoint">
        <circle cx={props.cx} cy={props.cy} r={7} fill={color} fillOpacity={0.16} />
        <circle cx={props.cx} cy={props.cy} r={3.5} fill={color} stroke="#fff" strokeWidth={1.5} />
      </g>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-latte bg-paper p-5 shadow-sm">
        <p className="mb-4 text-sm font-semibold text-coffee">نمو المستخدمين (آخر 30 يوم)</p>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={rows} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="premiumFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.premium} stopOpacity={0.22} />
                <stop offset="100%" stopColor={COLORS.premium} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tickFormatter={shortDate} tick={{ fontSize: 11, fill: '#6b6f85' }} minTickGap={24} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b6f85' }} width={28} />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ stroke: COLORS.grid, strokeWidth: 1 }}
              labelFormatter={(v) => shortDate(String(v))}
              formatter={(value, name) => [value, name === 'new_users' ? 'مستخدمين جدد' : 'مشتركين بريميوم جدد']}
            />
            <Legend
              formatter={(name) => (name === 'new_users' ? 'مستخدمين جدد' : 'مشتركين بريميوم جدد')}
              wrapperStyle={{ fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="new_users"
              stroke={COLORS.users}
              strokeWidth={2}
              dot={endpointDot(COLORS.users)}
            />
            <Area
              type="monotone"
              dataKey="new_premium_subscribers"
              stroke={COLORS.premium}
              strokeWidth={2.5}
              fill="url(#premiumFill)"
              dot={endpointDot(COLORS.premium)}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-2xl border border-latte bg-paper p-5 shadow-sm">
        <p className="mb-4 text-sm font-semibold text-coffee">إيراد الكريدت اليومي (آخر 30 يوم)</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={rows} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.revenue} stopOpacity={1} />
                <stop offset="100%" stopColor={COLORS.revenue} stopOpacity={0.55} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tickFormatter={shortDate} tick={{ fontSize: 11, fill: '#6b6f85' }} minTickGap={24} />
            <YAxis tick={{ fontSize: 11, fill: '#6b6f85' }} width={28} />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: COLORS.grid, fillOpacity: 0.3 }}
              labelFormatter={(v) => shortDate(String(v))}
              formatter={(value) => [`${Number(value).toFixed(2)} د.إ`, 'الإيراد']}
            />
            <Bar dataKey="credit_revenue_aed" fill="url(#revenueFill)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
