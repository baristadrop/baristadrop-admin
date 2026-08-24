import { Card } from './Card';

export function ChartCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        {action}
      </div>
      <div className="h-64 w-full">{children}</div>
    </Card>
  );
}
