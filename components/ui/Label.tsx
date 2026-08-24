import { cn } from '@/lib/utils';

export function Label({
  className,
  required,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className={cn('mb-1 block text-xs font-medium text-mocha', className)} {...props}>
      {children}
      {required && <span className="text-danger"> *</span>}
    </label>
  );
}
