import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const botToken = process.env.TELEGRAM_BOT_TOKEN as string;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET as string;
const submitterUserId = process.env.TELEGRAM_SUBMITTER_USER_ID as string;
const anthropicApiKey = process.env.ANTHROPIC_API_KEY as string;

/** روستر بديل تُنسب له المحاصيل اللي ما إلها محمصة معروفة — نفس الثابت المستخدم بـ AddRecipeModal بالتطبيق */
const COMMUNITY_ROASTER_ID = '00000000-0000-0000-0000-000000000001';

function adminClient() {
  return createClient(supabaseUrl, serviceRoleKey);
}

type TelegramPhotoSize = { file_id: string; width: number; height: number };
type TelegramMessage = {
  message_id: number;
  chat: { id: number; type: 'private' | 'group' | 'supergroup' | 'channel' };
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
  reply_to_message?: TelegramMessage;
};

async function sendReply(chatId: number, replyToMessageId: number | undefined, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, reply_to_message_id: replyToMessageId, text }),
  }).catch(() => {});
}

function extractXbloomLink(text: string): string | null {
  const match = text.match(/https?:\/\/\S*xbloom\S*/i);
  return match ? match[0] : null;
}

function parseBeanInfo(text: string): { name: string; origin: string | null } {
  const stripped = text.replace(/^\/submit(@\w+)?/i, '').trim();
  const [namePart, ...rest] = stripped.split('-');
  const name = namePart.trim() || 'بانتظار التسمية';
  const origin = rest.join('-').trim() || null;
  return { name, origin };
}

type BeanVisionResult = {
  name: string | null;
  origin: string | null;
  process: string | null;
  flavorNotes: string[];
};

/** يقرا اسم المحصول ونكهاته ومنشأه من كتابة كيس القهوة الفعلية بالصورة — يرجّع حقول فاضية لو ما فيه كتابة واضحة بالصورة */
async function analyzeBeanPhoto(photoBuffer: Buffer): Promise<BeanVisionResult | null> {
  if (!anthropicApiKey) return null;

  const base64 = photoBuffer.toString('base64');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
            {
              type: 'text',
              text:
                'هذي صورة كيس قهوة مختص. اقرا الكتابة المطبوعة على الكيس فقط (لا تخمّن) وطلّع لي JSON بالضبط بهذا الشكل، بدون أي نص إضافي قبله أو بعده:\n' +
                '{"name": string|null, "origin": string|null, "process": string|null, "flavorNotes": string[]}\n' +
                'name = اسم المحصول/التحميصة كما مكتوب بالضبط. origin = بلد/منطقة المنشأ لو مكتوبة. process = طريقة المعالجة (مغسولة/طبيعية/عسلية...) لو مكتوبة. flavorNotes = قائمة نكهات القهوة المكتوبة (مثل: توت، شوكولاتة، حمضيات). لو ما فيه كتابة واضحة تقدر تقرأها بثقة لأي حقل، رجّعه null أو مصفوفة فاضية — لا تخترع معلومات.',
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (!text) return null;

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      name: parsed.name || null,
      origin: parsed.origin || null,
      process: parsed.process || null,
      flavorNotes: Array.isArray(parsed.flavorNotes) ? parsed.flavorNotes : [],
    };
  } catch {
    return null;
  }
}

