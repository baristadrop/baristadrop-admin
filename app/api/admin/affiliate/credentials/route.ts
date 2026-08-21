import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { storeProviderCredential } from '@/lib/affiliate/providers/credentials';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// نفس نمط requireAdmin() الموجود بـ send-notification/route.ts -- الطريق
// الوحيد اللي هذا الراوت موجود لأجله أصلاً هو إن التشفير (AES) لازم يصير
// بالسيرفر (مفتاح AFFILIATE_CREDENTIAL_KEY ما يصح يوصل لأي كود عميل).
async function requireAdmin(request: Request) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return null;

  const asCaller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: userData } = await asCaller.auth.getUser(token);
  if (!userData.user) return null;

  const { data: profile } = await asCaller.from('profiles').select('role').eq('id', userData.user.id).single();
  if (profile?.role !== 'admin') return null;
  return userData.user;
}

// POST { integrationId, credentialType, value } -- يشفّر القيمة (AES-256-GCM)
// ويخزّنها بـ affiliate_provider_credentials. القيمة الخام (API key حقيقي
// لشبكة أفيليت) ما تُخزَّن أبداً بأي مكان ثاني، ولا ترجع بأي استجابة لاحقة.
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { integrationId?: string; credentialType?: string; value?: string };
  if (!body.integrationId || !body.credentialType || !body.value) {
    return NextResponse.json({ error: 'integrationId, credentialType, and value are required' }, { status: 400 });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    await storeProviderCredential(supabase, {
      integrationId: body.integrationId,
      credentialType: body.credentialType,
      value: body.value,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
