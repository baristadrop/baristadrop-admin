import type { NormalizedConversion } from '../../types';
import type { ProviderCapabilities, AffiliateProvider } from '../interface';
import type { AcknowledgementResponse, AffiliateLink, ProviderCredentials, TrackingConfig, TrackingParams } from '../types';

/** المزوّد الفعلي الوحيد المستخدم حالياً -- تاجر بدون شبكة أفيليت وسيطة،
 * يرسل تأكيد الشراء مباشرة لـ /api/webhooks/affiliate-purchase (الموجود
 * أصلاً قبل هذا المشروع). هذا الأدابتر يطابق نفس المنطق تحت واجهة
 * AffiliateProvider الموحّدة، بدون أي استدعاء API خارجي. */
export class DirectMerchantProvider implements AffiliateProvider {
  readonly code = 'direct';
  readonly capabilities: ProviderCapabilities = {
    tracking: true,
    sub_id: false,
    postback: true,
    webhook: false,
    conversion_api: false,
    transaction_api: false,
    report_import: false,
    pixel: true,
    refund_events: false,
  };

  generateTrackingUrl(link: AffiliateLink, clickId: string, config: TrackingConfig): string {
    const url = new URL(link.destinationUrl);
    const clickIdParam = config.clickIdParameter ?? 'bd_click_id';
    url.searchParams.set(clickIdParam, clickId);
    return url.toString();
  }

  normalizeTrackingParameters(config: Record<string, unknown>): TrackingParams {
    const params: TrackingParams = {};
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string') params[key] = value;
    }
    return params;
  }

  // شكل الـ payload يطابق /api/webhooks/affiliate-purchase الموجود:
  // { click_id, order_amount, order_reference, currency }
  parseConversion(rawPayload: unknown): NormalizedConversion {
    const payload = rawPayload as Record<string, unknown>;
    const clickId = String(payload.click_id ?? '');
    return {
      providerConversionId: String(payload.order_reference ?? clickId),
      orderId: (payload.order_reference as string) ?? null,
      saleAmount: Number(payload.order_amount ?? 0),
      currency: (payload.currency as string) ?? 'AED',
      conversionTime: new Date().toISOString(),
      clickId: clickId || null,
      rawEventId: (payload.order_reference as string) ?? null,
    };
  }

  // ما فيه API سحب لهذا المزوّد -- التاجر المباشر يرسل لنا (postback)، ما
  // نسحب منه إحنا. مصفوفة فاضية بدل ما نرمي خطأ (توافقاً مع "لو فشل
  // المحول ما نوقف الكليك" لكن هنا فعلياً القدرة أصلاً مو مدعومة).
  async fetchConversions(): Promise<NormalizedConversion[]> {
    return [];
  }

  // ما فيه webhook حقيقي لتاجر مباشر (يستخدم postback العادي، يتحقق منه
  // resolveBusiness() بالراوت الموجود عبر postback_secret -- مو هذا الأدابتر).
  async validateWebhook(): Promise<boolean> {
    return false;
  }

  async validatePostback(request: Request, credentials: ProviderCredentials): Promise<boolean> {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    return Boolean(token) && token === credentials.postback_secret;
  }

  async acknowledgeWebhook(): Promise<AcknowledgementResponse> {
    return { status: 200 };
  }

  getIdempotencyKey(conversion: NormalizedConversion): string {
    return conversion.providerConversionId;
  }
}
