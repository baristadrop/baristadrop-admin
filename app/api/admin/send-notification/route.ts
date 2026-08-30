import { requireAdmin } from '@/lib/adminAuth';
import { getAdminClient } from '@/lib/supabaseAdmin';

const AUDIENCE_ROLES: Record<string, string[] | null> = {
  all: null,
  user: ['user'],
  roaster: ['roaster'],
  supplier: ['supplier'],
  cafe: ['cafe'],
  premium: null, // مفلترة بتاريخ الاشتراك لا بالدور -- انظر الاستعلام تحت
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function POST(request: Request) {
  const caller = await requireAdmin(request);
  if (!caller) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json();
  const { title, body: messageBody, audience } = body as { title: string; body: string; audience: string };
  if (!title?.trim() || !messageBody?.trim()) {
    return Response.json({ error: 'missing fields' }, { status: 400 });
  }
  if (!(audience in AUDIENCE_ROLES)) {
    return Response.json({ error: 'invalid audience' }, { status: 400 });
  }

  const admin = getAdminClient();
  let query = admin
    .from('profiles')
    .select('push_token')
    .eq('notifications_enabled', true)
    .not('push_token', 'is', null);

  const roles = AUDIENCE_ROLES[audience];
  if (roles) query = query.in('role', roles);
  if (audience === 'premium') query = query.gt('premium_expires_at', new Date().toISOString());

  const { data: recipients, error: fetchError } = await query;
  if (fetchError) return Response.json({ error: fetchError.message }, { status: 500 });

  const tokens = (recipients ?? []).map((r) => r.push_token).filter(Boolean) as string[];

  // Expo's push API accepts up to 100 messages per request.
  const batches = chunk(tokens, 100);
  for (const batch of batches) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(
        batch.map((to) => ({ to, title: title.trim(), body: messageBody.trim(), sound: 'default' }))
      ),
    }).catch(() => null);
  }

  await admin.from('marketing_notifications').insert({
    title: title.trim(),
    body: messageBody.trim(),
    audience,
    sent_count: tokens.length,
    sent_by: caller.id,
  });

  return Response.json({ ok: true, sentCount: tokens.length });
}

export async function GET(request: Request) {
  const caller = await requireAdmin(request);
  if (!caller) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const admin = getAdminClient();
  const { data, error } = await admin
    .from('marketing_notifications')
    .select('id, title, body, audience, sent_count, created_at')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ history: data ?? [] });
}
