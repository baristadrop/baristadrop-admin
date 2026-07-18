'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type EngagementCounts = {
  affiliateClicks: number;
  subscriptionInterests: number;
};

type PostHogStats = {
  connected: boolean;
  uniqueVisitors30d: number;
  appOpens30d: number;
  newInstalls30d: number;
};

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-latte bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-mocha">{label}</p>
      <p className="mt-1 font-[var(--font-el-messiri)] text-xl font-bold text-ink">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold tracking-wide text-stone">{title}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
    </div>
  );
}

export function TrackingTab() {
  const [counts, setCounts] = useState<EngagementCounts | null>(null);
  const [ph, setPh] = useState<PostHogStats | null>(null);
  const [loadingPh, setLoadingPh] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [clicks, subInterests, sessionRes] = await Promise.all([
        supabase.from('affiliate_clicks').select('id', { count: 'exact', head: true }),
        supabase.from('subscription_interests').select('id', { count: 'exact', head: true }),
        supabase.auth.getSession(),
      ]);
      setCounts({
        affiliateClicks: clicks.count ?? 0,
        subscriptionInterests: subInterests.count ?? 0,
      });

      const token = sessionRes.data.session?.access_token;
      const phRes = await fetch('/api/admin/posthog-stats', { headers: { Authorization: `Bearer ${token}` } });
      if (phRes.ok) setPh(await phRes.json());
      setLoadingPh(false);
    };
    load();
  }, []);

  if (!counts) return <p className="text-mocha">تحميل...</p>;

  return (
    <div className="flex flex-col gap-6">
      <Section title="التفاعل داخل التطبيق">
        <MiniStat label="ضغطات روابط الشراء" value={counts.affiliateClicks} />
        <MiniStat label="طلبات اهتمام بالاشتراك" value={counts.subscriptionInterests} />
      </Section>

      <Section title="الزوار والتثبيتات (٣٠ يوم)">
        {ph?.connected ? (
          <>
            <MiniStat label="زوار فريدين" value={ph.uniqueVisitors30d} />
            <MiniStat label="مرات فتح التطبيق" value={ph.appOpens30d} />
            <MiniStat label="تثبيتات جديدة" value={ph.newInstalls30d} />
          </>
        ) : !loadingPh ? (
          <div className="col-span-full rounded-xl border border-dashed border-stone bg-sand/40 px-4 py-3 text-xs text-mocha">
            <strong className="text-coffee">ما قدرنا نجيب بيانات PostHog الحين</strong> — تأكد إن مفتاح
            POSTHOG_PERSONAL_API_KEY صحيح ومفعّل.
          </div>
        ) : null}
      </Section>
    </div>
  );
}
