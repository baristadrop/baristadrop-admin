'use client';

import { useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';

const ENTRIES = [
  {
    problem: 'Postback يرجع 401',
    cause: 'مفتاح webhook_secret غلط أو ناقص عند المزوّد',
    solution: 'راجع بيانات الاعتماد المحفوظة بتبويب "البرامج" -> ربط أدابتر المزوّد -> تأكد من webhook_secret.',
  },
  {
    problem: 'التحويلات ما تظهر',
    cause: 'رابط postback غلط عند المزوّد، أو طابور المهام متوقف',
    solution: 'تحقق من تبويب "التحقق من Webhooks" بتبويب التحويلات، وشوف تبويب "الوظائف" للتأكد إن المهام تشتغل.',
  },
  {
    problem: 'العمولة = 0',
    cause: 'commission_model مو مطابق لاتفاقية البرنامج الفعلية',
    solution: 'راجع نموذج العمولة (commission_model) بتبويب "البرامج" وعدّله للنموذج الصحيح.',
  },
  {
    problem: 'كثرة UNMATCHED',
    cause: 'الكليكات انتهت صلاحيتها قبل ما توصل التحويلة (نافذة الإحالة)',
    solution: 'اربط يدوياً من تبويب "التحويلات" إذا عندك click_id صحيح، أو تحقّق من مدة صلاحية الكليك.',
  },
  {
    problem: 'اختلاف بالعملة بدفتر الأستاذ',
    cause: 'exchange_rate ناقص على دفعة أو تحويلة بعملة مختلفة عن البرنامج',
    solution: 'أدخل exchange_rate و base_amount عند إنشاء الدفعة (تبويب "المدفوعات").',
  },
  {
    problem: 'خطأ AUTHENTICATION_ERROR من API المزوّد',
    cause: 'مفتاح API منتهي أو أُلغي عند المزوّد',
    solution: 'جدّد بيانات الاعتماد بتبويب "البرامج" -> ربط أدابتر المزوّد.',
  },
  {
    problem: 'تحويلات مكررة',
    cause: 'طبيعي عادةً -- نظام idempotency يمنع تكرارها فعلياً بقاعدة البيانات',
    solution: 'لا شي مطلوب -- إذا لاحظت تكرار ظاهر بالواجهة تأكد إنه نفس provider_conversion_id فعلاً قبل ما تفتح تذكرة.',
  },
];

export function HelpPanel() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(0);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="border-mocha/40 bg-transparent text-sand hover:border-gold hover:bg-white/5"
        onClick={() => setOpen(true)}
      >
        مساعدة
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="مساعدة -- الأخطاء الشائعة بالأفيليت" className="max-h-[80vh] overflow-y-auto">
        <div className="space-y-2">
          {ENTRIES.map((entry, i) => (
            <div key={i} className="rounded-xl border border-latte">
              <button
                onClick={() => setExpanded(expanded === i ? null : i)}
                className="flex w-full items-center justify-between px-3 py-2 text-start text-sm font-medium text-ink"
              >
                {entry.problem}
                <span className={`text-mocha transition-transform ${expanded === i ? 'rotate-180' : ''}`}>▾</span>
              </button>
              {expanded === i && (
                <div className="space-y-1.5 border-t border-latte px-3 py-2 text-xs">
                  <p>
                    <span className="font-semibold text-stone">السبب: </span>
                    <span className="text-mocha">{entry.cause}</span>
                  </p>
                  <p>
                    <span className="font-semibold text-stone">الحل: </span>
                    <span className="text-coffee">{entry.solution}</span>
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </Dialog>
    </>
  );
}
