'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/Skeleton';

const COLORS = { roaster: '#e8a84c', cafe: '#6ba8d8' };
const LABEL: Record<string, string> = { roaster: 'محامص', cafe: 'كوفي شوبات' };

export function BusinessTypeDonut() {
  const [data, setData] = useState<{ type: string; count: number }[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    // عدّين خفيفين (head: true) بدل سحب جدول roasters كامل والعدّ في
    // الجافاسكربت -- نفس النتيجة بحمولة شبه معدومة.
    Promise.all([
      supabase.from('roasters').select('id', { count: 'exact', head: true }).eq('business_type', 'roaster'),
      supabase.from('roasters').select('id', { count: 'exact', head: true }).eq('business_type', 'cafe'),
    ]).then(([roasterRes, cafeRes]) => {
      if (cancelled) return;
      setData([
        { type: 'roaster', count: roasterRes.count ?? 0 },
        { type: 'cafe', count: cafeRes.count ?? 0 },
      ]);
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
            <Cell key={d.type} fill={COLORS[d.type as keyof typeof COLORS] ?? '#a89070'} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ borderRadius: 12, border: '1px solid #5c4634', background: '#241a13', color: '#f4e7d2', fontSize: 12, direction: 'rtl' }}
          formatter={(value, name) => [value, LABEL[name as string] ?? name]}
        />
        <Legend formatter={(name) => LABEL[name] ?? name} wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
