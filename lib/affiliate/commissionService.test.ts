import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateCommission, getProgramBalance, postLedgerEntry } from './commissionService';
import { createMockSupabase } from './testUtils/mockSupabase';

type Rule = {
  id: string;
  commission_model: string;
  rate: number | null;
  min_commission: number | null;
  max_commission: number | null;
  conditions: Record<string, unknown>;
  product_category: string | null;
  priority: number;
};

function rulesResolver(rules: Rule[]) {
  return () => ({ data: rules, error: null });
}

// 10.1 commissionService.test.ts -- percentage, fixed, tiered, provider-reported, null handling, rounding
describe('calculateCommission', () => {
  it('providerCommission is authoritative when present, even if rules exist', async () => {
    const { client } = createMockSupabase({
      affiliate_commission_rules: rulesResolver([
        { id: 'r1', commission_model: 'percentage', rate: 50, min_commission: null, max_commission: null, conditions: {}, product_category: null, priority: 0 },
      ]),
    });
    const result = await calculateCommission(client as unknown as SupabaseClient, 'program-1', {
      saleAmount: 100,
      providerCommission: 7.5,
      productCategory: null,
    });
    expect(result).toEqual({ amount: 7.5, source: 'provider' });
  });

  it('returns 0/default when no rules exist and no provider commission', async () => {
    const { client } = createMockSupabase({ affiliate_commission_rules: rulesResolver([]) });
    const result = await calculateCommission(client as unknown as SupabaseClient, 'program-1', { saleAmount: 100, productCategory: null });
    expect(result).toEqual({ amount: 0, source: 'default' });
  });

  it('applies a percentage rule and rounds to 2 decimals', async () => {
    const { client } = createMockSupabase({
      affiliate_commission_rules: rulesResolver([
        { id: 'r1', commission_model: 'percentage', rate: 12.5, min_commission: null, max_commission: null, conditions: {}, product_category: null, priority: 0 },
      ]),
    });
    const result = await calculateCommission(client as unknown as SupabaseClient, 'program-1', { saleAmount: 33.33, productCategory: null });
    expect(result.amount).toBe(4.17); // 33.33 * 0.125 = 4.16625 -> rounds up
    expect(result.source).toBe('rule');
  });

  it('applies a fixed rule regardless of sale amount', async () => {
    const { client } = createMockSupabase({
      affiliate_commission_rules: rulesResolver([
        { id: 'r1', commission_model: 'fixed', rate: 15, min_commission: null, max_commission: null, conditions: {}, product_category: null, priority: 0 },
      ]),
    });
    const result = await calculateCommission(client as unknown as SupabaseClient, 'program-1', { saleAmount: 999, productCategory: null });
    expect(result.amount).toBe(15);
  });

  it('clamps a percentage result to min/max_commission', async () => {
    const { client } = createMockSupabase({
      affiliate_commission_rules: rulesResolver([
        { id: 'r1', commission_model: 'percentage', rate: 50, min_commission: 5, max_commission: 20, conditions: {}, product_category: null, priority: 0 },
      ]),
    });
    const high = await calculateCommission(client as unknown as SupabaseClient, 'program-1', { saleAmount: 1000, productCategory: null }); // 500 -> clamp to 20
    expect(high.amount).toBe(20);

    const { client: client2 } = createMockSupabase({
      affiliate_commission_rules: rulesResolver([
        { id: 'r1', commission_model: 'percentage', rate: 1, min_commission: 5, max_commission: 20, conditions: {}, product_category: null, priority: 0 },
      ]),
    });
    const low = await calculateCommission(client2 as unknown as SupabaseClient, 'program-1', { saleAmount: 10, productCategory: null }); // 0.10 -> clamp to 5
    expect(low.amount).toBe(5);
  });

  it('picks the correct tier for a tiered rule', async () => {
    const { client } = createMockSupabase({
      affiliate_commission_rules: rulesResolver([
        {
          id: 'r1',
          commission_model: 'tiered',
          rate: 5,
          min_commission: null,
          max_commission: null,
          conditions: { tiers: [{ min: 0, max: 99, rate: 5 }, { min: 100, max: null, rate: 10 }] },
          product_category: null,
          priority: 0,
        },
      ]),
    });
    const lowTier = await calculateCommission(client as unknown as SupabaseClient, 'program-1', { saleAmount: 50, productCategory: null });
    expect(lowTier.amount).toBe(2.5); // 50 * 5%
    const highTier = await calculateCommission(client as unknown as SupabaseClient, 'program-1', { saleAmount: 500, productCategory: null });
    expect(highTier.amount).toBe(50); // 500 * 10%
  });

  it('a category-specific rule wins over a general rule for that category', async () => {
    const { client } = createMockSupabase({
      affiliate_commission_rules: rulesResolver([
        { id: 'general', commission_model: 'percentage', rate: 5, min_commission: null, max_commission: null, conditions: {}, product_category: null, priority: 100 },
        { id: 'specific', commission_model: 'percentage', rate: 15, min_commission: null, max_commission: null, conditions: {}, product_category: 'v60-tools', priority: 0 },
      ]),
    });
    const result = await calculateCommission(client as unknown as SupabaseClient, 'program-1', { saleAmount: 100, productCategory: 'v60-tools' });
    expect(result.amount).toBe(15); // specific wins despite lower declared priority
  });
});

