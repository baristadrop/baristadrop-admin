import { supabase } from './supabase';

/** يرفع شعار عمل (محمصة/كوفي شوب/مورد) لباكت business-logos ويحدّث logo_url
 * على نفس صف الجدول. المسار {rowId}/logo.ext يطابق سياسات RLS اللي تتأكد
 * إن صاحب الحساب هو owner_id لهذا الصف. الكوفي شوب يستخدم جدول roasters
 * الحين بعد الدمج (business_type='cafe')، ما فيه جدول cafes منفصل. */
export async function uploadBusinessLogo(
  table: 'roasters' | 'suppliers',
  rowId: string,
  file: File
): Promise<string | null> {
  const ext = file.name.split('.').pop();
  const path = `${rowId}/logo.${ext}`;
  const { error: uploadError } = await supabase.storage.from('business-logos').upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });
  if (uploadError) {
    alert('فشل رفع الشعار: ' + uploadError.message);
    return null;
  }
  const { data } = supabase.storage.from('business-logos').getPublicUrl(path);
  const logoUrl = `${data.publicUrl}?t=${Date.now()}`;
  const { error: updateError } = await supabase.from(table).update({ logo_url: logoUrl }).eq('id', rowId);
  if (updateError) {
    alert('فشل حفظ الشعار: ' + updateError.message);
    return null;
  }
  return logoUrl;
}
