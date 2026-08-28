import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ملاحظة: لا تضِف stripe إلى serverExternalPackages -- على Netlify هذا
  // يفرض عمل symlink لـ node_modules/stripe داخل حزمة الـfunction، وهو
  // يفشل على ويندوز (EPERM) فتنشر الـfunction بدون stripe وترجع كل
  // راوتات Stripe خطأ 500. تركه ليُباندل داخل الـfunction مباشرة أأمن.
};

export default nextConfig;
