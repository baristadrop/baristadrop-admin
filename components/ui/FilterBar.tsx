import { cn } from '@/lib/utils';

export type FilterOption = { value: string; label: string; count?: number };

export function FilterBar({
  options,
  value,
  onChange,
  className,
}: {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex gap-2 overflow-x-auto pb-1', className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
              active ? 'border-gold bg-gold text-white' : 'border-latte bg-white text-coffee hover:border-gold hover:text-gold'
            )}
          >
            {opt.label}
            {typeof opt.count === 'number' && <span className="ms-1 opacity-70">({opt.count})</span>}
          </button>
        );
      })}
    </div>
  );
}
