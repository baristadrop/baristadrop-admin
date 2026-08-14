'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type ClickStat = {
  item_type: 'bean' | 'product';
  item_id: string;
  item_name: string;
  item_name_en: string | null;
  business_name: string | null;
  click_count: number;
};

export function ProductClicksTab() {
  const [rows, setRows] = useState<ClickStat[] | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.rpc('get_product_click_stats');
      setRows((data as ClickStat[] | null) ?? []);
    };
    load();
  }, []);

  if (!rows) return <p className="text-mocha">تحميل...</p>;

  return (
    <div>
      <p className="mb-4 text-sm text-mocha">
        نقرات الأفيليت موزّعة على كل محصول ومنتج على حدة -- تفيد لمعرفة أي عنصر فعليًا يجيب نقرات
        بدل الإجمالي العام لكل شركة فقط.
      </p>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone bg-sand/40 p-5 text-sm text-mocha">
          ما فيه نقرات أفيليت مرتبطة بمحصول أو منتج محدد بعد.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-latte bg-white shadow-sm">
          {rows.map((row) => (
            <div
              key={`${row.item_type}-${row.item_id}`}
              className="flex items-center justify-between border-b border-latte/60 p-4 last:border-0"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    row.item_type === 'bean' ? 'bg-gold/15 text-gold' : 'bg-stone/15 text-stone'
                  }`}
                >
                  {row.item_type === 'bean' ? 'محصول' : 'منتج'}
                </span>
                <div>
                  <p className="text-sm font-medium text-ink">{row.item_name}</p>
                  <p className="text-xs text-mocha">{row.business_name ?? '—'}</p>
                </div>
              </div>
              <p className="font-[var(--font-el-messiri)] text-lg font-bold text-coffee">
                {row.click_count}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
