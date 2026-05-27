import { Injectable } from '@nestjs/common';
import {
  IInventoryProvider,
  IInventoryProviderFactory,
} from '../ports/IInventoryProvider';
import { BlingProvider } from './BlingProvider';
import { TinyProvider } from './TinyProvider';
import { ShopifyProvider } from './ShopifyProvider';
import { WooCommerceProvider } from './WooCommerceProvider';
import { NuvemshopProvider } from './NuvemshopProvider';
import { MercadoLivreProvider } from './MercadoLivreProvider';
import { ShopeeProvider } from './ShopeeProvider';
import { InventoryProviderNotSupportedError } from '../../domain/errors/InventoryProviderNotSupportedError';

const LEGACY_SOURCE_TYPE_ALIASES: Record<string, string> = {
  ERP_SYNC: 'BLING',
  ECOMMERCE_SYNC: 'SHOPIFY',
};

@Injectable()
export class InventoryProviderFactory implements IInventoryProviderFactory {
  private readonly providers: Record<string, () => IInventoryProvider> = {
    BLING: () => new BlingProvider(),
    TINY: () => new TinyProvider(),
    SHOPIFY: () => new ShopifyProvider(),
    WOOCOMMERCE: () => new WooCommerceProvider(),
    NUVEMSHOP: () => new NuvemshopProvider(),
    MERCADOLIVRE: () => new MercadoLivreProvider(),
    SHOPEE: () => new ShopeeProvider(),
  };

  getProvider(sourceType: string): IInventoryProvider {
    const resolvedType = LEGACY_SOURCE_TYPE_ALIASES[sourceType] ?? sourceType;
    const factory = this.providers[resolvedType];

    if (!factory) {
      throw new InventoryProviderNotSupportedError(sourceType);
    }

    return factory();
  }
}
