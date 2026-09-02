'use client';

import * as RadixCheckbox from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Checkbox({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  className?: string;
}) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2', className)}>
      <RadixCheckbox.Root
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="flex h-5 w-5 items-center justify-center rounded-md border border-latte bg-paper data-[state=checked]:border-gold data-[state=checked]:bg-gold"
      >
        <RadixCheckbox.Indicator>
          <Check className="h-3.5 w-3.5 text-on-gold" />
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
      {label && <span className="text-sm text-ink">{label}</span>}
    </label>
  );
}
