'use client';

/** مفتاح تبديل بصري واضح (زي Stripe/Shopify) بدل checkbox خام — يوضح
 * الحالة (تشغيل/إيقاف) من أول نظرة أكثر من مربع صغير. */
export function Toggle({
  checked,
  onChange,
  label,
  helper,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  helper?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 py-1.5">
      <div>
        <p className="text-sm text-ink">{label}</p>
        {helper && <p className="text-xs text-mocha">{helper}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-gold' : 'bg-latte'}`}
      >
        {/* dir="rtl" على الصفحة: نقطة البداية يمين، التفعيل يحرّك النقطة يسار (اتجاه القراءة) */}
        <span
          className={`absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? '-translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  );
}
