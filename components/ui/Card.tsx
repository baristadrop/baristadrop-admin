import { cn } from '@/lib/utils';

export function Card({
  className,
  interactive,
  onClick,
  children,
}: {
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-2xl border border-latte bg-paper shadow-sm',
        interactive && 'card-interactive cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('border-b border-latte px-5 py-4', className)}>{children}</div>;
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('p-5', className)}>{children}</div>;
}

export function CardFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('border-t border-latte px-5 py-4', className)}>{children}</div>;
}
