import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runMatchUnmatchedConversions, runProcessAffiliateWebhook } from './jobRunners';
import { createMockSupabase } from './testUtils/mockSupabase';

// Fix 4: بدون provider_click_id بالاستعلام، هذي المهمة كانت ما تقدر تطابق
// أي تحويلة UNMATCHED أبداً (click_id فارغ بالتعريف لهالحالة).
describe('runMatchUnmatchedConversions (Fix 4)', () => {
  it('links an UNMATCHED conversion via its stored provider_click_id and transitions it to PENDING', async () => {
    let updatedClickId: string | null = null;
    const { client } = createMockSupabase(
      {
        affiliate_conversions: (calls) => {
          if (calls.some((c) => c.method === 'update')) {
            updatedClickId = (calls.find((c) => c.method === 'update')?.args[0] as { click_id?: string })?.click_id ?? null;
            return { data: null, error: null };
          }
          return {
            data: [
              {
                id: 'conv-unmatched-1',
                affiliate_program_id: 'prog-1',
                provider_conversion_id: 'txn-1',
                click_id: null,
                provider_click_id: 'awin-sub-1',
              },
            ],
            error: null,
          };
        },
        affiliate_click_events: () => ({ data: { click_id: 'CLK-internal-1' }, error: null }),
      },
      { affiliate_transition_conversion: () => ({ data: null, error: null }) }
    );

    const result = await runMatchUnmatchedConversions(client as unknown as SupabaseClient);

    expect(result).toBe('linked 1/1 previously unmatched conversions');
    expect(updatedClickId).toBe('CLK-internal-1');
  });

  it('leaves the conversion untouched when no click matches yet', async () => {
    const { client } = createMockSupabase({
      affiliate_conversions: () => ({
        data: [
          {
            id: 'conv-unmatched-2',
            affiliate_program_id: 'prog-1',
            provider_conversion_id: 'txn-2',
            click_id: null,
            provider_click_id: 'awin-sub-2',
          },
        ],
        error: null,
      }),
      affiliate_click_events: () => ({ data: null, error: null }),
    });

    const result = await runMatchUnmatchedConversions(client as unknown as SupabaseClient);
    expect(result).toBe('linked 0/1 previously unmatched conversions');
  });
});

describe('runProcessAffiliateWebhook (Fix 1 defensive re-check + Fix 5 error boundary)', () => {
  it('skips an already-finalized postback event instead of reprocessing it', async () => {
    const { client } = createMockSupabase({
      affiliate_postback_events: () => ({
        data: { affiliate_program_id: 'prog-1', provider_code: 'awin', raw_payload: {}, status: 'rejected' },
        error: null,
      }),
    });

    const result = await runProcessAffiliateWebhook(client as unknown as SupabaseClient, { postbackEventId: 'pb-1' });
    expect(result).toBe('skipped: event already finalized (rejected)');
  });

  it('marks the event as error and rethrows when the provider/parse step throws (malformed event)', async () => {
    let markedStatus: string | null = null;
    const { client } = createMockSupabase({
      affiliate_postback_events: (calls) => {
        if (calls.some((c) => c.method === 'update')) {
          markedStatus = (calls.find((c) => c.method === 'update')?.args[0] as { status?: string })?.status ?? null;
          return { data: null, error: null };
        }
        // provider_code غير معروف -- ProviderFactory.forCode يرمي خطأ حقيقي،
        // نفس مسار "محوّل فشل" اللي يفترض Fix 5 يمسكه.
        return { data: { affiliate_program_id: 'prog-1', provider_code: 'not_a_real_provider', raw_payload: {}, status: 'received' }, error: null };
      },
    });

    await expect(runProcessAffiliateWebhook(client as unknown as SupabaseClient, { postbackEventId: 'pb-2' })).rejects.toThrow();
    expect(markedStatus).toBe('error');
  });
});
