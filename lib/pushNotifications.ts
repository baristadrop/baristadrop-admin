// أداة إرسال إشعارات Expo push مشتركة -- نفس منطق الإرسال الدفعي الموجود
// بـsend-notification/route.ts (حد 100 رسالة بكل نداء)، مستخرَج هنا عشان
// يستخدمها أكثر من راوت بدون تكرار (إشعار رفض إعلان لمستخدم واحد، وإشعار
// تسويقي دوري لشريحة).
type ExpoPushMessage = { to: string; title: string; body: string; sound?: 'default' };

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function sendExpoPush(messages: ExpoPushMessage[]): Promise<void> {
  const batches = chunk(messages, 100);
  for (const batch of batches) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(batch.map((m) => ({ ...m, sound: m.sound ?? 'default' }))),
    }).catch(() => null);
  }
}
