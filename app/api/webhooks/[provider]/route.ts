import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { withErrorHandler } from '@/lib/errorHandler';
import { ProviderFactory } from '@/lib/affiliate/providers/factory';
import { enqueueJob } from '@/lib/affiliate/jobs';

// POST /api/webhooks/:provider -- مستقبِل ويبهوك عام لشبكات الأفيليت
// (Awin/CJ/Amazon) بخلاف webhooks/affiliate-purchase (اللي يخدم المسار
// المباشر synchronous فقط). يخزّن الحدث الخام أولاً (أثر جنائي) ثم يجدول
// معالجة غير متزامنة عبر طابور المهام -- runProcessAffiliateWebhook
// بـ jobRunners.ts يفكّه لاحقاً عبر ProviderFactory.parseConversion.
export const POST = withErrorHandler(async (request: Request) => {
  const urlParts = new URL(request.url).pathname.split('/');
  const providerCode = urlParts[urlParts.length - 1];

  // يتأكد المزوّد معروف (يرمي خطأ لمزوّد غير مسجّل -- withErrorHandler يردّه 500 آمن)
  ProviderFactory.forCode(providerCode);

  const supabase = getAdminClient();
  const rawText = await request.text();
  // raw_payload عمود jsonb -- لو الجسم مو JSON صالح (بعض المزوّدين يرسلون
  // form-encoded)، نلفّه بكائن عشان الإدراج ما يفشل ويضيع الحدث الخام.
  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(rawText);
  } catch {
    rawPayload = { raw: rawText };
  }

  const { data: postback, error: insertError } = await supabase
    .from('affiliate_postback_events')
    .insert({
      provider_code: providerCode,
      raw_payload: rawPayload,
      status: 'received',
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
