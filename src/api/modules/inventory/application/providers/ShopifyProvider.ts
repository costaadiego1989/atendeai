import {
  IInventoryProvider,
  InventoryItemSnapshot,
} from '../ports/IInventoryProvider';

export class ShopifyProvider implements IInventoryProvider {
  async testConnection(config: Record<string, unknown>): Promise<boolean> {
    const { shopUrl, accessToken } = config;
    if (!shopUrl || !accessToken) {
      throw new Error('As credenciais do Shopify exigem shopUrl e accessToken.');
    }

    const domain = String(shopUrl).replace(/\/$/, '');
    const response = await fetch(`${domain}/admin/api/2024-01/shop.json`, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': String(accessToken),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Falha ao conectar no Shopify: ${response.statusText}`);
    }

    return true;
  }

  async *fetchStock(
    config: Record<string, unknown>,
  ): AsyncGenerator<InventoryItemSnapshot[]> {
    const { shopUrl, accessToken } = config;
    const domain = String(shopUrl).replace(/\/$/, '');
    const headers = {
      'X-Shopify-Access-Token': String(accessToken),
      'Content-Type': 'application/json',
    };

    let url: string | null = `${domain}/admin/api/2024-01/products.json?limit=50`;

    while (url) {
      const response: Response = await fetch(url, { method: 'GET', headers });
      if (!response.ok) {
        throw new Error(`Erro buscando produtos no Shopify: ${response.statusText}`);
      }

      const data = await response.json();
      const products: any[] = data.products || [];

      const snapshots: InventoryItemSnapshot[] = [];
      for (const product of products) {
        for (const variant of product.variants) {
          if (variant.sku) {
            snapshots.push({
              sku: variant.sku,
              externalReference: String(variant.id),
              name: `${product.title} - ${variant.title}`,
              availableQuantity: Number(variant.inventory_quantity || 0),
              availabilityStatus:
                Number(variant.inventory_quantity || 0) > 0
                  ? 'AVAILABLE'
                  : 'UNAVAILABLE',
              currentPrice: variant.price,
              currency: 'BRL',
            });
          }
        }
      }

      if (snapshots.length > 0) {
        yield snapshots;
      }

      // Check pagination links...
      const linkHeader: string | null = response.headers.get('link');
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const match: RegExpMatchArray | null = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        url = match ? match[1] : null;
      } else {
        url = null;
      }
    }
  }
}
