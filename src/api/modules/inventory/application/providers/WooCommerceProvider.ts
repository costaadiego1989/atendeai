import {
  IInventoryProvider,
  InventoryItemSnapshot,
} from '../ports/IInventoryProvider';
import { providerFetch } from './provider-http';

export class WooCommerceProvider implements IInventoryProvider {
  async testConnection(config: Record<string, unknown>): Promise<boolean> {
    const { storeUrl, consumerKey, consumerSecret } = config;
    if (!storeUrl || !consumerKey || !consumerSecret) {
      throw new Error(
        'A conexão WooCommerce requer storeUrl, consumerKey e consumerSecret.',
      );
    }

    const domain = String(storeUrl).replace(/\/$/, '');
    const authHeader = `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`;
    const response = await providerFetch(
      'WOOCOMMERCE',
      `${domain}/wp-json/wc/v3/system_status`,
      {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `WooCommerce Autenticação falhou: ${response.statusText}`,
      );
    }

    return true;
  }

  async *fetchStock(
    config: Record<string, unknown>,
  ): AsyncGenerator<InventoryItemSnapshot[]> {
    const { storeUrl, consumerKey, consumerSecret } = config;
    const domain = String(storeUrl).replace(/\/$/, '');
    const authHeader = `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`;
    const headers = {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    };

    let page = 1;
    let hasMoreData = true;

    while (hasMoreData) {
      const response = await providerFetch(
        'WOOCOMMERCE',
        `${domain}/wp-json/wc/v3/products?page=${page}&per_page=50`,
        { method: 'GET', headers },
      );

      if (!response.ok) {
        throw new Error(
          `Erro buscando produtos no WooCommerce: ${response.statusText}`,
        );
      }

      const products = await response.json();
      if (!products || products.length === 0) {
        hasMoreData = false;
        break;
      }

      const snapshots: InventoryItemSnapshot[] = [];

      for (const product of products) {
        if (product.type === 'simple' && product.sku) {
          const qty = Number(product.stock_quantity || 0);
          snapshots.push({
            sku: product.sku,
            externalReference: String(product.id),
            name: product.name,
            availableQuantity: qty,
            availabilityStatus: qty > 0 ? 'AVAILABLE' : 'UNAVAILABLE',
            currentPrice: String(product.price || 0),
            currency: 'BRL',
          });
        }
      }

      if (snapshots.length > 0) {
        yield snapshots;
      }

      const totalPages = Number(response.headers.get('X-WP-TotalPages') || 1);
      if (page >= totalPages) {
        hasMoreData = false;
      } else {
        page++;
      }
    }
  }
}
