'use client';

import * as RadixDropdown from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';

export const DropdownMenu = RadixDropdown.Root;
export const DropdownMenuTrigger = RadixDropdown.Trigger;

export function DropdownMenuContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <RadixDropdown.Portal>
      <RadixDropdown.Content
        align="end"
        sideOffset={6}
        className={cn('z-50 min-w-[10rem] rounded-xl border border-latte bg-white p-1 shadow-lg', className)}
      >
        {children}
      </RadixDropdown.Content>
    </RadixDropdown.Portal>
  );
}

export function DropdownMenuItem({
  className,
  danger,
  ...props
}: React.ComponentProps<typeof RadixDropdown.Item> & { danger?: boolean }) {
  return (
    <RadixDropdown.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-sand',
        danger ? 'text-danger data-[highlighted]:bg-danger-bg' : 'text-ink',
        className
      )}
      {...props}
    />
  );
}
