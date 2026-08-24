'use client';

import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
};

export function Input({ className, error, ...props }: InputProps) {
  return (
    <div>
      <input
        className={cn(
          'h-10 w-full rounded-xl border bg-white px-3 text-sm text-ink placeholder:text-stone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50',
          error ? 'border-danger' : 'border-latte',
          className
        )}
        aria-invalid={Boolean(error)}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