describe('postLedgerEntry', () => {
  it('preserves original currency and the base-currency conversion fields unchanged (multi-currency Rule #23/24)', async () => {
    let inserted: Record<string, unknown> | null = null;
    const { client } = createMockSupabase({
      affiliate_commission_ledger: (calls) => {
        const insertCall = calls.find((c) => c.method === 'insert');
        inserted = insertCall?.args[0] as Record<string, unknown>;
        return { data: null, error: null };
      },
    });

    await postLedgerEntry(client as unknown as SupabaseClient, {
      affiliateProgramId: 'program-1',
      eventType: 'CONVERSION_PENDING',
      amount: 500,
      currency: 'USD',
      exchangeRate: 0.92,
      baseAmount: 460,
      baseCurrency: 'EUR',
      reference: 'test',
    });

    expect(inserted).toMatchObject({
      amount: 500,
      currency: 'USD',
      exchange_rate: 0.92,
      base_amount: 460,
      base_currency: 'EUR',
    });
  });
});

describe('getProgramBalance', () => {
  it('uses the calculate_program_balance RPC (migration 0079) as the primary path', async () => {
    const { client } = createMockSupabase(
      {},
      {
        calculate_program_balance: (params) => {
          expect(params.p_program_id).toBe('program-1');
          return { data: [{ expected: 100, reversed: -20, paid: -50, outstanding: 30, currency: 'AED' }], error: null };
        },
      }
    );

    const balance = await getProgramBalance(client as unknown as SupabaseClient, 'program-1');
    expect(balance).toEqual({ expected: 100, reversed: -20, paid: -50, outstanding: 30, currency: 'AED' });
  });

  it('falls back to paginated summation if the RPC fails (defensive -- financial data must never silently return nothing)', async () => {
    const { client } = createMockSupabase(
      {
        affiliate_commission_ledger: () => ({
          data: [
            { event_type: 'CONVERSION_PENDING', amount: 100, currency: 'AED' },
            { event_type: 'CONVERSION_APPROVED', amount: 0, currency: 'AED' },
            { event_type: 'CONVERSION_REJECTED', amount: -20, currency: 'AED' },
            { event_type: 'PAYOUT_RECEIVED', amount: -50, currency: 'AED' },
          ],
          error: null,
        }),
      },
      { calculate_program_balance: () => ({ data: null, error: { message: 'function not found' } }) }
    );

    const balance = await getProgramBalance(client as unknown as SupabaseClient, 'program-1');
    expect(balance.expected).toBe(100);
    expect(balance.reversed).toBe(-20);
    expect(balance.paid).toBe(-50);
    expect(balance.outstanding).toBe(30); // 100 - 20 - 50
    expect(balance.currency).toBe('AED');
  });
});