async function downloadTelegramPhoto(fileId: string): Promise<Buffer | null> {
  const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
  const fileData = await fileRes.json();
  const filePath = fileData?.result?.file_path;
  if (!filePath) return null;

  const photoRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
  if (!photoRes.ok) return null;
  const arrayBuffer = await photoRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/** ينزّل الصورة، يحلّلها بالذكاء الاصطناعي، يرفعها، ويضيف محصول pending. يرجّع معرف المحصول أو null لو صار خطأ */
async function createBeanFromPhoto(
  photo: TelegramPhotoSize,
  typedText: string,
  xbloomLink: string | null
): Promise<{ beanId: string; name: string } | null> {
  const photoBuffer = await downloadTelegramPhoto(photo.file_id);
  if (!photoBuffer) return null;

  const vision = await analyzeBeanPhoto(photoBuffer);
  const typed = parseBeanInfo(typedText);
  const name = vision?.name || typed.name;
  const origin = vision?.origin || typed.origin;
  const process = vision?.process ?? null;
  const flavorNotes = vision?.flavorNotes ?? [];

  const admin = adminClient();
  const path = `telegram/${Date.now()}-${photo.file_id}.jpg`;
  const { error: uploadError } = await admin.storage.from('bean-photos').upload(path, photoBuffer, {
    contentType: 'image/jpeg',
  });
  if (uploadError) return null;
  const { data: publicUrlData } = admin.storage.from('bean-photos').getPublicUrl(path);

  const { data: bean, error: beanError } = await admin
    .from('beans')
    .insert({
      roaster_id: COMMUNITY_ROASTER_ID,
      name,
      origin,
      process,
      flavor_notes: flavorNotes,
      image_url: publicUrlData.publicUrl,
      status: 'pending',
    })
    .select('id')
    .single();
  if (beanError || !bean) return null;

  if (xbloomLink) {
    await admin.from('recipes').insert({
      bean_id: bean.id,
      user_id: submitterUserId,
      method: 'xbloom_hot',
      xbloom_link: xbloomLink,
      status: 'pending',
      submitter_name: 'mohammed',
    });
  }

  return { beanId: bean.id, name };
}

async function handleGroupSubmit(message: TelegramMessage) {
  const chatId = message.chat.id;
  const replyTarget = message.message_id;
  const rawText = message.text ?? message.caption ?? '';

  const photoSource = message.reply_to_message?.photo ?? message.photo;
  if (!photoSource || photoSource.length === 0) {
    await sendReply(chatId, replyTarget, 'رد على صورة كيس المحصول بأمر /submit عشان يضاف — ما لقيت صورة.');
    return;
  }

  const combinedText = [rawText, message.reply_to_message?.text, message.reply_to_message?.caption]
    .filter(Boolean)
    .join(' ');
  const xbloomLink = extractXbloomLink(combinedText);
  const largestPhoto = photoSource[photoSource.length - 1];

  const result = await createBeanFromPhoto(largestPhoto, rawText, xbloomLink);
  if (!result) {
    await sendReply(chatId, replyTarget, 'صار خطأ بإضافة المحصول، جرّب مرة ثانية.');
    return;
  }

  await sendReply(
    chatId,
    replyTarget,
    `تم استلام "${result.name}" ✓ بانتظار مراجعة الأدمن${xbloomLink ? ' (مع وصفة xBloom)' : ''}.`
  );
}

/** محادثة خاصة مع البوت: أي صورة تُعتبر تسليم محصول فوراً (بدون /submit)، وأي رابط xBloom
 * يوصل برسالة منفصلة بعدها يرتبط بآخر محصول أرسلته نفس المحادثة (telegram_pending_beans). */
async function handlePrivateMessage(message: TelegramMessage) {
  const chatId = message.chat.id;
  const replyTarget = message.message_id;
  const rawText = message.text ?? message.caption ?? '';
  const admin = adminClient();

  if (message.photo && message.photo.length > 0) {
    const xbloomLink = extractXbloomLink(rawText);
    const largestPhoto = message.photo[message.photo.length - 1];
    const result = await createBeanFromPhoto(largestPhoto, rawText, xbloomLink);
    if (!result) {
      await sendReply(chatId, replyTarget, 'صار خطأ بإضافة المحصول، جرّب مرة ثانية.');
      return;
    }

    await admin.from('telegram_pending_beans').upsert({ chat_id: chatId, bean_id: result.beanId });

    await sendReply(
      chatId,
      replyTarget,
      xbloomLink
        ? `تم استلام "${result.name}" ✓ بانتظار مراجعة الأدمن (مع وصفة xBloom).`
        : `تم استلام "${result.name}" ✓ بانتظار مراجعة الأدمن. لو عندك رابط xBloom لها ابعثه الحين وبربطه فيها.`
    );
    return;
  }

  const xbloomLink = extractXbloomLink(rawText);
  if (xbloomLink) {
    const { data: pending } = await admin
      .from('telegram_pending_beans')
      .select('bean_id')
      .eq('chat_id', chatId)
      .maybeSingle();

    if (!pending) {
      await sendReply(chatId, replyTarget, 'ابعث صورة كيس المحصول أول عشان أربط لها الرابط.');
      return;
    }

    await admin.from('recipes').insert({
      bean_id: pending.bean_id,
      user_id: submitterUserId,
      method: 'xbloom_hot',
      xbloom_link: xbloomLink,
      status: 'pending',
      submitter_name: 'mohammed',
    });
    await admin.from('telegram_pending_beans').delete().eq('chat_id', chatId);

    await sendReply(chatId, replyTarget, 'تم ربط وصفة xBloom بالمحصول ✓ بانتظار مراجعة الأدمن.');
    return;
  }

  await sendReply(chatId, replyTarget, 'ابعث صورة كيس المحصول (ورابط xBloom لو عندك) وبضيفه بانتظار المراجعة.');
}

export async function POST(request: Request) {
  const secretHeader = request.headers.get('x-telegram-bot-api-secret-token');
  if (webhookSecret && secretHeader !== webhookSecret) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const update = await request.json();
  const message: TelegramMessage | undefined = update.message;
  if (!message) return Response.json({ ok: true });

  if (message.chat.type === 'private') {
    await handlePrivateMessage(message);
    return Response.json({ ok: true });
  }

  const rawText = message.text ?? message.caption ?? '';
  if (/^\/submit(@\w+)?/i.test(rawText.trim())) {
    await handleGroupSubmit(message);
  }

  return Response.json({ ok: true });
}
