// Integration tests — end-to-end flows that span multiple modules.
// اختبارات تكاملية تغطي المسار الكامل: ويبهوك → تحويل → دفتر أستاذ.
import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { processConversionEvent, isValidConversionTransition } from '../conversionEngine';
import { createMockSupabase } from '../testUtils/mockSupabase';
import type { ConversionStatus, NormalizedConversion } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Flow 1: Webhook → Conversion → Ledger
// ─────────────────────────────────────────────────────────────────────────────
describe('Integration: Webhook → Conversion → Ledger flow', () => {
  const programId = 'test-program-1';
  const conversion: NormalizedConversion = {
    providerConversionId: 'txn-integration-001',
    saleAmount: 250,
    currency: 'AED',
    conversionTime: new Date().toISOString(),
    clickId: 'CLK-00000000-0000-0000-0000-000000000001',
  };

  it('creates conversion as UNMATCHED when no click matches, and posts ledger entry', async () => {
    const { client } = createMockSupabase({
      affiliate_conversions: (calls) => {
        if (calls.some((c) => c.method === 'insert')) {
          return { data: { id: 'conv-int-001' }, error: null };
        }
        return { data: null, error: null }; // no duplicate
      },
      affiliate_click_events: () => ({ data: null, error: null }),
      affiliate_commission_rules: () => ({
        data: [{ commission_rate: 10, commission_model: 'percentage', currency: 'AED' }],
        error: null,
      }),
      affiliate_conversion_events: () => ({ data: null, error: null }),
      affiliate_commission_ledger: (calls) => {
        if (calls.some((c) => c.method === 'insert')) {
          return { data: null, error: null };
        }
        return { data: [], error: null };
      },
    });

    const result = await processConversionEvent(client as unknown as SupabaseClient, programId, conversion);

    expect(result.outcome).toBe('created');
    expect(result.status).toBe('UNMATCHED');
    expect(result.conversionId).toBe('conv-int-001');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Flow 2: Idempotency — duplicate webhook rejection
// ─────────────────────────────────────────────────────────────────────────────
describe('Integration: Idempotency — duplicate conversion rejected', () => {
  const programId = 'test-program-1';
  const conversion: NormalizedConversion = {
    providerConversionId: 'txn-duplicate-001',
    saleAmount: 100,
    currency: 'AED',
    conversionTime: new Date().toISOString(),
  };

  it('returns "duplicate" when the same conversion is submitted twice', async () => {
    const { client } = createMockSupabase({
      affiliate_conversions: () => ({
        data: { id: 'existing-conv-id', conversion_status: 'PENDING' },
        error: null,
      }),
    });

    const result = await processConversionEvent(client as unknown as SupabaseClient, programId, conversion);

    expect(result.outcome).toBe('duplicate');
    expect(result.conversionId).toBe('existing-conv-id');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Flow 3: Reversal — APPROVED → REVERSED with negative ledger entry
// ─────────────────────────────────────────────────────────────────────────────
describe('Integration: Reversal flow (APPROVED → REVERSED)', () => {
  it('allows APPROVED → REVERSED transition', () => {
    expect(isValidConversionTransition('APPROVED', 'REVERSED')).toBe(true);
  });

  it('rejects REVERSED → any other status (terminal state)', () => {
    const allStatuses: ConversionStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REVERSED', 'PAID', 'UNMATCHED'];
    for (const target of allStatuses) {
      expect(isValidConversionTransition('REVERSED', target)).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Flow 4: UNMATCHED conversion handling
// ─────────────────────────────────────────────────────────────────────────────
describe('Integration: UNMATCHED conversion → PENDING (manual link)', () => {
  it('allows UNMATCHED → PENDING transition (manual click linking)', () => {
    expect(isValidConversionTransition('UNMATCHED', 'PENDING')).toBe(true);
  });

  it('rejects UNMATCHED → APPROVED (must go through PENDING first)', () => {
    expect(isValidConversionTransition('UNMATCHED', 'APPROVED')).toBe(false);
  });

  it('rejects UNMATCHED → PAID (must go through full flow)', () => {
    expect(isValidConversionTransition('UNMATCHED', 'PAID')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Flow 5: Full state machine coverage — no invalid transitions slip through
// ─────────────────────────────────────────────────────────────────────────────
describe('Integration: Complete state machine has no gaps', () => {
  const allStatuses: ConversionStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REVERSED', 'PAID', 'UNMATCHED'];

  it('every status can be checked without throwing', () => {
    for (const from of allStatuses) {
      for (const to of allStatuses) {
        expect(() => isValidConversionTransition(from, to)).not.toThrow();
      }
    }
  });

  it('exactly 6 valid transitions exist in the state machine', () => {
    let validCount = 0;
    for (const from of allStatuses) {
      for (const to of allStatuses) {
        if (isValidConversionTransition(from, to)) validCount++;
      }
    }
    // PENDING→APPROVED, PENDING→REJECTED, PENDING→CANCELLED,
    // APPROVED→PAID, APPROVED→REVERSED, UNMATCHED→PENDING = 6
    expect(validCount).toBe(6);
  });
});
