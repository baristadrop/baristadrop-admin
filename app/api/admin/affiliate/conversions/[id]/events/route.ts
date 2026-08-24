import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getAdminClient } from '@/lib/supabaseAdmin';

// GET /api/admin/affiliate/conversions/[id]/events -- السجل الجنائي (forensic
// audit trail) لتحويلة واحدة: (1) affiliate_conversion_events مربوطة مباشرة
// بـ conversion_id (رابط حقيقي 1:N)، بجانب (2) affiliate_postback_events ذات
// الصلة -- لا يوجد FK مباشر بينهما بالمخطط، فنطابقها بأفضل جهد عبر نفس
// البرنامج + (transaction_id أو click_id مطابق) لأن هذا أدق ربط متاح فعلياً.
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const supabase = getAdminClient();

  const { data: conversion, error: convError } = await supabase
    .from('affiliate_conversions')
    .select('id, affiliate_program_id, click_id, provider_transaction_id')
    .eq('id', id)
    .single();
  if (convError || !conversion) return NextResponse.json({ error: 'conversion not found' }, { status: 404 });

  const { data: conversionEvents } = await supabase
    .from('affiliate_conversion_events')
    .select('id, event_type, status_before, status_after, amount, commission, currency, raw_payload, received_at')
    .eq('conversion_id', id)
    .order('received_at', { ascending: true });

  let postbackQuery = supabase
    .from('affiliate_postback_events')
    .select('id, provider_code, transaction_id, click_id, status, rejection_reason, received_at, processed_at')
    .eq('affiliate_program_id', conversion.affiliate_program_id)
    .order('received_at', { ascending: true });

  const orFilters: string[] = [];
  if (conversion.provider_transaction_id) orFilters.push(`transaction_id.eq.${conversion.provider_transaction_id}`);
  if (conversion.click_id) orFilters.push(`click_id.eq.${conversion.click_id}`);

  const postbackEvents = orFilters.length > 0 ? (await postbackQuery.or(orFilters.join(','))).data : [];

  return NextResponse.json({ conversionEvents: conversionEvents ?? [], postbackEvents: postbackEvents ?? [] });
}
