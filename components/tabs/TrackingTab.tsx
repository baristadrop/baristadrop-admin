'use client';

import { StatCardSkeletonGrid } from '@/components/ui/Skeleton';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { StatCard } from '@/components/ui/StatCard';

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

  if (!counts) return <StatCardSkeletonGrid />;

  return (
    <div className="flex flex-col gap-6">
      <Section title="التفاعل داخل التطبيق">
        <StatCard label="ضغطات روابط الشراء" value={counts.affiliateClicks} />
        <StatCard label="طلبات اهتمام بالاشتراك" value={counts.subscriptionInterests} />
      </Section>

      <Section title="الزوار والتثبيتات (٣٠ يوم)">
        {ph?.connected ? (
          <>
            <StatCard label="زوار فريدين" value={ph.uniqueVisitors30d} />
            <StatCard label="مرات فتح التطبيق" value={ph.appOpens30d} />
            <StatCard label="تثبيتات جديدة" value={ph.newInstalls30d} />
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
