export function PageHeader({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-mocha/30 bg-espresso/95 shadow-[0_1px_0_0_rgba(0,0,0,0.2)] backdrop-blur">
      <div className="flex items-center justify-between px-6 py-4">
        <h2 className="font-[var(--font-el-messiri)] text-lg text-cream">{title}</h2>
        <div className="flex items-center gap-3 text-sm text-stone">{children}</div>
      </div>
    </header>
  );
}
