'use client';

import { useState } from 'react';

/** علامة "؟" صغيرة -- ضغطة تفتح شرح مختصر، ضغطة ثانية تقفله. تُستخدم بس
 * على العناصر التقنية اللي تحتاج توضيح، مو كل حقل (الأرقام البسيطة توضيحها
 * بالتسمية نفسها بدون حاجة لطبقة شرح إضافية). */
export function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block align-middle">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-stone/60 text-[10px] font-bold text-stone hover:border-gold hover:text-gold"
        aria-label="توضيح"
      >
        ؟
      </button>
      {open && (
        <span className="absolute right-0 top-5 z-20 w-56 rounded-lg border border-latte bg-white p-2.5 text-[11px] leading-relaxed text-coffee shadow-lg">
          {text}
        </span>
      )}
    </span>
  );
}
