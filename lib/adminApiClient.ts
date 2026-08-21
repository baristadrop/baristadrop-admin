import { supabase } from '@/lib/supabase';

// أداة موحّدة لكل نداءات fetch() من تبويبات الأدمن للراوتات الجديدة --
// تجيب توكن الجلسة الحالية وتضيفه كـ Authorization header تلقائياً، بدل
// ما يتكرر نفس الكود بكل تبويب.
export async function adminFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { data: sessionData } = await supabase.auth.getSession();
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${sessionData.session?.access_token}`);
  return fetch(url, { ...options, headers });
}

export async function adminFetchJson(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  return adminFetch(url, { ...options, headers });
}
