'use client';

export function PortalShell({
  subtitle,
  title,
  userLabel,
  onSignOut,
  children,
}: {
  subtitle: string;
  title: string;
  userLabel?: string | null;
  onSignOut: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper lg:flex">
      <aside className="border-b border-latte/70 bg-cream lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-l">
        <div className="px-5 py-5">
          <h1 className="font-[var(--font-cormorant)] text-xl font-bold tracking-wide text-ink">BARISTA DROP</h1>
          <p className="text-xs text-mocha">{subtitle}</p>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 border-b border-latte/70 bg-cream/95 shadow-[0_1px_0_0_rgba(0,0,0,0.02)] backdrop-blur">
          <div className="flex items-center justify-between px-6 py-4">
            <h2 className="font-[var(--font-el-messiri)] text-lg text-ink">{title}</h2>
            <div className="flex items-center gap-3 text-sm text-mocha">
              {userLabel && (
                <span className="rounded-full bg-sand/70 px-3 py-1.5 font-medium text-coffee">{userLabel}</span>
              )}
              <button
                onClick={onSignOut}
                className="rounded-full border border-latte px-3 py-1.5 font-medium text-coffee transition hover:border-coffee hover:bg-sand"
              >
                تسجيل خروج
              </button>
            </div>
          </div>
        </header>

        <main className="px-6 py-8">
          <div className="mx-auto max-w-3xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
