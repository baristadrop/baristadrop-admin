// أداة ترقيم صفحات مشتركة لكل راوت قوائم بمنصة الأفيليت -- تمنع استعلامات
// بدون حد أقصى (select بدون limit) اللي تصير بطيئة مع كبر البيانات.
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export function parsePagination(searchParams: URLSearchParams): { page: number; offset: number; limit: number } {
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));
  const offset = (page - 1) * limit;
  return { page, offset, limit };
}

export type PaginatedResult<T> = {
  data: T[];
  count: number;
  page: number;
  limit: number;
  totalPages: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function paginateQuery<T>(query: any, pagination: { page: number; offset: number; limit: number }): Promise<PaginatedResult<T>> {
  const { data, error, count } = await query.range(pagination.offset, pagination.offset + pagination.limit - 1);
  if (error) throw error;

  return {
    data: (data ?? []) as T[],
    count: count ?? 0,
    page: pagination.page,
    limit: pagination.limit,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / pagination.limit)),
  };
}
