'use client';

import * as RadixToast from '@radix-ui/react-toast';
import { createContext, useCallback, useContext, useState } from 'react';
import { cn } from '@/lib/utils';

type ToastVariant = 'default' | 'success' | 'destructive';
type ToastInput = { title: string; description?: string; variant?: ToastVariant };
type ToastItem = ToastInput & { id: number };

const ToastCtx = createContext<{ toast: (t: ToastInput) => void } | null>(null);

const VARIANT_STYLES: Record<ToastVariant, string> = {
  default: 'border-latte bg-paper text-ink',
  success: 'border-success/30 bg-success-bg text-success',
  destructive: 'border-danger/30 bg-danger-bg text-danger',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((t: ToastInput) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { ...t, id }]);
  }, []);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  return (
    <ToastCtx.Provider value={{ toast }}>
      <RadixToast.Provider swipeDirection="right" duration={4000}>
        {children}
        {items.map((item) => (
          <RadixToast.Root
            key={item.id}
            onOpenChange={(open) => !open && remove(item.id)}
            className={cn(
              'animate-slide-up rounded-xl border px-4 py-3 shadow-lg',
              VARIANT_STYLES[item.variant ?? 'default']
            )}
          >
            <RadixToast.Title className="text-sm font-semibold">{item.title}</RadixToast.Title>
            {item.description && <RadixToast.Description className="mt-0.5 text-xs opacity-90">{item.description}</RadixToast.Description>}
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className="fixed bottom-4 end-4 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 outline-none" />
      </RadixToast.Provider>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
