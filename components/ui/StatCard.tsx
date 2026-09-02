import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  trend,
  icon,
  onClick,
  urgent,
  className,
}: {
  label: string;
  value: number | string;
  trend?: { value: number; label: string };
  icon?: React.ReactNode;
  onClick?: () => void;
  /** يبرز البطاقة (حدّ وخلفية ذهبية) لما القيمة > 0 -- لعناصر تحتاج انتباه فوري زي "معلّق للمراجعة". */
  urgent?: boolean;
  className?: string;
}) {
  const positive = trend ? trend.value >= 0 : null;
  const isUrgentActive = urgent && Number(value) > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'flex flex-col gap-2 rounded-2xl border p-4 text-start shadow-sm',
        isUrgentActive ? 'border-gold/60 bg-sand' : 'border-latte bg-paper',
        onClick && 'card-interactive cursor-pointer',
        !onClick && 'cursor-default',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-mocha">{label}</span>
        {icon && <span className="text-gold">{icon}</span>}
      </div>
      <span className="text-2xl font-bold text-ink">{value}</span>
      {trend && (
        <span className={cn('text-xs font-medium', positive ? 'text-success' : 'text-danger')}>
          {positive ? '▲' : '▼'} {Math.abs(trend.value)}% {trend.label}
        </span>
      )}
    </button>
  );
}
