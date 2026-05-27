import { createHmac } from 'crypto';
import {
  IInventoryProvider,
  InventoryItemSnapshot,
} from '../ports/IInventoryProvider';
import { providerFetch } from './provider-http';

export class ShopeeProvider implements IInventoryProvider {
  private generateSignature(
    partnerId: string,
    partnerKey: string,
    apiPath: string,
    timestamp: number,
    accessToken: string,
    shopId: string,
  ) {
    const baseString = `${partnerId}${apiPath}${timestamp}${accessToken}${shopId}`;
    return createHmac('sha256', partnerKey).update(baseString).digest('hex');
  }

  async testConnection(config: Record<string, unknown>): Promise<boolean> {
    const { partnerId, partnerKey, shopId, accessToken } = config;
    if (!partnerId || !partnerKey || !shopId || !accessToken) {
      throw new Error(
        'A conexão Shopee requer partnerId, partnerKey, shopId e accessToken.',
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const apiPath = '/api/v2/shop/get_shop_info';
    const sign = this.generateSignature(
      String(partnerId),
      String(partnerKey),
      apiPath,
      timestamp,
      String(accessToken),
      String(shopId),
    );

    const url = `https://partner.shopeemobile.com${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${shopId}&sign=${sign}`;

    const response = await providerFetch('SHOPEE', url, { method: 'GET' });
    const data = await response.json();

    if (data.error) {
      throw new Error(
        `Falha na autenticação Shopee: ${data.message || data.error}`,
      );
    }

    return true;
  }

  async *fetchStock(
    config: Record<string, unknown>,
  ): AsyncGenerator<InventoryItemSnapshot[]> {
    const { partnerId, partnerKey, shopId, accessToken } = config;

    let offset = 0;
    const pageSize = 50;
    let hasMoreData = true;

    while (hasMoreData) {
      const timestamp = Math.floor(Date.now() / 1000);
      const apiPath = '/api/v2/product/get_item_list';
      const sign = this.generateSignature(
        String(partnerId),
        String(partnerKey),
        apiPath,
        timestamp,
        String(accessToken),
        String(shopId),
      );

      const url = `https://partner.shopeemobile.com${apiPath}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${shopId}&sign=${sign}&offset=${offset}&page_size=${pageSize}&item_status=NORMAL`;

      const response = await providerFetch('SHOPEE', url, { method: 'GET' });
      const data = await response.json();

      if (data.error) {
        throw new Error(`Erro na API Shopee: ${data.message || data.error}`);
      }

      const items = data.response?.item || [];
      if (items.length === 0) {
        hasMoreData = false;
        break;
      }

      const itemIds = items.map((i: any) => i.item_id).join(',');
      const infoPath = '/api/v2/product/get_item_base_info';
      const infoTimestamp = Math.floor(Date.now() / 1000);
      const infoSign = this.generateSignature(
        String(partnerId),
        String(partnerKey),
        infoPath,
        infoTimestamp,
        String(accessToken),
        String(shopId),
      );

      const infoUrl = `https://partner.shopeemobile.com${infoPath}?partner_id=${partnerId}&timestamp=${infoTimestamp}&access_token=${accessToken}&shop_id=${shopId}&sign=${infoSign}&item_id_list=${itemIds}`;
      const infoResponse = await providerFetch('SHOPEE', infoUrl, {
        method: 'GET',
      });
      const infoData = await infoResponse.json();
      const snapshots: InventoryItemSnapshot[] = [];
      const detailedItems = infoData.response?.item_list || [];

      for (const item of detailedItems) {
        if (item.item_sku) {
          const qty = Number(item.stock_info?.normal_stock || 0);
          snapshots.push({
            sku: item.item_sku,
            externalReference: String(item.item_id),
            name: item.item_name,
            availableQuantity: qty,
            availabilityStatus: qty > 0 ? 'AVAILABLE' : 'UNAVAILABLE',
            currentPrice: undefined,
            currency: 'BRL',
          });
        }
      }

      if (snapshots.length > 0) {
        yield snapshots;
      }

      if (!data.response?.has_next_page) {
        hasMoreData = false;
      } else {
        offset += pageSize;
      }
    }
  }
}
