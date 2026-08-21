import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { matchConversionToClick } from './clickMatching';
import { createMockSupabase } from './testUtils/mockSupabase';
import type { NormalizedConversion } from './types';

const base: NormalizedConversion = {
  providerConversionId: 'txn-1',
  saleAmount: 50,
  currency: 'AED',
  conversionTime: new Date().toISOString(),
};

describe('matchConversionToClick priority order', () => {
  it('priority 1: matches on internal click_id when present', async () => {
    const { client, allCalls } = createMockSupabase({
      affiliate_click_events: () => ({ data: { click_id: 'CLK-abc' }, error: null }),
    });

    const result = await matchConversionToClick(client as unknown as SupabaseClient, 'program-1', { ...base, clickId: 'CLK-abc' });
    expect(result).toBe('CLK-abc');
    expect(allCalls.affiliate_click_events.some((c) => c.method === 'eq' && c.args[0] === 'click_id')).toBe(true);
  });

  it('priority 2: falls through to provider click_id when internal click_id has no match', async () => {
    let callIndex = 0;
    const { client } = createMockSupabase({
      affiliate_click_events: (calls) => {
        callIndex += 1;
        const filteringOnClickId = calls.some((c) => c.method === 'eq' && c.args[0] === 'click_id');
        if (filteringOnClickId) return { data: null, error: null }; // priority 1 miss
        return { data: { click_id: 'CLK-matched-via-provider' }, error: null }; // priority 2 hit
      },
    });

    const result = await matchConversionToClick(client as unknown as SupabaseClient, 'program-1', {
      ...base,
      clickId: 'CLK-does-not-exist',
      providerClickId: 'awin-sub-id-42',
    });
    expect(result).toBe('CLK-matched-via-provider');
    expect(callIndex).toBe(2);
  });

  it('returns null (UNMATCHED) when neither internal nor provider click_id match -- never fuzzy-matches', async () => {
    const { client } = createMockSupabase({
      affiliate_click_events: () => ({ data: null, error: null }),
    });

    const result = await matchConversionToClick(client as unknown as SupabaseClient, 'program-1', {
      ...base,
      clickId: 'CLK-ghost',
      providerClickId: 'ghost-sub-id',
    });
    expect(result).toBeNull();
  });

  it('returns null immediately without any query when the conversion carries no click identifiers at all', async () => {
    const { client, allCalls } = createMockSupabase({});
    const result = await matchConversionToClick(client as unknown as SupabaseClient, 'program-1', base);
    expect(result).toBeNull();
    expect(allCalls.affiliate_click_events).toBeUndefined();
  });
});
