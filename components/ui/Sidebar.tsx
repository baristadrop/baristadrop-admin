'use client';

import { memo, useEffect, useState } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { ChevronDown, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SidebarTab<K extends string> = {
  key: K;
  label: string;
  Icon: (props: { className?: string }) => React.JSX.Element;
  badge?: number;
};
export type SidebarGroup<K extends string> = { label: string; tabs: SidebarTab<K>[] };

const STORAGE_KEY = 'admin-sidebar-collapsed-groups';

function useCollapsedGroups() {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setCollapsed(JSON.parse(raw));
    } catch {
      // localStorage may be unavailable — fall back to all-expanded, no persistence
    }
  }, []);

  const toggle = (label: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore persistence failure
      }
      return next;
    });
  };

  return { collapsed, toggle };
}

function SidebarNavInner<K extends string>({
  groups,
  active,
  onSelect,
}: {
  groups: SidebarGroup<K>[];
  active: K;
  onSelect: (key: K) => void;
}) {
  const { collapsed, toggle } = useCollapsedGroups();

  return (
    <nav className="flex flex-col gap-5 px-3 pb-6">
      {groups.map((group) => {
        const isCollapsed = collapsed[group.label];
        return (
          <div key={group.label}>
            <button
              type="button"
              onClick={() => toggle(group.label)}
              className="mb-1.5 flex w-full items-center justify-between px-2 text-[11px] font-semibold tracking-wide text-sand/70 hover:text-sand"
            >
              {group.label}
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isCollapsed && '-rotate-90')} />
            </button>
            {!isCollapsed && (
              <div className="flex flex-col gap-1">
                {group.tabs.map((tab) => {
                  const Icon = tab.Icon;
                  const isActive = active === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => onSelect(tab.key)}
                      className={cn(
                        'flex items-center gap-2.5 rounded-xl border-s-2 px-3 py-2 text-sm font-medium transition',
                        isActive ? 'border-gold bg-gold text-cream shadow-sm' : 'border-transparent text-sand hover:bg-white/5'
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-cream' : 'text-sand')} />
                      <span className="flex-1 text-right">{tab.label}</span>
                      {typeof tab.badge === 'number' && tab.badge > 0 && (
                        <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold text-cream">
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

const SidebarNav = memo(SidebarNavInner) as typeof SidebarNavInner;

function SidebarInner<K extends string>({
  groups,
  active,
  onSelect,
  header,
}: {
  groups: SidebarGroup<K>[];
  active: K;
  onSelect: (key: K) => void;
  header: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* سطح المكتب/التابلت: شريط جانبي ثابت */}
      <aside className="hidden border-s border-mocha/30 bg-coffee lg:block lg:h-screen lg:w-64 lg:shrink-0 lg:overflow-y-auto">
        <div className="px-5 py-5">{header}</div>
        <SidebarNav groups={groups} active={active} onSelect={onSelect} />
      </aside>

      {/* الموبايل: زر الهامبرغر + درج منزلق */}
      <div className="border-b border-mocha/30 bg-coffee px-4 py-3 lg:hidden">
        <div className="flex items-center justify-between">
          {header}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-sand hover:bg-white/10"
            aria-label="فتح القائمة"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      <RadixDialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-40 bg-ink/60 lg:hidden" />
          <RadixDialog.Content className="fixed inset-y-0 start-0 z-50 w-72 overflow-y-auto bg-coffee shadow-lg lg:hidden">
            <RadixDialog.Title className="sr-only">القائمة</RadixDialog.Title>
            <div className="flex items-center justify-between px-5 py-5">
              {header}
              <RadixDialog.Close className="rounded-lg p-2 text-sand hover:bg-white/10">
                <X className="h-5 w-5" />
              </RadixDialog.Close>
            </div>
            <SidebarNav
              groups={groups}
              active={active}
              onSelect={(key) => {
                onSelect(key);
                setMobileOpen(false);
              }}
            />
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>
    </>
  );
}

// مقارنة مخصّصة عشان الشريط الجانبي ما يعيد رندر إلا لما شي فعلاً يتغيّر
// (تبويب فعّال، أو مجموعات التنقّل، أو الهيدر) -- بدل كل مرة الأب يعيد
// الرندر (مثلاً بسبب state ثانية بالداشبورد).
export const Sidebar = memo(SidebarInner, (prev, next) => {
  return prev.active === next.active && prev.groups === next.groups && prev.header === next.header;
}) as typeof SidebarInner;
