import type { NormalizedConversion } from '../../types';
import type { ProviderCapabilities, AffiliateProvider } from '../interface';
import type { AcknowledgementResponse, AffiliateLink, TrackingConfig, TrackingParams } from '../types';

/** أمازون أسوشيتس (Amazon Associates) ما عنده API حقيقي وقت-حقيقي للتحويلات
 * لشركاء عاديين -- بس تقارير CSV تُصدَّر يدوياً من Associates Central. عشان
 * كذا conversion_api/transaction_api/postback/webhook كلها false هنا فعلياً
 * (مو نقص تنفيذ -- هذا واقع القدرات الحقيقي لهذا المزوّد). */
export class AmazonProvider implements AffiliateProvider {
  readonly code = 'amazon';
  readonly capabilities: ProviderCapabilities = {
    tracking: true,
    sub_id: true,
    postback: false,
    webhook: false,
    conversion_api: false,
    transaction_api: false,
    report_import: true,
    pixel: false,
    refund_events: false,
  };

  generateTrackingUrl(link: AffiliateLink, clickId: string, config: TrackingConfig): string {
    const associateTag = config.amazonAssociateTag as string | undefined;
    if (!associateTag) return link.destinationUrl;

    const url = new URL(link.destinationUrl);
    url.searchParams.set('tag', associateTag);
    // subid: أمازون تدعم ascsubtag/subid لبعض البرامج -- نضيفه لو مسموح بالإعداد
    const subIdParam = config.clickIdParameter as string | undefined;
    if (subIdParam) url.searchParams.set(subIdParam, clickId);
    return url.toString();
  }

  normalizeTrackingParameters(config: Record<string, unknown>): TrackingParams {
    return { tag: String(config.amazonAssociateTag ?? '') };
  }

  // صف من تقرير CSV المصدَّر يدوياً من Associates Central (Phase 5's report import)
  parseConversion(rawPayload: unknown): NormalizedConversion {
    const p = rawPayload as Record<string, unknown>;
    return {
      providerConversionId: String(p['Order ID'] ?? p.orderId ?? ''),
      orderId: (p['Order ID'] as string) ?? null,
      saleAmount: Number(p['Item Price'] ?? p.itemPrice ?? 0),
      commissionAmount: p['Ad Fees'] !== undefined ? Number(p['Ad Fees']) : undefined,
      currency: (p.Currency as string) ?? 'AED',
      conversionTime: (p['Order Date'] as string) ?? new Date().toISOString(),
      clickId: (p['Tracking ID'] as string) ?? null,
      rawEventId: String(p['Order ID'] ?? ''),
    };
  }

  async fetchConversions(): Promise<NormalizedConversion[]> {
    throw new Error('AmazonProvider does not support live conversion fetch -- use report_import (CSV export from Associates Central) instead');
  }

  async validateWebhook(): Promise<boolean> {
    return false;
  }

  async validatePostback(): Promise<boolean> {
    return false;
  }

  async acknowledgeWebhook(): Promise<AcknowledgementResponse> {
    return { status: 404, body: 'not supported' };
  }

  getIdempotencyKey(conversion: NormalizedConversion): string {
    return conversion.orderId ?? conversion.providerConversionId;
  }
}
