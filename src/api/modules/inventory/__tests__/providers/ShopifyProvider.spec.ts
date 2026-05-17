import { ShopifyProvider } from '../../application/providers/ShopifyProvider';

describe('ShopifyProvider', () => {
  const provider = new ShopifyProvider();
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  const config = {
    shopUrl: 'https://minha-loja.myshopify.com',
    accessToken: 'shpat_token',
  };

  function makeShopifyResponse(products: unknown[], nextCursor?: string) {
    return {
      ok: true,
      json: async () => ({ products }),
      headers: {
        get: (name: string) => {
          if (name === 'link' && nextCursor) {
            return `<https://minha-loja.myshopify.com/admin/api/2024-01/products.json?page_info=${nextCursor}>; rel="next"`;
          }
          return null;
        },
      },
    };
  }

  // ─── testConnection ────────────────────────────────────────────────────────

  it('INV-T-064a: testConnection lança erro quando shopUrl ou accessToken ausente', async () => {
    await expect(
      provider.testConnection({ accessToken: 'tok' }),
    ).rejects.toThrow(/shopUrl|credenciais/i);
    await expect(
      provider.testConnection({ shopUrl: 'https://x.myshopify.com' }),
    ).rejects.toThrow(/accessToken|credenciais/i);
  });

  it('INV-T-064b: testConnection usa header X-Shopify-Access-Token', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ shop: { id: 1 } }),
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;

    await provider.testConnection(config);

    const headers = (fetchMock as jest.Mock).mock.calls[0][1].headers;
    expect(headers['X-Shopify-Access-Token']).toBe('shpat_token');
  });

  it('INV-T-064c: testConnection chama /admin/api/2024-01/shop.json', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ shop: { id: 1 } }),
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;

    await provider.testConnection(config);

    expect((fetchMock as jest.Mock).mock.calls[0][0]).toContain(
      '/admin/api/2024-01/shop.json',
    );
  });

  // ─── fetchStock ────────────────────────────────────────────────────────────

  it('INV-T-064d: fetchStock usa paginação por cursor via Link header', async () => {
    const page1Product = {
      id: 1,
      title: 'Produto A',
      variants: [
        {
          sku: 'SH-001',
          title: 'Padrão',
          inventory_quantity: 5,
          price: '99.90',
        },
      ],
    };
    const page2Product = {
      id: 2,
      title: 'Produto B',
      variants: [
        {
          sku: 'SH-002',
          title: 'Padrão',
          inventory_quantity: 2,
          price: '49.90',
        },
      ],
    };

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(makeShopifyResponse([page1Product], 'cursor-abc'))
      .mockResolvedValueOnce(
        makeShopifyResponse([page2Product]),
      ) as unknown as typeof fetch;
    global.fetch = fetchMock;

    const batches: any[][] = [];
    for await (const batch of provider.fetchStock(config)) {
      batches.push(batch);
    }

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(batches).toHaveLength(2);

    const secondUrl = (fetchMock as jest.Mock).mock.calls[1][0] as string;
    expect(secondUrl).toContain('page_info=cursor-abc');
  });

  it('INV-T-064e: fetchStock mapeia variants para InventoryItemSnapshot', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeShopifyResponse([
        {
          id: 1,
          title: 'Camiseta Azul',
          variants: [
            {
              sku: 'CAM-AZL-M',
              title: 'M',
              inventory_quantity: 15,
              price: '89.90',
            },
          ],
        },
      ]),
    ) as unknown as typeof fetch;

    const batches: any[][] = [];
    for await (const batch of provider.fetchStock(config)) {
      batches.push(batch);
    }

    expect(batches).toHaveLength(1);
    const item = batches[0][0];
    expect(item.sku).toBe('CAM-AZL-M');
    expect(item.name).toBe('Camiseta Azul - M');
    expect(item.availableQuantity).toBe(15);
    expect(item.currentPrice).toBe('89.90');
  });

  it('INV-T-064f: fetchStock para quando products está vazio e sem link next', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(makeShopifyResponse([])) as unknown as typeof fetch;

    const batches: unknown[] = [];
    for await (const batch of provider.fetchStock(config)) {
      batches.push(batch);
    }

    expect(batches).toHaveLength(0);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
