import { requireAdmin } from '@/lib/adminAuth';
import { getAdminClient } from '@/lib/supabaseAdmin';

export async function GET(request: Request) {
  const caller = await requireAdmin(request);
  if (!caller) return Response.json({ error: 'unauthorized' }, { status: 403 });

  const admin = getAdminClient();
  const [{ data: authUsers }, { data: profiles }] = await Promise.all([
    admin.auth.admin.listUsers(),
    admin.from('profiles').select('id, full_name, role, country, created_at'),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const users = (authUsers?.users ?? []).map((u) => {
    const p = profileById.get(u.id);
    return {
      id: u.id,
      email: u.email,
      full_name: p?.full_name ?? null,
      role: p?.role ?? 'user',
      country: p?.country ?? null,
      created_at: u.created_at,
    };
  });

  return Response.json({ users });
}

export async function POST(request: Request) {
  const caller = await requireAdmin(request);
  if (!caller) return Response.json({ error: 'unauthorized' }, { status: 403 });

  const body = await request.json();
  const { email, password, fullName, role } = body as {
    email: string;
    password: string;
    fullName: string;
    role: string;
  };
  if (!email || !password) return Response.json({ error: 'missing fields' }, { status: 400 });

  const admin = getAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) return Response.json({ error: error.message }, { status: 400 });

  if (role && role !== 'user' && created.user) {
    await admin.from('profiles').update({ role }).eq('id', created.user.id);
  }

  return Response.json({ ok: true, userId: created.user?.id });
}

export async function PATCH(request: Request) {
  const caller = await requireAdmin(request);
  if (!caller) return Response.json({ error: 'unauthorized' }, { status: 403 });

  const body = await request.json();
  const { userId, role } = body as { userId: string; role: string };
  if (!userId || !role) return Response.json({ error: 'missing fields' }, { status: 400 });

  const admin = getAdminClient();
  const { error } = await admin.from('profiles').update({ role }).eq('id', userId);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
