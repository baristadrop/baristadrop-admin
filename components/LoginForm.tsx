'use client';

import { useState } from 'react';
import { useAdminAuth } from '@/lib/useAdminAuth';

export function LoginForm() {
  const { signIn } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await signIn(email.trim(), password);
    if (error) setError(error);
    setSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-3xl border border-latte bg-white p-8 shadow-sm"
      >
        <h1 className="mb-1 text-center font-[var(--font-el-messiri)] text-2xl text-ink">
          لوحة تحكم Barista Drop
        </h1>
        <p className="mb-6 text-center text-sm text-mocha">دخول الأدمن فقط</p>

        {error && (
          <p className="mb-4 rounded-lg bg-sand px-3 py-2 text-center text-sm text-[#B3392C]">
            {error}
          </p>
        )}

        <label className="mb-1 block text-sm font-semibold text-ink">الإيميل</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-xl border border-latte bg-paper px-4 py-2.5 text-sm text-ink outline-none focus:border-gold"
          dir="ltr"
        />

        <label className="mb-1 block text-sm font-semibold text-ink">كلمة المرور</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-6 w-full rounded-xl border border-latte bg-paper px-4 py-2.5 text-sm text-ink outline-none focus:border-gold"
          dir="ltr"
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-ink py-3 text-sm font-bold text-cream disabled:opacity-50"
        >
          {submitting ? '...' : 'دخول'}
        </button>
      </form>
    </div>
  );
}
