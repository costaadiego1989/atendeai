import {
  IInventoryProvider,
  InventoryItemSnapshot,
} from '../ports/IInventoryProvider';
import { providerFetch } from './provider-http';

export class TinyProvider implements IInventoryProvider {
  async testConnection(config: Record<string, unknown>): Promise<boolean> {
    const { token } = config;
    if (!token) {
      throw new Error('A conexão com o Tiny requer um Token de API.');
    }

    const response = await providerFetch(
      'TINY',
      'https://api.tiny.com.br/api2/info.php',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: String(token), formato: 'JSON' }),
      },
    );

    const data = await response.json();
    if (data.retorno?.status === 'Erro') {
      throw new Error(
        `Falha na autenticação do Tiny: ${data.retorno.codigo_erro}`,
      );
    }

    return true;
  }

  async *fetchStock(
    config: Record<string, unknown>,
  ): AsyncGenerator<InventoryItemSnapshot[]> {
    const { token } = config;
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const response = await providerFetch(
        'TINY',
        'https://api.tiny.com.br/api2/produtos.pesquisa.php',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            token: String(token),
            formato: 'JSON',
            pagina: String(page),
          }),
        },
      );

      const json = await response.json();
      if (json.retorno?.status === 'Erro') {
        throw new Error(`Erro na API Tiny: ${json.retorno.codigo_erro}`);
      }

      totalPages = Number(json.retorno.número_paginas || 1);

      const produtos = json.retorno.produtos || [];
      const snapshots: InventoryItemSnapshot[] = [];
      for (const wrapper of produtos) {
        const item = wrapper.produto;
        if (item.codigo) {
          const qty = Number(item.saldo_estoque || 0);
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
      page++;
    }
  }
}
