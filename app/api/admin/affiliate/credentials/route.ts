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

// PATCH ?id=... { value } -- تدوير بيانات اعتماد موجودة. storeProviderCredential
// إدراج فقط (ما يحدّث صفاً موجوداً)، فالتدوير = احذف القديم ثم أدرِج الجديد
// بنفس integration_id + credential_type. ما فيه قيد فريد على القاعدة، بس
// نحذف أولاً عشان ما يتراكم صفّان لنفس النوع. لو فشل الإدراج بعد الحذف
// نرجّع خطأ صريح (البيانة الخام ضاعت -- الأدمن يعيد إدخالها من زر "إضافة").
export const PATCH = withErrorHandler(async (request: Request) => {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { value?: string };
  if (!body.value || !body.value.trim()) {
    return NextResponse.json({ error: 'value is required' }, { status: 400 });
  }

  const supabase = getAdminClient();
  const { data: existing, error: fetchError } = await supabase
    .from('affiliate_provider_credentials')
    .select('integration_id, credential_type')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'credential not found' }, { status: 404 });
  }

  const { error: deleteError } = await supabase.from('affiliate_provider_credentials').delete().eq('id', id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });

  try {
    await storeProviderCredential(supabase, {
      integrationId: existing.integration_id as string,
      credentialType: existing.credential_type as string,
      value: body.value.trim(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `فشل حفظ القيمة الجديدة بعد حذف القديمة -- أعد إدخال البيانات من زر الإضافة. (${err instanceof Error ? err.message : String(err)})` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
});

// DELETE ?id=... -- إلغاء (حذف) بيانات اعتماد مزوّد. بعد الحذف، أي مزامنة
// تحويلات تفشل بـ AUTHENTICATION_ERROR حتى تُضاف بيانات بديلة.
export const DELETE = withErrorHandler(async (request: Request) => {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const supabase = getAdminClient();
  const { data: existing } = await supabase
    .from('affiliate_provider_credentials')
    .select('integration_id')
    .eq('id', id)
    .single();

  const { error } = await supabase.from('affiliate_provider_credentials').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // تحذير لو صارت آخر بيانة اعتماد للتكامل
  let remaining: number | null = null;
  if (existing?.integration_id) {
    const { count } = await supabase
      .from('affiliate_provider_credentials')
      .select('id', { count: 'exact', head: true })
      .eq('integration_id', existing.integration_id);
    remaining = count ?? 0;
  }

  return NextResponse.json({ ok: true, remaining });
});
