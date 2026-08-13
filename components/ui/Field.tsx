'use client';

import { ReactNode } from 'react';

/** حقل بعنوان + شرح مبسّط تحته + المُدخل نفسه — بدل عمود جدول بلا سياق. */
export function Field({ label, helper, children }: { label: ReactNode; helper?: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-mocha">{label}</label>
      {children}
      {helper && <p className="mt-1 text-[11px] text-stone">{helper}</p>}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone">{children}</h4>;
}
