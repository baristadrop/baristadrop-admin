export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string | null | undefined): value is string {
  return !!value && UUID_RE.test(value);
}

export function isValidOrderAmount(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/** تُقرَّب لأقرب فلس (خانتين عشريتين) وتُخزَّن كلقطة وقت التأكيد -- لو
 * الأدمن غيّر نسبة العمولة لاحقاً، عمولة هذا الطلب ما تتغيّر رجعياً. */
export function calculateCommission(orderAmount: number, commissionPercent: number | null): number {
  const percent = commissionPercent ?? 0;
  return Math.round(orderAmount * (percent / 100) * 100) / 100;
}
