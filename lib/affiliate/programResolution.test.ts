import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveIntegration } from './programResolution';
import { createMockSupabase } from './testUtils/mockSupabase';
import type { AffiliateProvider } from './providers/interface';

function fakeProvider(code: string, extractProgramKey: AffiliateProvider['extractProgramKey']): AffiliateProvider {
  return {
    code,
    capabilities: {
      tracking: false,
      sub_id: false,
      postback: true,
      webhook: false,
      conversion_api: false,
      transaction_api: false,
      report_import: false,
      pixel: false,
      refund_events: false,
    },
    generateTrackingUrl: () => '',
    normalizeTrackingParameters: () => ({}),
    parseConversion: () => {
      throw new Error('not used in this test');
    },
    fetchConversions: async () => [],
    validateWebhook: async () => false,
    validatePostback: async () => true,
    acknowledgeWebhook: async () => ({ status: 200 }),
    getIdempotencyKey: (c) => c.providerConversionId,
    extractProgramKey,
  };
}

describe('resolveIntegration', () => {
  it('returns null when no active integrations exist for the provider', async () => {
    const { client } = createMockSupabase({
      affiliate_provider_integrations: () => ({ data: [], error: null }),
    });
    const provider = fakeProvider('awin', () => null);
    const result = await resolveIntegration(client as unknown as SupabaseClient, provider, {});
    expect(result).toBeNull();
  });

  it('matches by configuration key when the payload provides one', async () => {
    const { client } = createMockSupabase({
      affiliate_provider_integrations: () => ({
        data: [
          { id: 'int-1', affiliate_program_id: 'prog-1', configuration: { awinMerchantId: 'M1' } },
          { id: 'int-2', affiliate_program_id: 'prog-2', configuration: { awinMerchantId: 'M2' } },
        ],
        error: null,
      }),
    });
    const provider = fakeProvider('awin', () => ({ configKey: 'awinMerchantId', value: 'M2' }));
    const result = await resolveIntegration(client as unknown as SupabaseClient, provider, { awinmid: 'M2' });
    expect(result).toEqual({ id: 'int-2', affiliate_program_id: 'prog-2', configuration: { awinMerchantId: 'M2' } });
  });

  it('returns null when the payload key does not match any integration (suspicious/unknown merchant)', async () => {
    const { client } = createMockSupabase({
      affiliate_provider_integrations: () => ({
        data: [{ id: 'int-1', affiliate_program_id: 'prog-1', configuration: { awinMerchantId: 'M1' } }],
        error: null,
      }),
    });
    const provider = fakeProvider('awin', () => ({ configKey: 'awinMerchantId', value: 'UNKNOWN' }));
    const result = await resolveIntegration(client as unknown as SupabaseClient, provider, { awinmid: 'UNKNOWN' });
    expect(result).toBeNull();
  });

  it('falls back to the single active integration when the payload has no key', async () => {
    const { client } = createMockSupabase({
      affiliate_provider_integrations: () => ({
        data: [{ id: 'int-1', affiliate_program_id: 'prog-1', configuration: {} }],
        error: null,
      }),
    });
    const provider = fakeProvider('amazon', () => null);
    const result = await resolveIntegration(client as unknown as SupabaseClient, provider, {});
    expect(result).toEqual({ id: 'int-1', affiliate_program_id: 'prog-1', configuration: {} });
  });

  it('returns null (does not guess) when the payload has no key and multiple integrations are active', async () => {
    const { client } = createMockSupabase({
      affiliate_provider_integrations: () => ({
        data: [
          { id: 'int-1', affiliate_program_id: 'prog-1', configuration: {} },
          { id: 'int-2', affiliate_program_id: 'prog-2', configuration: {} },
        ],
        error: null,
      }),
    });
    const provider = fakeProvider('amazon', () => null);
    const result = await resolveIntegration(client as unknown as SupabaseClient, provider, {});
    expect(result).toBeNull();
  });
});
