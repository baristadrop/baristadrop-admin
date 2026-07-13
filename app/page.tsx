'use client';

import { useAdminAuth } from '@/lib/useAdminAuth';
import { LoginForm } from '@/components/LoginForm';
import { Dashboard } from '@/components/Dashboard';

export default function Home() {
  const { session, loading, isAdmin, signOut } = useAdminAuth();

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

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-lg text-ink">هذا الحساب ما عنده صلاحية أدمن.</p>
        <button
          onClick={() => signOut()}
          className="rounded-full border border-latte px-4 py-2 text-sm text-coffee"
        >
          تسجيل خروج
        </button>
      </div>
    );
  }

  return <Dashboard />;
}
