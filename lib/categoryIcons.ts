// مفاتيح ثابتة (بدل إيموجي حر) -- تطابق المفاتيح اللي يرسم عليها تطبيق الجوال
// أيقونات SVG موحّدة الشكل بدل الاعتماد على خط الإيموجي لكل جهاز. الرموز هنا
// للعرض الداخلي بلوحة التحكم فقط (مساعدة بصرية سريعة للأدمن/الشريك).
export const ICON_OPTIONS: { key: string; label: string; glyph: string }[] = [
  { key: 'cup', label: 'كوب', glyph: '☕' },
  { key: 'clean', label: 'تنظيف', glyph: '🧼' },
  { key: 'scale', label: 'ميزان', glyph: '⚖️' },
  { key: 'box', label: 'صندوق', glyph: '📦' },
  { key: 'bean', label: 'حبة بن', glyph: '🫘' },
  { key: 'handshake', label: 'شراكة', glyph: '🤝' },
];

const ICON_GLYPH: Record<string, string> = Object.fromEntries(ICON_OPTIONS.map((o) => [o.key, o.glyph]));

export function iconGlyph(key: string): string {
  return ICON_GLYPH[key] ?? '🫘';
}
