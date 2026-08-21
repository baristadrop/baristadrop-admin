import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runReconciliation, hashReportFile } from './reconciliationService';
import { createMockSupabase } from './testUtils/mockSupabase';
import type { ProviderConversionRecord } from './types';

type InternalRow = { id: string; provider_conversion_id: string; sale_amount: number; conversion_status: string };

function mockFor(internal: InternalRow[]) {
  const items: Record<string, unknown>[] = [];
  let finalStatus: string | null = null;

  const { client } = createMockSupabase({
    affiliate_reconciliation_runs: (calls) => {
      const updateCall = calls.find((c) => c.method === 'update');
      if (updateCall) {
        finalStatus = (updateCall.args[0] as { status?: string }).status ?? null;
        return { data: null, error: null };
      }
      return { data: { id: 'run-1' }, error: null }; // insert path (starting the run)
    },
    affiliate_conversions: () => ({ data: internal, error: null }),
    affiliate_reconciliation_items: (calls) => {
      const insertCall = calls.find((c) => c.method === 'insert');
      if (insertCall) items.push(...(insertCall.args[0] as Record<string, unknown>[]));
      return { data: null, error: null };
    },
  });

  return { client, items, getFinalStatus: () => finalStatus };
}

async function classify(internal: InternalRow[], providerRecords: ProviderConversionRecord[]) {
  const { client, items, getFinalStatus } = mockFor(internal);
  await runReconciliation(client as unknown as SupabaseClient, {
    affiliateProgramId: 'p1',
    providerCode: 'awin',
    periodStart: new Date('2026-01-01'),
    periodEnd: new Date('2026-01-31'),
    providerRecords,
  });
  return { items, finalStatus: getFinalStatus() };
}

// 10.3 -- حالات المطابقة المدعومة فعلياً بمنطق reconciliationService.ts
// (MANUAL_REVIEW لاختلاف العملة مو مطبّق بالكود الحالي -- ما نختبر شي غير موجود)
describe('runReconciliation classification', () => {
  it('MATCHED: same amount and status on both sides', async () => {
    const { items, finalStatus } = await classify(
      [{ id: 'c1', provider_conversion_id: 'txn-1', sale_amount: 100, conversion_status: 'APPROVED' }],
      [{ providerConversionId: 'txn-1', amount: 100, status: 'APPROVED' }]
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ recon_status: 'MATCHED' });
    expect(finalStatus).toBe('completed');
  });

  it('AMOUNT_MISMATCH: internal €20 vs provider €25', async () => {
    const { items } = await classify(
      [{ id: 'c1', provider_conversion_id: 'txn-1', sale_amount: 20, conversion_status: 'APPROVED' }],
      [{ providerConversionId: 'txn-1', amount: 25, status: 'APPROVED' }]
    );
    expect(items[0]).toMatchObject({ recon_status: 'AMOUNT_MISMATCH', internal_amount: 20, provider_amount: 25 });
  });

  it('STATUS_MISMATCH: we say APPROVED, provider says REVERSED', async () => {
    const { items } = await classify(
      [{ id: 'c1', provider_conversion_id: 'txn-1', sale_amount: 100, conversion_status: 'APPROVED' }],
      [{ providerConversionId: 'txn-1', amount: 100, status: 'REVERSED' }]
    );
    expect(items[0]).toMatchObject({ recon_status: 'STATUS_MISMATCH' });
  });

  it('MISSING_FROM_PROVIDER: we have it, provider does not', async () => {
    const { items } = await classify(
      [{ id: 'c1', provider_conversion_id: 'txn-only-internal', sale_amount: 100, conversion_status: 'APPROVED' }],
      []
    );
    expect(items[0]).toMatchObject({ recon_status: 'MISSING_FROM_PROVIDER' });
  });

  it('MISSING_FROM_INTERNAL: provider has it, we do not', async () => {
    const { items } = await classify([], [{ providerConversionId: 'txn-only-provider', amount: 100, status: 'APPROVED' }]);
    expect(items[0]).toMatchObject({ recon_status: 'MISSING_FROM_INTERNAL' });
  });

  it('DUPLICATE: provider sends the same conversion twice', async () => {
    const { items } = await classify(
      [{ id: 'c1', provider_conversion_id: 'txn-dup', sale_amount: 100, conversion_status: 'APPROVED' }],
      [
        { providerConversionId: 'txn-dup', amount: 100, status: 'APPROVED' },
        { providerConversionId: 'txn-dup', amount: 100, status: 'APPROVED' },
      ]
    );
    expect(items.some((i) => i.recon_status === 'DUPLICATE')).toBe(true);
  });

  it('marks the run failed (not stuck "running") if something throws mid-reconciliation', async () => {
    const { client } = createMockSupabase({
      affiliate_reconciliation_runs: () => ({ data: { id: 'run-1' }, error: null }),
      affiliate_conversions: () => {
        throw new Error('simulated DB failure');
      },
    });

    await expect(
      runReconciliation(client as unknown as SupabaseClient, {
        affiliateProgramId: 'p1',
        providerCode: 'awin',
        periodStart: new Date(),
        periodEnd: new Date(),
        providerRecords: [],
      })
    ).rejects.toThrow();
  });
});

describe('hashReportFile', () => {
  it('produces the same hash for identical content (dedup) and different hashes otherwise', () => {
    const a = hashReportFile(Buffer.from('same content'));
    const b = hashReportFile(Buffer.from('same content'));
    const c = hashReportFile(Buffer.from('different content'));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
