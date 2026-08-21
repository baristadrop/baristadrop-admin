import type { NormalizedConversion } from '../../types';
import type { ProviderCapabilities, AffiliateProvider } from '../interface';
import type { AcknowledgementResponse, AffiliateLink, ProviderCredentials, TrackingConfig, TrackingParams } from '../types';

const AWIN_API_BASE = 'https://api.awin.com';

/** مبني على توثيق Awin العام (MasterTag redirect + Advertiser Reports API).
 * غير مُختبَر فعلياً -- ما فيه برنامج Awin حقيقي مربوط بالمشروع لحد الآن،
 * فهذا سقالة صحيحة البنية جاهزة ليوم ما نربط حساب Awin فعلي. */
export class AwinProvider implements AffiliateProvider {
  readonly code = 'awin';
  readonly capabilities: ProviderCapabilities = {
    tracking: true,
    sub_id: true,
    postback: true,
    webhook: false,
    conversion_api: true,
    transaction_api: true,
    report_import: true,
    pixel: false,
    refund_events: true,
  };

  generateTrackingUrl(link: AffiliateLink, clickId: string, config: TrackingConfig): string {
    const merchantId = config.awinMerchantId as string | undefined;
    const affiliateId = config.awinAffiliateId as string | undefined;
    if (!merchantId || !affiliateId) return link.destinationUrl; // إعداد ناقص -- ما نوقف الكليك (Rule: never block the click)

    const params = new URLSearchParams({
      awinmid: merchantId,
      awinaffid: affiliateId,
      clickref: clickId,
      ued: link.destinationUrl,
    });
    return `https://www.awin1.com/cread.php?${params.toString()}`;
  }

  normalizeTrackingParameters(config: Record<string, unknown>): TrackingParams {
    return {
      awinmid: String(config.awinMerchantId ?? ''),
      awinaffid: String(config.awinAffiliateId ?? ''),
      clickref: config.clickIdParameter as string | undefined ?? 'clickref',
    };
  }

  // شكل postback نموذجي عند Awin: clickref, amount, currency, commission, id (transaction id)
  parseConversion(rawPayload: unknown): NormalizedConversion {
    const p = rawPayload as Record<string, unknown>;
    return {
      providerConversionId: String(p.id ?? p.transactionId ?? ''),
      providerTransactionId: (p.id as string) ?? null,
      saleAmount: Number(p.amount ?? 0),
      commissionAmount: p.commission !== undefined ? Number(p.commission) : undefined,
      currency: (p.currency as string) ?? 'AED',
      conversionTime: (p.transactionDate as string) ?? new Date().toISOString(),
      clickId: (p.clickref as string) ?? null,
      providerClickId: (p.clickref as string) ?? null,
      rawEventId: String(p.id ?? ''),
    };
  }

  // Awin Advertiser Reports API -- Bearer token عبر affiliate_provider_credentials.api_key
  async fetchConversions(startDate: Date, endDate: Date, credentials: ProviderCredentials): Promise<NormalizedConversion[]> {
    if (!credentials.api_key || !credentials.publisher_id) return [];

    const params = new URLSearchParams({
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
      timezone: 'UTC',
    });
    const response = await fetch(`${AWIN_API_BASE}/publishers/${credentials.publisher_id}/transactions/?${params.toString()}`, {
      headers: { Authorization: `Bearer ${credentials.api_key}` },
    });
    if (!response.ok) throw new Error(`Awin API error: ${response.status}`);

    const rows = (await response.json()) as unknown[];
    return rows.map((row) => this.parseConversion(row));
  }

  async validateWebhook(): Promise<boolean> {
    return false; // Awin يستخدم postback، مو webhook موقّع
  }

  async validatePostback(request: Request, credentials: ProviderCredentials): Promise<boolean> {
    const url = new URL(request.url);
    return url.searchParams.get('password') === credentials.postback_secret;
  }

  async acknowledgeWebhook(): Promise<AcknowledgementResponse> {
    return { status: 200 };
  }

  getIdempotencyKey(conversion: NormalizedConversion): string {
    return conversion.providerTransactionId ?? conversion.providerConversionId;
  }
}
