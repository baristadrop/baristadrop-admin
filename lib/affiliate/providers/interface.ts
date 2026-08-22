import type { NormalizedConversion } from '../types';
import type { AcknowledgementResponse, AffiliateLink, ProviderCredentials, TrackingConfig, TrackingParams } from './types';

export type ProviderCapabilities = {
  tracking: boolean;
  sub_id: boolean;
  postback: boolean;
  webhook: boolean;
  conversion_api: boolean;
  transaction_api: boolean;
  report_import: boolean;
  pixel: boolean;
  refund_events: boolean;
};

/** كل منطق خاص بمزوّد معيّن يُعزَل هنا -- ممنوع أي `if provider === 'awin'`
 * متفرقة ببقية الكودبيس (القاعدة #6/7 بالخطة). أي كود يتعامل مع مزوّد
 * يمر عبر ProviderFactory.forProgram() ثم هذا الـ interface فقط. */
export interface AffiliateProvider {
  readonly code: string;
  readonly capabilities: ProviderCapabilities;

  // Tracking
  generateTrackingUrl(link: AffiliateLink, clickId: string, config: TrackingConfig): string;
  normalizeTrackingParameters(config: Record<string, unknown>): TrackingParams;

  // Conversions
  parseConversion(rawPayload: unknown): NormalizedConversion;
  fetchConversions(startDate: Date, endDate: Date, credentials: ProviderCredentials): Promise<NormalizedConversion[]>;

  // Webhooks
  validateWebhook(request: Request, credentials: ProviderCredentials): Promise<boolean>;
  validatePostback(request: Request, credentials: ProviderCredentials): Promise<boolean>;
  acknowledgeWebhook(request: Request): Promise<AcknowledgementResponse>;

  // Identity strategy -- يحدد كيف نمنع تحويلات مكررة لهذا المزوّد تحديداً
  getIdempotencyKey(conversion: NormalizedConversion): string;

  // يحدد هوية البرنامج من الـ payload (مثلاً merchant id) عشان نطابقه مع
  // affiliate_provider_integrations.configuration -- يرجع null لو المزوّد
  // ما يرسل معرّفاً (عندها نستخدم التكامل الوحيد النشط لهذا المزوّد)
  extractProgramKey(rawPayload: unknown): { configKey: string; value: string } | null;
}
