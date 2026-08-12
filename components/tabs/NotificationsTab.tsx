'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type HistoryRow = {
  id: string;
  title: string;
  body: string;
  audience: string;
  sent_count: number;
  created_at: string;
};

const AUDIENCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'user', label: 'مستخدمين عاديين' },
  { value: 'roaster', label: 'المحامص' },
  { value: 'supplier', label: 'الموردين' },
  { value: 'cafe', label: 'الكوفي شوب' },
];

const AUDIENCE_LABEL: Record<string, string> = Object.fromEntries(
  AUDIENCE_OPTIONS.map((o) => [o.value, o.label])
);

export function NotificationsTab() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);

  const loadHistory = async () => {
    const sessionRes = await supabase.auth.getSession();
    const token = sessionRes.data.session?.access_token;
    const res = await fetch('/api/admin/send-notification', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const json = await res.json();
      setHistory(json.history);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const canSend = title.trim().length > 0 && body.trim().length > 0 && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setMessage(null);
    const sessionRes = await supabase.auth.getSession();
    const token = sessionRes.data.session?.access_token;
    const res = await fetch('/api/admin/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: title.trim(), body: body.trim(), audience }),
    });
    const json = await res.json();
    setSending(false);
    if (!res.ok) {
      setMessage(json.error ?? 'صار خطأ، جرّب مرة ثانية');
      return;
    }
    setMessage(`تم الإرسال لـ${json.sentCount} مستخدم ✓`);
    setTitle('');
    setBody('');
    loadHistory();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-latte bg-white p-5 shadow-sm">
        <p className="mb-1 font-[var(--font-el-messiri)] text-base text-ink">إشعار جديد</p>
        <p className="mb-4 text-xs text-mocha">
          يُرسل فورًا لكل مستخدم فعّل الإشعارات ضمن الجمهور المختار. لا يوجد إرسال تلقائي أو مجدول — القرار
          والتوقيت بيدك دائمًا.
        </p>

        {message && <p className="mb-3 rounded-lg bg-sand px-3 py-2 text-sm text-coffee">{message}</p>}

        <div className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="عنوان الإشعار"
            maxLength={60}
            className="w-full rounded-lg border border-latte bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="نص الإشعار"
            rows={3}
            maxLength={180}
            className="w-full rounded-lg border border-latte bg-paper px-3 py-2 text-sm outline-none focus:border-gold"
          />
          <div className="flex flex-wrap items-center gap-2">
            {AUDIENCE_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setAudience(o.value)}
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  audience === o.value ? 'border-gold bg-gold text-white' : 'border-latte text-coffee'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-cream disabled:opacity-50"
          >
            {sending ? 'جاري الإرسال...' : 'إرسال الإشعار'}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-latte bg-white shadow-sm">
        <p className="border-b border-latte p-4 font-[var(--font-el-messiri)] text-base text-ink">
          آخر الإشعارات المرسلة
        </p>
        {!history ? (
          <p className="p-4 text-sm text-mocha">تحميل...</p>
        ) : history.length === 0 ? (
          <p className="p-4 text-sm text-mocha">ما فيه إشعارات مرسلة بعد.</p>
        ) : (
          history.map((h) => (
            <div key={h.id} className="border-b border-latte/60 p-4 last:border-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-ink">{h.title}</p>
                <span className="text-xs text-stone">{new Date(h.created_at).toLocaleString('ar')}</span>
              </div>
              <p className="mt-1 text-xs text-mocha">{h.body}</p>
              <p className="mt-1.5 text-xs text-gold">
                {AUDIENCE_LABEL[h.audience] ?? h.audience} · {h.sent_count} مستلم
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
