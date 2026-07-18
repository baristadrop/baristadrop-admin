'use client';

import { useEffect } from 'react';
import { useAdminAuth } from '@/lib/useAdminAuth';
import { LoginForm } from '@/components/LoginForm';
import { Dashboard } from '@/components/Dashboard';
import { RoasterPortal } from '@/components/RoasterPortal';
import { SupplierPortal } from '@/components/SupplierPortal';
import { CafePortal } from '@/components/CafePortal';

const ADMIN_HOST = 'admin.baristadrop.com';
const PARTNER_HOST = 'partner.baristadrop.com';

export default function Home() {
  const { session, profile, loading, signOut } = useAdminAuth();

  useEffect(() => {
    if (!profile) return;
    const host = window.location.hostname;
    if (profile.role === 'admin' && host === PARTNER_HOST) {
      window.location.replace(`https://${ADMIN_HOST}${window.location.pathname}`);
    } else if (profile.role !== 'admin' && host === ADMIN_HOST) {
      window.location.replace(`https://${PARTNER_HOST}${window.location.pathname}`);
    }
  }, [profile]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-mocha">
        تحميل...
      </div>
    );
  }

  if (!session) {
    return <LoginForm />;
  }

  if (profile?.role === 'admin') return <Dashboard />;
  if (profile?.role === 'roaster') return <RoasterPortal />;
  if (profile?.role === 'supplier') return <SupplierPortal />;
  if (profile?.role === 'cafe') return <CafePortal />;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-lg text-ink">هذا الحساب ما عنده صلاحية وصول للوحة التحكم.</p>
      <button
        onClick={() => signOut()}
        className="rounded-full border border-latte px-4 py-2 text-sm text-coffee"
      >
        تسجيل خروج
      </button>
    </div>
  );
}
