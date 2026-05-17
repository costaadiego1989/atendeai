import {
  IInventoryProvider,
  InventoryItemSnapshot,
} from '../ports/IInventoryProvider';

export class MercadoLivreProvider implements IInventoryProvider {
  async testConnection(config: Record<string, unknown>): Promise<boolean> {
    const { userId, accessToken } = config;
    if (!userId || !accessToken) {
      throw new Error(
        'A conexão Mercado Livre requer userId e accessToken (OAuth2).',
      );
    }

    const response = await fetch(
      `https://api.mercadolibre.com/users/${userId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Falha Mercado Livre: Status HTTP ${response.status}`);
    }

    return true;
  }

  async *fetchStock(
    config: Record<string, unknown>,
  ): AsyncGenerator<InventoryItemSnapshot[]> {
    const { userId, accessToken } = config;
    const headers = { Authorization: `Bearer ${accessToken}` };

    let offset = 0;
    const limit = 50;
    let hasMoreData = true;

    while (hasMoreData) {
      const searchRes = await fetch(
        `https://api.mercadolibre.com/users/${userId}/items/search?offset=${offset}&limit=${limit}`,
        { method: 'GET', headers },
      );

      if (!searchRes.ok) {
        throw new Error(
          `Erro buscando ids no Mercado Livre: ${searchRes.statusText}`,
        );
      }

      const searchJson = await searchRes.json();
      const itemIds: string[] = searchJson.results || [];

      if (itemIds.length === 0) {
        hasMoreData = false;
        break;
      }

      const idsParam = itemIds.join(',');
      const detailRes = await fetch(
        `https://api.mercadolibre.com/items?ids=${idsParam}&attributes=id,title,available_quantity,price,currency_id,seller_custom_field`,
        { method: 'GET', headers },
      );

      if (!detailRes.ok) {
        throw new Error(`Erro buscando detalhes no Mercado Livre`);
      }

      const detailJson = await detailRes.json();
      const snapshots: InventoryItemSnapshot[] = [];

      for (const res of detailJson) {
        if (res.code === 200 && res.body) {
          const item = res.body;
          const sku = item.seller_custom_field || item.id; // Usually users put SKU in seller_custom_field (SKU ML)
          const qty = Number(item.available_quantity || 0);

          snapshots.push({
            sku: sku,
            externalReference: String(item.id),
            name: item.title,
            availableQuantity: qty,
            availabilityStatus: qty > 0 ? 'AVAILABLE' : 'UNAVAILABLE',
            currentPrice: String(item.price || 0),
            currency: item.currency_id || 'BRL',
          });
        }
      }

      if (snapshots.length > 0) {
        yield snapshots;
      }

      offset += limit;
      if (offset >= (searchJson.paging?.total || 0)) {
        hasMoreData = false;
      }
    }
  }
}
