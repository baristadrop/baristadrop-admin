import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { withErrorHandler } from '@/lib/errorHandler';
import { ProviderFactory } from '@/lib/affiliate/providers/factory';
import { enqueueJob } from '@/lib/affiliate/jobs';
import { forensicFields } from '@/lib/affiliate/conversionEngine';
import { resolveIntegration } from '@/lib/affiliate/programResolution';
import { loadProviderCredentials } from '@/lib/affiliate/providers/credentials';

// POST /api/webhooks/:provider -- مستقبِل ويبهوك عام لشبكات الأفيليت
// (Awin/CJ/Amazon) بخلاف webhooks/affiliate-purchase (اللي يخدم المسار
// المباشر synchronous فقط). يخزّن الحدث الخام أولاً (أثر جنائي) ثم يجدول
// معالجة غير متزامنة عبر طابور المهام -- runProcessAffiliateWebhook
// بـ jobRunners.ts يفكّه لاحقاً عبر ProviderFactory.parseConversion.
export const POST = withErrorHandler(async (request: Request) => {
  const urlParts = new URL(request.url).pathname.split('/');
  const providerCode = urlParts[urlParts.length - 1];

  // يتأكد المزوّد معروف (يرمي خطأ لمزوّد غير مسجّل -- withErrorHandler يردّه 500 آمن)
  const provider = ProviderFactory.forCode(providerCode);

  const supabase = getAdminClient();
  // لازم يُستنسخ قبل قراءة الجسم -- بعد .text() الجسم "مستهلك" وأي clone()
  // لاحق يفشل. المحولات الحالية تتحقق من searchParams بس (ما تقرأ الجسم)،
  // بس النسخ هنا يخلي الواجهة صحيحة لأي محول مستقبلي يحتاج جسم HMAC موقّع.
  const requestForValidation = request.clone();
  const rawText = await request.text();
  // raw_payload عمود jsonb -- لو الجسم مو JSON صالح (بعض المزوّدين يرسلون
  // form-encoded)، نلفّه بكائن عشان الإدراج ما يفشل ويضيع الحدث الخام.
  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(rawText);
  } catch {
    rawPayload = { raw: rawText };
  }

  const forensics = forensicFields(request);

  // Fix 7: سقف 30 طلب/دقيقة لكل مزوّد + مصدر -- قبل أي عمل آخر
  const { data: withinLimit } = await supabase.rpc('check_provider_webhook_rate_limit', {
    p_provider_code: providerCode,
    p_source_ip: forensics.source_ip ?? 'unknown',
  });
  if (withinLimit === false) {
    return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });
  }

  // Fix 2: حل البرنامج قبل أي شي -- بدونه القناة كلها ميتة (runProcessAffiliateWebhook
  // يرفض أي حدث بدون affiliate_program_id).
  const integration = await resolveIntegration(supabase, provider, rawPayload);
  if (!integration) {
    // نخزّن الحدث للأثر الجنائي بدون جدولة -- يُراجَع يدوياً
    await supabase.from('affiliate_postback_events').insert({
      provider_code: providerCode,
      raw_payload: rawPayload,
      status: 'rejected',
      rejection_reason: 'unresolvable_program',
      ...forensics,
    });
    return NextResponse.json({ error: 'no_matching_integration' }, { status: 422 });
  }

  // Fix 1: تفعيل التحقق الفعلي -- المعالجة غير متزامنة (الطلب انتهى وقت
  // تشغيل المهمة)، فالتحقق لازم يصير هنا بالراوت قبل الرد بـ200.
  const credentials = await loadProviderCredentials(supabase, integration.id);
  const valid =
    (await provider.validatePostback(requestForValidation.clone(), credentials)) ||
    (await provider.validateWebhook(requestForValidation.clone(), credentials));

  if (!valid) {
    await supabase.from('affiliate_postback_events').insert({
      affiliate_program_id: integration.affiliate_program_id,
      provider_code: providerCode,
      raw_payload: rawPayload,
      status: 'rejected',
      rejection_reason: 'auth_failed',
      ...forensics,
    });
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: postback, error: insertError } = await supabase
    .from('affiliate_postback_events')
    .insert({
      affiliate_program_id: integration.affiliate_program_id,
      provider_code: providerCode,
      raw_payload: rawPayload,
      status: 'received',
      ...forensics,
    })
    .select('id')
    .single();

  if (insertError) throw insertError;

  await enqueueJob(supabase, 'ProcessAffiliateWebhook', {
    postbackEventId: postback.id,
    providerCode,
  });

  return NextResponse.json({ ok: true, postback_event_id: postback.id });
});
