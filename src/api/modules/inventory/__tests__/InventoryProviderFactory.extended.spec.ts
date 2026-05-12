import { InventoryProviderFactory } from '../application/providers/InventoryProviderFactory';
import { BlingProvider } from '../application/providers/BlingProvider';
import { TinyProvider } from '../application/providers/TinyProvider';
import { ShopifyProvider } from '../application/providers/ShopifyProvider';
import { WooCommerceProvider } from '../application/providers/WooCommerceProvider';
import { NuvemshopProvider } from '../application/providers/NuvemshopProvider';
import { MercadoLivreProvider } from '../application/providers/MercadoLivreProvider';
import { ShopeeProvider } from '../application/providers/ShopeeProvider';

describe('InventoryProviderFactory (extended)', () => {
  const factory = new InventoryProviderFactory();

  it('should create BlingProvider for BLING type', () => {
    const provider = factory.getProvider('BLING');
    expect(provider).toBeInstanceOf(BlingProvider);
  });

  it('should create TinyProvider for TINY type', () => {
    const provider = factory.getProvider('TINY');
    expect(provider).toBeInstanceOf(TinyProvider);
  });

  it('should handle aliases: ERP_SYNC returns BlingProvider, ECOMMERCE_SYNC returns ShopifyProvider', () => {
    const erpProvider = factory.getProvider('ERP_SYNC');
    expect(erpProvider).toBeInstanceOf(BlingProvider);

    const ecommerceProvider = factory.getProvider('ECOMMERCE_SYNC');
    expect(ecommerceProvider).toBeInstanceOf(ShopifyProvider);
  });

  it('should throw error for unknown provider type', () => {
    expect(() => factory.getProvider('UNKNOWN_PROVIDER')).toThrow(
      /Nenhum provedor implementado para sourceType: UNKNOWN_PROVIDER/,
    );
  });

  it('should create correct providers for all supported types', () => {
    expect(factory.getProvider('SHOPIFY')).toBeInstanceOf(ShopifyProvider);
    expect(factory.getProvider('WOOCOMMERCE')).toBeInstanceOf(WooCommerceProvider);
    expect(factory.getProvider('NUVEMSHOP')).toBeInstanceOf(NuvemshopProvider);
    expect(factory.getProvider('MERCADOLIVRE')).toBeInstanceOf(MercadoLivreProvider);
    expect(factory.getProvider('SHOPEE')).toBeInstanceOf(ShopeeProvider);
  });
});
