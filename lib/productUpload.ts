import { supabase } from './supabase';

/** يرفع صورة منتج لباكت product-images بمسار {ownerId}/... — يطابق سياسات RLS
 * اللي تتأكد إن صاحب الحساب هو owner_id لنفس المورد/الكوفي شوب (راجع migration 0036). */
export async function uploadOwnerProductImage(ownerId: string, file: File): Promise<string | null> {
  const ext = file.name.split('.').pop();
  const path = `${ownerId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('product-images').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) {
    alert('فشل رفع الصورة: ' + error.message);
    return null;
  }
  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  return data.publicUrl;
}
