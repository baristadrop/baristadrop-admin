import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { withErrorHandler } from '@/lib/errorHandler';
import { sendExpoPush } from '@/lib/pushNotifications';

// لا يوجد بالمشروع نظام إشعار موجّه لمستخدم واحد قبل هذا -- send-notification/route.ts
// الموجود يبث لجمهور/شريحة كاملة فقط. best-effort فقط (لو ما عنده إذن
// إشعارات، ما توصله -- الاعتماد الأساسي على بشارة الرفض بشاشة "إعلاناتي").
export const POST = withErrorHandler(async (request: Request) => {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { listingId?: string };
  if (!body.listingId) return NextResponse.json({ error: 'listingId is required' }, { status: 400 });

  const supabase = getAdminClient();
  const { data: listing } = await supabase
    .from('marketplace_listings')
    .select('owner_id, title, rejection_reason')
    .eq('id', body.listingId)
    .maybeSingle();

  if (!listing) return NextResponse.json({ ok: true, sent: false });

  const { data: owner } = await supabase
    .from('profiles')
    .select('push_token')
    .eq('id', listing.owner_id)
    .eq('notifications_enabled', true)
    .not('push_token', 'is', null)
    .maybeSingle();

  if (!owner?.push_token) return NextResponse.json({ ok: true, sent: false });

  await sendExpoPush([
    {
      to: owner.push_token,
      title: 'إعلانك يحتاج تعديل',
      body: listing.rejection_reason
        ? `"${listing.title}" — ${listing.rejection_reason}`
        : `إعلانك "${listing.title}" يحتاج تعديل قبل النشر`,
    },
  ]);

  return NextResponse.json({ ok: true, sent: true });
});
