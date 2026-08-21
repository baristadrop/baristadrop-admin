import { createClient, type User } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

// كان نفس الدالة بالضبط مكررة بـ6 ملفات (credentials/reconciliation/
// imports/send-notification/users/posthog-stats) -- مكان واحد الحين.
// يتحقق من الجلسة عبر anon key + توكن المستخدم (مو service role -- نبي
// نتأكد التوكن نفسه صالح، مو نتخطى التحقق)، ثم يتحقق إن دوره 'admin' من
// جدول profiles.
export async function requireAdmin(request: Request): Promise<User | null> {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return null;

  const asCaller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData } = await asCaller.auth.getUser(token);
  if (!userData.user) return null;

  const { data: profile } = await asCaller.from('profiles').select('role').eq('id', userData.user.id).single();
  if (profile?.role !== 'admin') return null;

  return userData.user;
}
