'use client';

import { StatCardSkeletonGrid } from '@/components/ui/Skeleton';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { EmptyState } from '@/components/ui/EmptyState';

type TopBean = {
  id: string;
  name: string;
  origin: string | null;
  avg_rating: number;
  reviews_count: number;
  roasters: { name: string } | null;
};

export function TopBeansTab() {
  const [rows, setRows] = useState<TopBean[] | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('beans')
        .select('id, name, origin, avg_rating, reviews_count, roasters!beans_roaster_id_fkey(name)')
        .eq('status', 'approved')
        .gt('reviews_count', 0)
        .order('avg_rating', { ascending: false })
        .order('reviews_count', { ascending: false })
        .limit(10)
        .returns<TopBean[]>();
      setRows(data ?? []);
    };
    load();
  }, []);

  if (!rows) return <StatCardSkeletonGrid />;

  return (
    <div>
      <p className="mb-4 text-sm text-mocha">
        تتحدّث تلقائياً من تقييمات المستخدمين الحقيقية بالتطبيق — انسخها مباشرة لبوست "أفضل 10 محاصيل هالشهر".
      </p>
      {rows.length === 0 ? (
        <EmptyState
          title="ما فيه محاصيل عليها تقييمات حقيقية بعد"
          description="القائمة بتتعبّى تلقائياً أول ما المستخدمين يبدأون يقيّمون الوصفات بالتطبيق."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-latte bg-white shadow-sm">
          {rows.map((b, i) => (
            <div
              key={b.id}
              className="flex items-center justify-between border-b border-latte/60 p-4 last:border-0"
            >
              <div className="flex items-center gap-3">
                <span className="font-[var(--font-el-messiri)] text-lg text-gold">#{i + 1}</span>
                <div>
                  <p className="text-sm font-medium text-ink">{b.name}</p>
                  <p className="text-xs text-mocha">
                    {b.roasters?.name ?? '—'} {b.origin ? `· ${b.origin}` : ''}
                  </p>
                </div>
              </div>
              <div className="text-left">
                <p className="font-bold text-coffee">★ {b.avg_rating.toFixed(1)}</p>
                <p className="text-xs text-stone">{b.reviews_count} تقييم</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
