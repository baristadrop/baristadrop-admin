import { describe, it, expect, beforeAll } from 'vitest';

// AFFILIATE_CREDENTIAL_KEY يُقرأ من process.env وقت الاستدعاء (مو وقت
// تحميل الموديول) -- تعيينه هنا قبل أي اختبار كافٍ، بدون احتياج لـ mock.
beforeAll(() => {
  process.env.AFFILIATE_CREDENTIAL_KEY = 'a'.repeat(64); // 32 بايت hex وهمي لغرض الاختبار فقط
});

describe('encryptCredential / decryptCredential', () => {
  it('round-trips a value correctly', async () => {
    const { encryptCredential, decryptCredential } = await import('./credentials');
    const encrypted = encryptCredential('super-secret-awin-api-key');
    expect(encrypted).not.toContain('super-secret-awin-api-key'); // ما يخزّن القيمة الخام بأي شكل
    expect(decryptCredential(encrypted)).toBe('super-secret-awin-api-key');
  });

  it('produces a different ciphertext each time (random IV) even for the same input', async () => {
    const { encryptCredential } = await import('./credentials');
    const a = encryptCredential('same-value');
    const b = encryptCredential('same-value');
    expect(a).not.toBe(b);
  });

  it('fails to decrypt with the wrong key (simulated key rotation)', async () => {
    const { encryptCredential, decryptCredential } = await import('./credentials');
    const encrypted = encryptCredential('rotate-me');

    process.env.AFFILIATE_CREDENTIAL_KEY = 'b'.repeat(64); // مفتاح مختلف
    expect(() => decryptCredential(encrypted)).toThrow();
    process.env.AFFILIATE_CREDENTIAL_KEY = 'a'.repeat(64); // يرجّعه عشان باقي الاختبارات
  });

  it('throws clearly when AFFILIATE_CREDENTIAL_KEY is missing entirely', async () => {
    const { encryptCredential } = await import('./credentials');
    const original = process.env.AFFILIATE_CREDENTIAL_KEY;
    delete process.env.AFFILIATE_CREDENTIAL_KEY;
    expect(() => encryptCredential('x')).toThrow(/AFFILIATE_CREDENTIAL_KEY/);
    process.env.AFFILIATE_CREDENTIAL_KEY = original;
  });
});
