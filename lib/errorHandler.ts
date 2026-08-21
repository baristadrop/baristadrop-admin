// Standardized error handling for API routes.
// يوحّد شكل رسائل الخطأ + يمنع تسريب تفاصيل داخلية للعميل.
import { NextResponse } from 'next/server';

// Known Supabase/PostgreSQL error codes → HTTP status + safe user message
const SUPABASE_ERROR_MAP: Record<string, { status: number; userMessage: string }> = {
  '23505': { status: 409, userMessage: 'هذا السجل موجود مسبقاً' },
  '23503': { status: 400, userMessage: 'البيانات المرجعية غير موجودة' },
  '23502': { status: 400, userMessage: 'حقول مطلوبة ناقصة' },
  PGRST301: { status: 400, userMessage: 'بيانات غير صالحة' },
  PGRST302: { status: 404, userMessage: 'السجل غير موجود' },
};

/**
 * Wraps an API route handler with standardized error handling.
 * Any unhandled error → safe JSON response (never exposes internals).
 *
 * Usage:
 *   export const GET = withErrorHandler(async (request) => {
 *     // ... your logic
 *     return NextResponse.json({ data });
 *   });
 */
export function withErrorHandler(
  handler: (request: Request) => Promise<NextResponse>
): (request: Request) => Promise<NextResponse> {
  return async (request: Request) => {
    try {
      return await handler(request);
    } catch (err) {
      const error = err as { code?: string; message?: string; name?: string };

      if (error.code && SUPABASE_ERROR_MAP[error.code]) {
        const mapped = SUPABASE_ERROR_MAP[error.code];
        return NextResponse.json({ error: mapped.userMessage, code: error.code }, { status: mapped.status });
      }

      console.error(`[API Error] ${request.method} ${new URL(request.url).pathname}`, {
        message: error.message,
        code: error.code,
        name: error.name,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json({ error: 'حدث خطأ غير متوقع. حاول مرة أخرى.' }, { status: 500 });
    }
  };
}

/**
 * Formats a Supabase error into a user-friendly object.
 * Use for inline error handling (when you don't want the full wrapper).
 */
export function formatSupabaseError(error: { code?: string; message: string }): {
  error: string;
  code?: string;
} {
  if (error.code && SUPABASE_ERROR_MAP[error.code]) {
    return { error: SUPABASE_ERROR_MAP[error.code].userMessage, code: error.code };
  }
  return { error: 'حدث خطأ غير متوقع' };
}

/**
 * Retry wrapper for transient failures (429, 503, network errors).
 * Exponential backoff: baseDelay × 2^(attempt-1).
 *
 * Usage:
 *   const data = await withRetry(() => supabase.from('t').select('id'));
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts?: number; baseDelayMs?: number } = {}
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 500;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) throw err;

      const error = err as { status?: number; code?: string };
      const isTransient =
        error.status === 429 || error.status === 503 || error.code === 'PGRST301' || err instanceof TypeError;

      if (!isTransient) throw err;

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error('withRetry: unreachable');
}
