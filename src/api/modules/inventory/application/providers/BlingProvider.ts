import {
  IInventoryProvider,
  InventoryItemSnapshot,
} from '../ports/IInventoryProvider';
import { providerFetch } from './provider-http';

export class BlingProvider implements IInventoryProvider {
  async testConnection(config: Record<string, unknown>): Promise<boolean> {
    const { accessToken } = config;
    if (!accessToken) {
      throw new Error('A conexão com o Bling requer um accessToken (OAuth2).');
    }

    const response = await providerFetch(
      'BLING',
      'https://api.bling.com.br/Api/v3/usuarios/me',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Falha de autenticação no Bling: Erro HTTP ${response.status}`,
      );
    }

    return true;
  }

  async *fetchStock(
    config: Record<string, unknown>,
  ): AsyncGenerator<InventoryItemSnapshot[]> {
    const { accessToken } = config;
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    let page = 1;
    let hasMoreData = true;

    while (hasMoreData) {
      const response = await providerFetch(
        'BLING',
        `https://api.bling.com.br/Api/v3/produtos?pagina=${page}&limite=100`,
        { method: 'GET', headers },
      );

      if (!response.ok) {
        throw new Error(
          `Erro buscando produtos no Bling: Erro HTTP ${response.status}`,
        );
      }

      const { data } = await response.json();
      if (!data || data.length === 0) {
        hasMoreData = false;
        break;
      }

      const snapshots: InventoryItemSnapshot[] = [];
      for (const item of data) {
        if (item.codigo) {
          const qty = Number(item.estoque?.saldoVirtual || 0);
          snapshots.push({
            sku: item.codigo,
            externalReference: String(item.id),
            name: item.nome,
            availableQuantity: qty,
            availabilityStatus: qty > 0 ? 'AVAILABLE' : 'UNAVAILABLE',
            currentPrice: String(item.preço || 0),
            currency: 'BRL',
          });
        }
      }

      if (snapshots.length > 0) {
        yield snapshots;
      }

      if (data.length < 100) {
        hasMoreData = false;
      } else {
        page++;
      }
    }
  }
}
