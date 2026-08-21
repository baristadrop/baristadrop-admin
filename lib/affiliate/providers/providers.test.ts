import { describe, it, expect } from 'vitest';
import { DirectMerchantProvider } from './direct/DirectMerchantProvider';
import { AwinProvider } from './awin/AwinProvider';
import { CJProvider } from './cj/CJProvider';
import { AmazonProvider } from './amazon/AmazonProvider';
import type { AffiliateLink } from './types';

const link: AffiliateLink = {
  id: 'link-1',
  affiliateProgramId: 'program-1',
  productId: null,
  destinationUrl: 'https://roaster.example.com/product/42',
  trackingTemplate: null,
  token: 'tok123',
  status: 'active',
};

// 10.1 -- URL generation, parameter mapping, payload parsing لكل أدابتر
// (Awin/CJ/Amazon مطويين هنا بدل ملف منفصل لكل واحد -- نفس التغطية، أقل تكرار)

describe('DirectMerchantProvider', () => {
  const provider = new DirectMerchantProvider();

  it('appends the click id as a query param on the raw destination URL', () => {
    const url = provider.generateTrackingUrl(link, 'CLK-abc', {});
    expect(url).toBe('https://roaster.example.com/product/42?bd_click_id=CLK-abc');
  });

  it('respects a custom click id parameter name from config', () => {
    const url = provider.generateTrackingUrl(link, 'CLK-abc', { clickIdParameter: 'ref' });
    expect(url).toContain('ref=CLK-abc');
  });

  it('parses the existing webhook payload shape correctly', () => {
    const parsed = provider.parseConversion({ click_id: 'uuid-1', order_amount: 150, order_reference: 'ORD-9', currency: 'AED' });
    expect(parsed.saleAmount).toBe(150);
    expect(parsed.clickId).toBe('uuid-1');
    expect(parsed.providerConversionId).toBe('ORD-9');
  });

  it('never calls a live API for conversions (postback-only provider)', async () => {
    await expect(provider.fetchConversions()).resolves.toEqual([]);
  });
});

describe('AwinProvider', () => {
  const provider = new AwinProvider();

  it('falls back to the raw destination URL when merchant/affiliate IDs are missing (never blocks the click)', () => {
    const url = provider.generateTrackingUrl(link, 'CLK-1', {});
    expect(url).toBe(link.destinationUrl);
  });

  it('builds the correct awin1.com MasterTag redirect URL when configured', () => {
    const url = provider.generateTrackingUrl(link, 'CLK-1', { awinMerchantId: '1234', awinAffiliateId: '5678' } as never);
    expect(url).toContain('https://www.awin1.com/cread.php?');
    expect(url).toContain('awinmid=1234');
    expect(url).toContain('awinaffid=5678');
    expect(url).toContain('clickref=CLK-1');
    expect(url).toContain(encodeURIComponent(link.destinationUrl));
  });

  it('parses a typical Awin postback payload', () => {
    const parsed = provider.parseConversion({ id: 'txn-99', amount: 200, commission: 12, currency: 'AED', clickref: 'CLK-2' });
    expect(parsed.providerConversionId).toBe('txn-99');
    expect(parsed.saleAmount).toBe(200);
    expect(parsed.commissionAmount).toBe(12);
    expect(parsed.clickId).toBe('CLK-2');
  });

  it('idempotency key prefers the provider transaction id over the conversion id', () => {
    const key = provider.getIdempotencyKey({
      providerConversionId: 'conv-1',
      providerTransactionId: 'txn-1',
      saleAmount: 1,
      currency: 'AED',
      conversionTime: new Date().toISOString(),
    });
    expect(key).toBe('txn-1');
  });
});

describe('CJProvider', () => {
  const provider = new CJProvider();

  it('falls back to the raw destination URL when link/publisher IDs are missing', () => {
    const url = provider.generateTrackingUrl(link, 'CLK-1', {});
    expect(url).toBe(link.destinationUrl);
  });

  it('builds a click-{pid}-{linkId} redirect URL when configured', () => {
    const url = provider.generateTrackingUrl(link, 'CLK-1', { cjPublisherId: '111', cjLinkId: '222' } as never);
    expect(url).toContain('click-111-222');
    expect(url).toContain('sid=CLK-1');
  });

  it('parses a typical CJ postback payload (SID/CID/AMT convention)', () => {
    const parsed = provider.parseConversion({ CID: 'cj-txn-1', AMT: 80, SID: 'CLK-3', CURRENCY: 'AED' });
    expect(parsed.providerConversionId).toBe('cj-txn-1');
    expect(parsed.saleAmount).toBe(80);
    expect(parsed.clickId).toBe('CLK-3');
  });
});

describe('AmazonProvider', () => {
  const provider = new AmazonProvider();

  it('appends the associate tag when configured', () => {
    const url = provider.generateTrackingUrl(link, 'CLK-1', { amazonAssociateTag: 'baristadrop-21' } as never);
    expect(url).toContain('tag=baristadrop-21');
  });

  it('parses a CSV report row (Associates Central export column names)', () => {
    const parsed = provider.parseConversion({
      'Order ID': 'AMZ-1', 'Item Price': 45.5, 'Ad Fees': 2.28, Currency: 'AED', 'Tracking ID': 'CLK-4',
    });
    expect(parsed.providerConversionId).toBe('AMZ-1');
    expect(parsed.saleAmount).toBe(45.5);
    expect(parsed.commissionAmount).toBe(2.28);
  });

  it('honestly has no live conversion API (Associates does not offer one to standard partners)', async () => {
    await expect(provider.fetchConversions()).rejects.toThrow(/report_import/);
    expect(provider.capabilities.conversion_api).toBe(false);
  });
});
