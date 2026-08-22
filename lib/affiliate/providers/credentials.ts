import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProviderCredentials } from './types';

// مفتاح AES-256 (32 بايت hex = 64 حرف) -- منفصل تماماً عن أي مفتاح Supabase/Anthropic
// موجود، عشان تسريب مفتاح واحد ما يكشف الثاني. لازم يُضاف كـ
// AFFILIATE_CREDENTIAL_KEY في متغيرات بيئة Netlify قبل تخزين أي بيانات
// اعتماد مزوّد حقيقية (Awin/CJ API keys) -- لسه ما فيه أي بيانات حقيقية
// مخزّنة بهذا المشروع، فما فيه استعجال، بس لازم يُضاف قبل ربط أول مزوّد فعلي.
function getEncryptionKey(): Buffer {
  const key = process.env.AFFILIATE_CREDENTIAL_KEY;
  if (!key || key.length !== 64) {
    throw new Error('AFFILIATE_CREDENTIAL_KEY must be set to a 64-char hex string (32 bytes) before storing/reading provider credentials');
  }
  return Buffer.from(key, 'hex');
}

export function encryptCredential(value: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted}`;
}

export function decryptCredential(encrypted: string): string {
  const [ivHex, tagHex, data] = encrypted.split(':');
  if (!ivHex || !tagHex || !data) throw new Error('malformed encrypted credential');
  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// يجيب كل بيانات اعتماد التكامل ويفك تشفيرها لخريطة مسطّحة (credential_type -> value)
// عشان الأدابتر يقرأها مباشرة (credentials.api_key، credentials.postback_secret، ...).
export async function loadProviderCredentials(supabase: SupabaseClient, integrationId: string): Promise<ProviderCredentials> {
  // Fix 12: expires_at كان يُتجاهل تماماً -- توكن Awin/CJ منتهي كان يفضل
  // يُستخدم لأنه status='active' لسه بغض النظر عن انتهاء صلاحيته الزمنية.
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('affiliate_provider_credentials')
    .select('credential_type, encrypted_value, status')
    .eq('integration_id', integrationId)
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gte.${nowIso}`);

  if (error || !data) return {};

  const credentials: ProviderCredentials = {};
  for (const row of data) {
    try {
      credentials[row.credential_type] = decryptCredential(row.encrypted_value as string);
    } catch {
      // بيانات اعتماد تالفة/بمفتاح تشفير قديم -- تُتجاهَل بدل ما توقف كل شي
      continue;
    }
  }
  return credentials;
}

export async function storeProviderCredential(
  supabase: SupabaseClient,
  params: { integrationId: string; credentialType: string; value: string; expiresAt?: string | null }
): Promise<void> {
  const { error } = await supabase.from('affiliate_provider_credentials').insert({
    integration_id: params.integrationId,
    credential_type: params.credentialType,
    encrypted_value: encryptCredential(params.value),
    expires_at: params.expiresAt ?? null,
  });
  if (error) throw new Error(`failed to store provider credential: ${error.message}`);
}
