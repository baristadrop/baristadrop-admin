import { cn } from '@/lib/utils';

export function Avatar({
  src,
  name,
  size = 40,
  className,
}: {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size }}
        className={cn('rounded-full object-cover', className)}
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className={cn('flex items-center justify-center rounded-full bg-gold/15 text-xs font-bold text-gold', className)}
    >
      {initials || '?'}
    </div>
  );
}
