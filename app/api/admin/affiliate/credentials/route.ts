import { NextResponse } from 'next/server';
import { storeProviderCredential } from '@/lib/affiliate/providers/credentials';
import { requireAdmin } from '@/lib/adminAuth';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { withErrorHandler } from '@/lib/errorHandler';

// POST { integrationId, credentialType, value } -- يشفّر القيمة (AES-256-GCM)
// ويخزّنها بـ affiliate_provider_credentials. القيمة الخام (API key حقيقي
// لشبكة أفيليت) ما تُخزَّن أبداً بأي مكان ثاني، ولا ترجع بأي استجابة لاحقة.
export const POST = withErrorHandler(async (request: Request) => {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { integrationId?: string; credentialType?: string; value?: string };
  if (!body.integrationId || !body.credentialType || !body.value) {
    return NextResponse.json({ error: 'integrationId, credentialType, and value are required' }, { status: 400 });
  }

  const supabase = getAdminClient();
  await storeProviderCredential(supabase, {
    integrationId: body.integrationId,
    credentialType: body.credentialType,
    value: body.value,
  });
  return NextResponse.json({ ok: true });
});
