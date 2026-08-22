import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

// يتحقق من الجلسة عبر anon key + توكن المستخدم (مو service role -- نبي
// نتأكد التوكن نفسه صالح، مو نتخطى التحقق). يرجّع نفس العميل المُصادَق
// مع المستخدم عشان requireAdmin يعيد استخدامه لفحص الدور بدون عميل ثاني.
// مشتركة بين requireAdmin وrequireUser (السوق يحتاج أي بائع مسجّل دخول، مو أدمن بس).
async function verifyCaller(request: Request): Promise<{ user: User; client: SupabaseClient } | null> {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return null;

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData } = await client.auth.getUser(token);
  if (!userData.user) return null;

  return { user: userData.user, client };
}

// كان نفس الدالة بالضبط مكررة بـ6 ملفات (credentials/reconciliation/
// imports/send-notification/users/posthog-stats) -- مكان واحد الحين.
export async function requireAdmin(request: Request): Promise<User | null> {
  const caller = await verifyCaller(request);
  if (!caller) return null;

  const { data: profile } = await caller.client.from('profiles').select('role').eq('id', caller.user.id).single();
  if (profile?.role !== 'admin') return null;

  return caller.user;
}

// أي مستخدم مسجّل دخول (مو أدمن بس) -- يخدم راوتات السوق اللي أي بائع
// يقدر يستدعيها (إنشاء جلسة دفع لإعلانه هو).
export async function requireUser(request: Request): Promise<User | null> {
  const caller = await verifyCaller(request);
  return caller?.user ?? null;
}
