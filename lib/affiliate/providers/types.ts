export type AffiliateProgram = {
  id: string;
  name: string;
  merchantId: string;
  networkId: string | null;
  externalProgramId: string | null;
  affiliateAccountId: string | null;
  trackingMethod: 'redirect' | 'pixel' | 'coupon' | 'api_only';
  conversionMethod: 'postback' | 'webhook' | 'api' | 'csv' | 'pixel' | 'manual';
  currency: string;
  status: 'active' | 'paused' | 'expired' | 'archived';
  configuration: Record<string, unknown>;
};

export type AffiliateLink = {
  id: string;
  affiliateProgramId: string;
  productId: string | null;
  destinationUrl: string;
  trackingTemplate: string | null;
  token: string;
  status: 'active' | 'paused' | 'expired';
};

/** بيانات اعتماد مفكوكة التشفير -- خريطة credential_type -> القيمة، مبنية من
 * صفوف affiliate_provider_credentials (فك التشفير مسؤولية المستدعي، مو
 * الأدابتر -- الأدابتر ما يشوف encrypted_value الخام أبداً). */
export type ProviderCredentials = Record<string, string>;

export type TrackingConfig = {
  clickIdParameter?: string;
  sourceParameter?: string;
  campaignParameter?: string;
  redirectType?: 301 | 302;
  [key: string]: unknown;
};

export type TrackingParams = Record<string, string>;

export type AcknowledgementResponse = {
  status: number;
  body?: string;
};
