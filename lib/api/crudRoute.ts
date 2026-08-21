// Shared CRUD route builder — reduces boilerplate for admin API list routes.
// كل راوت قوائم بسيط يستخدم نفس النمط: تحقق من الأدمن → استعلم → أرجع JSON.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getAdminClient } from '@/lib/supabaseAdmin';
import { parsePagination, paginateQuery } from '@/lib/db/pagination';
import { withErrorHandler } from '@/lib/errorHandler';

/**
 * Standard list handler — paginated, admin-authenticated, error-wrapped.
 *
 * Usage:
 *   export const GET = createListHandler('affiliate_merchants', {
 *     columns: 'id, name, status, country, currency',
 *     defaultOrder: 'name',
 *     filters: ['status', 'country'],
 *     searchColumns: ['name', 'legal_name'],
 *   });
 */
export function createListHandler(
  table: string,
  opts: {
    columns: string;
    defaultOrder?: string;
    filters?: string[];
    searchColumns?: string[];
  }
) {
  return withErrorHandler(async (request: Request) => {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const supabase = getAdminClient();
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase.from(table).select(opts.columns, { count: 'exact' });

    if (opts.filters) {
      for (const filter of opts.filters) {
        const value = searchParams.get(filter);
        if (value) query = query.eq(filter, value);
      }
    }

    const search = searchParams.get('search');
    if (search && opts.searchColumns?.length) {
      const orClause = opts.searchColumns.map((col) => `${col}.ilike.%${search}%`).join(',');
      query = query.or(orClause);
    }

    const orderCol = searchParams.get('order') ?? opts.defaultOrder ?? 'created_at';
    const orderDir = searchParams.get('dir') === 'asc';
    query = query.order(orderCol, { ascending: orderDir });

    const result = await paginateQuery(query, pagination);
    return NextResponse.json(result);
  });
}
