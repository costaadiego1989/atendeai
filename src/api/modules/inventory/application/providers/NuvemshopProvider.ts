import {
  IInventoryProvider,
  InventoryItemSnapshot,
} from '../ports/IInventoryProvider';

export class NuvemshopProvider implements IInventoryProvider {
  async testConnection(config: Record<string, unknown>): Promise<boolean> {
    const { storeId, accessToken, userAgent } = config;
    if (!storeId || !accessToken) {
      throw new Error('A conexão Nuvemshop requer storeId e accessToken.');
    }

    const domain = `https://api.nuvemshop.com.br/v1/${storeId}`;
    const response = await fetch(`${domain}/store`, {
      method: 'GET',
      headers: {
        Authentication: `bearer ${accessToken}`,
        'User-Agent': String(userAgent || 'AtendeAi-InventorySync'),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Nuvemshop Autenticação falhou: ${response.statusText}`);
    }

    return true;
  }

  async *fetchStock(
    config: Record<string, unknown>,
  ): AsyncGenerator<InventoryItemSnapshot[]> {
    const { storeId, accessToken, userAgent } = config;
    const domain = `https://api.nuvemshop.com.br/v1/${storeId}`;
    const headers = {
      Authentication: `bearer ${accessToken}`,
      'User-Agent': String(userAgent || 'AtendeAi-InventorySync'),
      'Content-Type': 'application/json',
    };

    let page = 1;
    let hasMoreData = true;

    while (hasMoreData) {
      const response = await fetch(
        `${domain}/products?page=${page}&per_page=50`,
        {
          method: 'GET',
          headers,
        },
      );

      if (!response.ok) {
        throw new Error(
          `Falha ao buscar produtos Nuvemshop: ${response.status}`,
        );
      }

      const products = await response.json();
      if (!products || products.length === 0) {
        hasMoreData = false;
        break;
      }

      const snapshots: InventoryItemSnapshot[] = [];

      for (const product of products) {
        for (const variant of product.variants) {
          if (variant.sku) {
            const qty = Number(variant.stock || 0);
            snapshots.push({
              sku: variant.sku,
              externalReference: String(variant.id),
              name: `${product.name?.pt || product.name} - ${variant.values.join('/')}`,
              availableQuantity: qty,
              availabilityStatus: qty > 0 ? 'AVAILABLE' : 'UNAVAILABLE',
              currentPrice: String(variant.price || 0),
              currency: 'BRL',
            });
          }
        }
      }

      if (snapshots.length > 0) {
        yield snapshots;
      }

      page++;
    }
  }
}
