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

@Injectable()
export class InventoryProviderFactory implements IInventoryProviderFactory {
  getProvider(sourceType: string): IInventoryProvider {
    switch (sourceType) {
      case 'ERP_SYNC':
      case 'BLING':
        return new BlingProvider();
      case 'TINY':
        return new TinyProvider();
      case 'ECOMMERCE_SYNC':
      case 'SHOPIFY':
        return new ShopifyProvider();
      case 'WOOCOMMERCE':
        return new WooCommerceProvider();
      case 'NUVEMSHOP':
        return new NuvemshopProvider();
      case 'MERCADOLIVRE':
        return new MercadoLivreProvider();
      case 'SHOPEE':
        return new ShopeeProvider();
      default:
        throw new Error(
          `Nenhum provedor implementado para sourceType: ${sourceType}`,
        );
    }
  }
}
