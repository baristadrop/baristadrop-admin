import { cn } from '@/lib/utils';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';

const BADGE_STYLES: Record<BadgeVariant, string> = {
  success: 'bg-success-bg text-success border-success/30',
  warning: 'bg-warning-bg text-warning border-warning/30',
  danger: 'bg-danger-bg text-danger border-danger/30',
  info: 'bg-info-bg text-info border-info/30',
  neutral: 'bg-sand text-coffee border-latte',
  accent: 'bg-gold/10 text-gold border-gold/30',
};

export function Badge({
  variant = 'neutral',
  className,
  children,
}: {
  variant?: BadgeVariant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        BADGE_STYLES[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
