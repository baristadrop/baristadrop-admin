'use client';

import * as RadixAlertDialog from '@radix-ui/react-dialog';
import { Button } from './Button';

export function AlertDialog({
  open,
  title,
  description,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  destructive = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <RadixAlertDialog.Root open={open} onOpenChange={(v) => !v && onCancel()}>
      <RadixAlertDialog.Portal>
        <RadixAlertDialog.Overlay className="fixed inset-0 z-50 bg-ink/50 animate-fade-in" />
        <RadixAlertDialog.Content className="fixed start-1/2 top-1/2 z-50 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-latte bg-white p-6 shadow-lg animate-scale-in">
          <RadixAlertDialog.Title className="text-base font-bold text-ink">{title}</RadixAlertDialog.Title>
          {description && <RadixAlertDialog.Description className="mt-2 text-sm text-mocha">{description}</RadixAlertDialog.Description>}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button variant={destructive ? 'danger' : 'primary'} size="sm" onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </RadixAlertDialog.Content>
      </RadixAlertDialog.Portal>
    </RadixAlertDialog.Root>
  );
}
