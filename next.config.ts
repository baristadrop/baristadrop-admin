import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // stripe SDK يُستخدم فقط داخل app/api/* (server-side) -- استبعاده من
  // التجميع يخفف شغل Turbopack بدل ما يحاول يباندله للعميل.
  serverExternalPackages: ["stripe"],
};

export default nextConfig;
