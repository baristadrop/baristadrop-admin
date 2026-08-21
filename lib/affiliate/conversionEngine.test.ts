import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isValidConversionTransition, processConversionEvent } from './conversionEngine';
import { createMockSupabase } from './testUtils/mockSupabase';
import type { ConversionStatus, NormalizedConversion } from './types';

// 10.1 stateMachine.test.ts -- كل التحويلات المسموحة والممنوعة (3.4 بالخطة)
describe('isValidConversionTransition', () => {
  const VALID: [ConversionStatus, ConversionStatus][] = [
    ['PENDING', 'APPROVED'],
    ['PENDING', 'REJECTED'],
    ['PENDING', 'CANCELLED'],
    ['APPROVED', 'PAID'],
    ['APPROVED', 'REVERSED'],
    ['UNMATCHED', 'PENDING'],
  ];

  const INVALID: [ConversionStatus, ConversionStatus][] = [
    ['PENDING', 'PAID'], // ما يصير يتخطى APPROVED
    ['PENDING', 'REVERSED'],
    ['APPROVED', 'REJECTED'], // بعد الموافقة، مب رفض -- عكس أو دفع بس
    ['APPROVED', 'CANCELLED'],
    ['REJECTED', 'PENDING'], // حالات نهائية -- ما ترجع أبداً
    ['REJECTED', 'APPROVED'],
    ['CANCELLED', 'PENDING'],
    ['REVERSED', 'APPROVED'],
    ['PAID', 'REVERSED'], // بعد الدفع خلاص، ما فيه تراجع بهذا المسار
    ['UNMATCHED', 'APPROVED'], // لازم يمر بـ PENDING أول
    ['PENDING', 'PENDING'], // نفس الحالة مب "تحويلة"
  ];

  for (const [from, to] of VALID) {
    it(`allows ${from} -> ${to}`, () => {
      expect(isValidConversionTransition(from, to)).toBe(true);
    });
  }

  for (const [from, to] of INVALID) {
    it(`rejects ${from} -> ${to}`, () => {
      expect(isValidConversionTransition(from, to)).toBe(false);
    });
  }

  it('terminal statuses (REJECTED/CANCELLED/REVERSED/PAID) have no valid outgoing transition at all', () => {
    const terminal: ConversionStatus[] = ['REJECTED', 'CANCELLED', 'REVERSED', 'PAID'];
    const anyStatus: ConversionStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REVERSED', 'PAID', 'UNMATCHED'];
    for (const from of terminal) {
      for (const to of anyStatus) {
        expect(isValidConversionTransition(from, to)).toBe(false);
      }
    }
  });
});

// 10.1 idempotency.test.ts (مطوي هنا لأنه يختبر نفس processConversionEvent)
describe('processConversionEvent idempotency', () => {
  const normalized: NormalizedConversion = {
    providerConversionId: 'txn-123',
    saleAmount: 100,
    currency: 'AED',
    conversionTime: new Date().toISOString(),
  };

  it('returns outcome "duplicate" without inserting when the conversion already exists', async () => {
    const { client, allCalls } = createMockSupabase({
      affiliate_conversions: (calls) => {
        // أول استدعاء (فحص التكرار بخطوة 3) يرجع صف موجود -- ما يوصل أبداً لـ insert
        if (calls.some((c) => c.method === 'insert')) {
          throw new Error('should never reach insert when a duplicate already exists');
        }
        return { data: { id: 'existing-conversion-id', conversion_status: 'PENDING' }, error: null };
      },
    });

    const result = await processConversionEvent(client as unknown as SupabaseClient, 'program-1', normalized);
    expect(result.outcome).toBe('duplicate');
    expect(result.conversionId).toBe('existing-conversion-id');
  });

  it('creates a new conversion when no duplicate exists (UNMATCHED when no click_id resolves)', async () => {
    let conversionsCallCount = 0;
    const { client } = createMockSupabase({
      affiliate_conversions: (calls) => {
        conversionsCallCount += 1;
        if (calls.some((c) => c.method === 'insert')) {
          return { data: { id: 'new-conversion-id' }, error: null };
        }
        return { data: null, error: null }; // فحص التكرار: ما فيه شي
      },
      affiliate_click_events: () => ({ data: null, error: null }), // ما فيه كليك يطابق
      affiliate_commission_rules: () => ({ data: [], error: null }),
      affiliate_conversion_events: () => ({ data: null, error: null }),
      affiliate_commission_ledger: () => ({ data: null, error: null }),
    });

    const result = await processConversionEvent(client as unknown as SupabaseClient, 'program-1', normalized);
    expect(result.outcome).toBe('created');
    expect(result.status).toBe('UNMATCHED');
    expect(conversionsCallCount).toBeGreaterThan(0);
  });
});
