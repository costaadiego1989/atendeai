export const PROVIDER_SECRET_KEYS: Record<string, string[]> = {
  BLING: ['accessToken', 'refreshToken', 'clientSecret'],
  TINY: ['token', 'apiKey'],
  SHOPIFY: ['accessToken', 'apiKey', 'apiSecret'],
  WOOCOMMERCE: ['consumerKey', 'consumerSecret'],
  NUVEMSHOP: ['accessToken'],
  MERCADOLIVRE: ['accessToken', 'refreshToken', 'clientSecret'],
  SHOPEE: ['accessToken', 'refreshToken', 'shopId'],
  // ERP_SYNC and ECOMMERCE_SYNC legacy fallback — use BLING and SHOPIFY keys
  ERP_SYNC: ['accessToken', 'refreshToken', 'clientSecret'],
  ECOMMERCE_SYNC: ['accessToken', 'apiKey', 'apiSecret'],
};

export function getProviderSecretKeys(sourceType: string): string[] {
  return PROVIDER_SECRET_KEYS[sourceType] ?? [];
}
