import type { NormalizedConversion } from '../../types';
import type { ProviderCapabilities, AffiliateProvider } from '../interface';
import type { AcknowledgementResponse, AffiliateLink, ProviderCredentials, TrackingConfig, TrackingParams } from '../types';

const CJ_COMMISSION_API = 'https://commissions.api.cj.com/query';

/** مبني على توثيق CJ Affiliate العام (deep link redirect + GraphQL Commission
 * Detail API). غير مُختبَر فعلياً -- ما فيه برنامج CJ حقيقي مربوط بعد. */
export class CJProvider implements AffiliateProvider {
  readonly code = 'cj';
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
    // نطاق الريدايركت يختلف لكل معلن عند CJ (dpbolvw.net / jdoqocy.com / kqzyfj.com / ...)
    const redirectDomain = (config.cjRedirectDomain as string | undefined) ?? 'www.dpbolvw.net';
    const linkId = config.cjLinkId as string | undefined;
    const pid = config.cjPublisherId as string | undefined;
    if (!linkId || !pid) return link.destinationUrl;

    const params = new URLSearchParams({ url: link.destinationUrl, sid: clickId });
    return `https://${redirectDomain}/click-${pid}-${linkId}?${params.toString()}`;
  }

  normalizeTrackingParameters(config: Record<string, unknown>): TrackingParams {
    return {
      pid: String(config.cjPublisherId ?? ''),
      sid: config.clickIdParameter as string | undefined ?? 'sid',
    };
  }

  // شكل postback نموذجي عند CJ: SID (click id)، CID (commission/transaction id)، AMT، CURRENCY
  parseConversion(rawPayload: unknown): NormalizedConversion {
    const p = rawPayload as Record<string, unknown>;
    return {
      providerConversionId: String(p.CID ?? p.commissionId ?? ''),
      providerTransactionId: (p.CID as string) ?? null,
      saleAmount: Number(p.AMT ?? p.saleAmount ?? 0),
      commissionAmount: p.commission !== undefined ? Number(p.commission) : undefined,
      currency: (p.CURRENCY as string) ?? 'AED',
      conversionTime: (p.eventDate as string) ?? new Date().toISOString(),
      clickId: (p.SID as string) ?? null,
      providerClickId: (p.SID as string) ?? null,
      rawEventId: String(p.CID ?? ''),
    };
  }

  // CJ Commission Detail API (GraphQL) -- personal access token عبر credentials.api_key
  async fetchConversions(startDate: Date, endDate: Date, credentials: ProviderCredentials): Promise<NormalizedConversion[]> {
    if (!credentials.api_key || !credentials.publisher_id) return [];

    const query = `query { commissions(forCompanyId: "${credentials.publisher_id}", sinceCommissionCreationDate: "${startDate.toISOString()}", beforeCommissionCreationDate: "${endDate.toISOString()}") { records { id, saleAmountPubCurrency, commissionAmountPubCurrency, correctionReason, sid } } }`;

    const response = await fetch(CJ_COMMISSION_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${credentials.api_key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) throw new Error(`CJ API error: ${response.status}`);

    const json = (await response.json()) as { data?: { commissions?: { records?: unknown[] } } };
    const records = json.data?.commissions?.records ?? [];
    return records.map((row) => this.parseConversion(row));
  }

  async validateWebhook(): Promise<boolean> {
    return false;
  }

  async validatePostback(request: Request, credentials: ProviderCredentials): Promise<boolean> {
    const url = new URL(request.url);
    return url.searchParams.get('token') === credentials.postback_secret;
  }

  async acknowledgeWebhook(): Promise<AcknowledgementResponse> {
    return { status: 200 };
  }

  getIdempotencyKey(conversion: NormalizedConversion): string {
    return conversion.providerTransactionId ?? conversion.providerConversionId;
  }

  // اسم الحقل غير مؤكد على حساب CJ حقيقي بعد (سقالة، انظر ملاحظة الملف) --
  // CJ's postback عادة يرسل advertiserId أو companyId، يحتاج تأكيد من توثيق حقيقي.
  extractProgramKey(rawPayload: unknown): { configKey: string; value: string } | null {
    const p = rawPayload as Record<string, unknown>;
    const value = String(p.advertiserId ?? p.companyId ?? '');
    return value ? { configKey: 'cjAdvertiserId', value } : null;
  }
}
