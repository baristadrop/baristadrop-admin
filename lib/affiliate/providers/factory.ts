import type { AffiliateProvider } from './interface';
import type { AffiliateProgram } from './types';
import { AwinProvider } from './awin/AwinProvider';
import { CJProvider } from './cj/CJProvider';
import { AmazonProvider } from './amazon/AmazonProvider';
import { DirectMerchantProvider } from './direct/DirectMerchantProvider';

// القاعدة #6/7 بالخطة: نقطة حل واحدة لأي مزوّد -- بدون هذي كل مكان بالكود
// كان بيحتاج `if (providerCode === 'awin') ... else if (...)` مبعثرة.
const REGISTRY: Record<string, new () => AffiliateProvider> = {
  awin: AwinProvider,
  cj: CJProvider,
  amazon: AmazonProvider,
  direct: DirectMerchantProvider,
};

export class ProviderFactory {
  // providerCode ما هو عمود على affiliate_programs نفسه -- يجي من صف
  // affiliate_provider_integrations النشط المربوط بالبرنامج (المستدعي
  // يجيبه أول ويمرره هنا، مثل: ProviderFactory.forProgram({ ...program, providerCode: integration.provider_code }))
  static forProgram(program: Pick<AffiliateProgram, 'configuration'> & { providerCode?: string | null }): AffiliateProvider {
    const code = program.providerCode ?? 'direct';
    const Ctor = REGISTRY[code];
    if (!Ctor) throw new Error(`Unknown affiliate provider: ${code}`);
    return new Ctor();
  }

  static forCode(code: string): AffiliateProvider {
    const Ctor = REGISTRY[code];
    if (!Ctor) throw new Error(`Unknown affiliate provider: ${code}`);
    return new Ctor();
  }

  static supportedCodes(): string[] {
    return Object.keys(REGISTRY);
  }
}
