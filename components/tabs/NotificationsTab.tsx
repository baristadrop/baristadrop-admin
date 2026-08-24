'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { FilterBar } from '@/components/ui/FilterBar';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';

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
  { value: 'premium', label: 'مشتركي بريميوم' },
  { value: 'roaster', label: 'المحامص' },
  { value: 'supplier', label: 'الموردين' },
  { value: 'cafe', label: 'الكوفي شوب' },
];

const AUDIENCE_LABEL: Record<string, string> = Object.fromEntries(
  AUDIENCE_OPTIONS.map((o) => [o.value, o.label])
);

export function NotificationsTab() {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [sending, setSending] = useState(false);
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
      toast({ title: 'صار خطأ', description: json.error ?? 'جرّب مرة ثانية', variant: 'destructive' });
      return;
    }
    toast({ title: `تم الإرسال لـ${json.sentCount} مستخدم`, variant: 'success' });
    setTitle('');
    setBody('');
    loadHistory();
  };

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <p className="mb-1 font-[var(--font-el-messiri)] text-base text-ink">إشعار جديد</p>
        <p className="mb-4 text-xs text-mocha">
          يُرسل فورًا لكل مستخدم فعّل الإشعارات ضمن الجمهور المختار. لا يوجد إرسال تلقائي أو مجدول — القرار
          والتوقيت بيدك دائمًا.
        </p>

        <div className="space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان الإشعار" maxLength={60} />
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="نص الإشعار" rows={3} maxLength={180} />
          <FilterBar options={AUDIENCE_OPTIONS} value={audience} onChange={setAudience} />
          <Button onClick={handleSend} disabled={!canSend}>
            {sending ? 'جاري الإرسال...' : 'إرسال الإشعار'}
          </Button>
        </div>
      </Card>

      <div className="overflow-hidden rounded-2xl border border-latte bg-white shadow-sm">
        <p className="border-b border-latte p-4 font-[var(--font-el-messiri)] text-base text-ink">
          آخر الإشعارات المرسلة
        </p>
        {!history ? (
          <p className="p-4 text-sm text-mocha">تحميل...</p>
        ) : history.length === 0 ? (
          <EmptyState title="ما فيه إشعارات مرسلة بعد" />
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
