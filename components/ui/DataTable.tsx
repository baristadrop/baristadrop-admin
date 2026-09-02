'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmptyState } from './EmptyState';

export type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
};

export function DataTable<T extends { id: string | number }>({
  columns,
  data,
  emptyMessage = 'ما فيه بيانات',
  rowKey,
}: {
  columns: DataTableColumn<T>[];
  data: T[];
  emptyMessage?: string;
  rowKey?: (row: T) => string | number;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return data;
    return [...data].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av < bv) return -1 * sort.dir;
      if (av > bv) return 1 * sort.dir;
      return 0;
    });
  }, [data, sort, columns]);

  if (data.length === 0) return <EmptyState title={emptyMessage} />;

  const keyOf = rowKey ?? ((row: T) => row.id);

  return (
    <>
      {/* سطح المكتب: جدول كامل */}
      <div className="hidden overflow-x-auto rounded-2xl border border-latte bg-paper lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-latte bg-sand/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn('px-4 py-3 text-start text-xs font-semibold text-mocha', col.className)}
                >
                  {col.sortValue ? (
                    <button
                      type="button"
                      onClick={() =>
                        setSort((prev) =>
                          prev?.key === col.key ? { key: col.key, dir: prev.dir === 1 ? -1 : 1 } : { key: col.key, dir: 1 }
                        )
                      }
                      className="inline-flex items-center gap-1 hover:text-gold"
                    >
                      {col.header}
                      {sort?.key === col.key &&
                        (sort.dir === 1 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={keyOf(row)} className="border-b border-latte last:border-0 hover:bg-sand/30">
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-3 text-ink', col.className)}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* الموبايل: قائمة بطاقات */}
      <div className="flex flex-col gap-3 lg:hidden">
        {sorted.map((row) => (
          <div key={keyOf(row)} className="rounded-2xl border border-latte bg-paper p-4">
            {columns.map((col) => (
              <div key={col.key} className="flex items-center justify-between gap-3 py-1 text-sm">
                <span className="text-xs font-medium text-mocha">{col.header}</span>
                <span className="text-ink">{col.render(row)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
