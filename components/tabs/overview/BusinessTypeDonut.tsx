'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/Skeleton';

const COLORS = { roaster: '#9c5f28', cafe: '#b8763b' };
const LABEL: Record<string, string> = { roaster: 'محامص', cafe: 'كوفي شوبات' };

export function BusinessTypeDonut() {
  const [data, setData] = useState<{ type: string; count: number }[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('roasters')
      .select('business_type')
      .then(({ data: rows }) => {
        if (cancelled) return;
        const counts: Record<string, number> = { roaster: 0, cafe: 0 };
        for (const r of rows ?? []) {
          const t = (r as { business_type: string }).business_type;
          counts[t] = (counts[t] ?? 0) + 1;
        }
        setData(Object.entries(counts).map(([type, count]) => ({ type, count })));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return <Skeleton className="h-56 w-full" />;

  const total = data.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) return <p className="text-xs text-mocha">ما فيه شركات بعد.</p>;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="type" innerRadius={55} outerRadius={80} paddingAngle={2}>
          {data.map((d) => (
            <Cell key={d.type} fill={COLORS[d.type as keyof typeof COLORS] ?? '#8a7d68'} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ borderRadius: 12, border: '1px solid #d9cdb8', background: '#fff', fontSize: 12, direction: 'rtl' }}
          formatter={(value, name) => [value, LABEL[name as string] ?? name]}
        />
        <Legend formatter={(name) => LABEL[name] ?? name} wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
