/**
 * ينشئ 3 حسابات بارتنر تجريبية (محمصة / كوفي شوب / مورد) للدخول على
 * partner.baristadrop.com. يقرأ SUPABASE_SERVICE_ROLE_KEY من admin/.env.local
 * -- المفتاح ما يطلع بأي مكان، السكربت يشتغل محلياً بس.
 *
 * التشغيل من داخل مجلد admin:
 *   node scripts/create-test-partners.mjs
 *
 * إعادة التشغيل آمنة: لو الإيميل موجود، يتخطاه ويطبع بياناته.
 *
 * كل حساب: createUser مع user_metadata كامل -> تريقر handle_new_user
 * (migration 0052) يسوي صف profiles + صف roasters/suppliers بحالة pending.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- تحميل .env.local يدوياً (بدون dependency) ---
function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = loadEnv(join(__dirname, '..', '.env.local'));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('✗ ناقص NEXT_PUBLIC_SUPABASE_URL أو SUPABASE_SERVICE_ROLE_KEY في admin/.env.local');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const PASSWORD = process.env.TEST_PW || 'BaristaTest2026!';

const PARTNERS = [
  {
    email: 'test-roaster@baristadrop.test',
    role: 'roaster',
    metadata: {
      signup_role: 'roaster',
      full_name: 'تست محمصة',
      business_name: 'محمصة تجريبية',
      trade_license_number: 'TEST-R-001',
      phone: '+971 500000001',
      country: 'AE',
    },
  },
  {
    email: 'test-cafe@baristadrop.test',
    role: 'cafe',
    metadata: {
      signup_role: 'cafe',
      full_name: 'تست كوفي شوب',
      business_name: 'كوفي شوب تجريبي',
      trade_license_number: 'TEST-C-001',
      phone: '+971 500000002',
      country: 'AE',
    },
  },
  {
    email: 'test-supplier@baristadrop.test',
    role: 'supplier',
    metadata: {
      signup_role: 'supplier',
      full_name: 'تست مورد',
      business_name: 'مورد تجريبي',
      trade_license_number: 'TEST-S-001',
      phone: '+971 500000003',
      country: 'AE',
    },
  },
];

const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
const byEmail = new Map((existing?.users ?? []).map((u) => [u.email, u]));

for (const p of PARTNERS) {
  const found = byEmail.get(p.email);
  if (found) {
    console.log(`• موجود مسبقاً: ${p.email}  (id ${found.id})`);
    continue;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: p.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: p.metadata,
  });
  if (error) {
    console.error(`✗ فشل ${p.email}: ${error.message}`);
    continue;
  }
  // احتياط: لو التريقر ما ضبط الدور لأي سبب
  await admin.from('profiles').update({ role: p.role }).eq('id', data.user.id);
  console.log(`✓ أُنشئ: ${p.email}  (id ${data.user.id})`);
}

console.log('\n── بيانات الدخول (partner.baristadrop.com) ──');
for (const p of PARTNERS) console.log(`  ${p.role.padEnd(9)} ${p.email}   /   ${PASSWORD}`);
console.log('\nالشركات تُنشأ بحالة pending — وافق عليها من لوحة الأدمن (الشركات / الموردين).');
