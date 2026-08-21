import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// عميل service-role واحد مشترك -- بدل ما كل راوت يسوي createClient() لحاله
// (كان متكرر بأكثر من 10 ملفات). سيرفر فقط -- المفتاح يتخطى كل RLS، ما
// يصح يستورد هذا الملف أي مكوّن 'use client'.
let _adminClient: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (_adminClient) return _adminClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

  _adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return _adminClient;
}
