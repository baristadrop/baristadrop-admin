// أداة اختبار خفيفة تحاكي سلسلة استعلامات @supabase/supabase-js (from/
// select/eq/insert/...) بدون أي اتصال شبكة حقيقي. كل استدعاء سلسلة يُسجَّل
// بـ calls[]، والنتيجة تُحدَّد عبر resolver لكل جدول (يستقبل سجل الاستدعاءات
// ويرجع {data, error}). مبنية خصيصاً لأنماط lib/affiliate/*.ts فقط -- ما
// تغطي كل الـ Supabase JS API، بس اللي فعلاً يُستخدم هنا.

export type QueryCall = { method: string; args: unknown[] };
export type TableResolver = (calls: QueryCall[]) => { data: unknown; error: unknown };

const CHAIN_METHODS = [
  'select', 'insert', 'update', 'delete', 'upsert',
  'eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in', 'or', 'order', 'limit', 'range',
] as const;

function makeBuilder(calls: QueryCall[], resolve: () => { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};

  for (const method of CHAIN_METHODS) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }

  // single()/maybeSingle() هي نهاية السلسلة عادةً -- تُرجع نتيجة resolve() مباشرة
  builder.single = () => Promise.resolve(resolve());
  builder.maybeSingle = () => Promise.resolve(resolve());

  // السلسلة نفسها thenable -- تدعم `await supabase.from(...).select(...).eq(...)`
  // بدون single()/maybeSingle() صريح (نفس سلوك PostgrestFilterBuilder الحقيقي)
  builder.then = (onFulfilled: (v: { data: unknown; error: unknown }) => unknown) => Promise.resolve(resolve()).then(onFulfilled);

  return builder;
}

/** resolvers: خريطة اسم الجدول -> دالة تحدد نتيجة أي استعلام على هذا الجدول.
 * لو الجدول ما له resolver، يرجع {data: null, error: null} بشكل افتراضي. */
export function createMockSupabase(resolvers: Record<string, TableResolver>) {
  const allCalls: Record<string, QueryCall[]> = {};

  const client = {
    from(table: string) {
      const calls: QueryCall[] = [];
      allCalls[table] = calls;
      const resolver = resolvers[table] ?? (() => ({ data: null, error: null }));
      return makeBuilder(calls, () => resolver(calls));
    },
  };

  return { client, allCalls };
}
