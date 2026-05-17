import { createHmac } from 'crypto';
import { ShopeeProvider } from '../../application/providers/ShopeeProvider';

describe('ShopeeProvider', () => {
  const provider = new ShopeeProvider();
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  const config = {
    partnerId: '100001',
    partnerKey: 'secret-partner-key',
    accessToken: 'shopee-access-token',
    shopId: '200001',
  };

  function makeItemListResponse(itemIds: number[], hasNextPage = false) {
    return {
      ok: false,
      json: async () => ({
        response: {
          item: itemIds.map((id) => ({ item_id: id })),
          has_next_page: hasNextPage,
          next_offset: hasNextPage ? itemIds.length : 0,
        },
        error: '',
        message: '',
      }),
    };
  }

  function makeItemDetailResponse(
    items: Array<{ id: number; sku: string; stock: number; price: number }>,
  ) {
    return {
      ok: false,
      json: async () => ({
        response: {
          item_list: items.map((i) => ({
            item_id: i.id,
            item_sku: i.sku,
            stock_info: { normal_stock: i.stock },
            price_info: [{ current_price: i.price }],
          })),
        },
        error: '',
        message: '',
      }),
    };
  }

  // ─── testConnection ────────────────────────────────────────────────────────

  it('INV-T-067a: testConnection lança erro quando qualquer credencial ausente', async () => {
    await expect(
      provider.testConnection({
        partnerKey: 'k',
        accessToken: 't',
        shopId: 's',
      }),
    ).rejects.toThrow();
    await expect(
      provider.testConnection({
        partnerId: '1',
        accessToken: 't',
        shopId: 's',
      }),
    ).rejects.toThrow();
    await expect(
      provider.testConnection({ partnerId: '1', partnerKey: 'k', shopId: 's' }),
    ).rejects.toThrow();
    await expect(
      provider.testConnection({
        partnerId: '1',
        partnerKey: 'k',
        accessToken: 't',
      }),
    ).rejects.toThrow();
  });

  it('INV-T-067b: testConnection gera assinatura HMAC-SHA256 válida', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      json: async () => ({ error: '', message: '' }),
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;

    await provider.testConnection(config);

    const url = (fetchMock as jest.Mock).mock.calls[0][0] as string;
    const urlObj = new URL(url);
    const sign = urlObj.searchParams.get('sign');
    const timestamp = Number(urlObj.searchParams.get('timestamp'));
    const apiPath = '/api/v2/shop/get_shop_info';

    const expectedSign = createHmac('sha256', config.partnerKey)
      .update(
        `${config.partnerId}${apiPath}${timestamp}${config.accessToken}${config.shopId}`,
      )
      .digest('hex');

    expect(sign).toBe(expectedSign);
  });

  // ─── fetchStock ────────────────────────────────────────────────────────────

  it('INV-T-067c: fetchStock step 1 busca item list com offset pagination', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        makeItemListResponse([]),
      ) as unknown as typeof fetch;
    global.fetch = fetchMock;

    for await (const _ of provider.fetchStock(config)) {
    }

    const url = (fetchMock as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('/api/v2/product/get_item_list');
    expect(url).toContain('offset=0');
  });

  it('INV-T-067d: fetchStock step 2 busca detalhes via get_item_base_info', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(makeItemListResponse([123456]))
      .mockResolvedValueOnce(
        makeItemDetailResponse([
          { id: 123456, sku: 'SHOPEE-001', stock: 12, price: 79.9 },
        ]),
      ) as unknown as typeof fetch;
    global.fetch = fetchMock;

    for await (const _ of provider.fetchStock(config)) {
    }

    const detailUrl = (fetchMock as jest.Mock).mock.calls[1][0] as string;
    expect(detailUrl).toContain('/api/v2/product/get_item_base_info');
    expect(detailUrl).toContain('123456');
  });

  it('INV-T-067e: fetchStock mapeia item_sku, stock_info.normal_stock e price_info para snapshot', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(makeItemListResponse([123456]))
      .mockResolvedValueOnce(
        makeItemDetailResponse([
          { id: 123456, sku: 'SHOPEE-001', stock: 12, price: 79.9 },
        ]),
      ) as unknown as typeof fetch;

    const batches: any[][] = [];
    for await (const batch of provider.fetchStock(config)) {
      batches.push(batch);
    }

    expect(batches).toHaveLength(1);
    const item = batches[0][0];
    expect(item.sku).toBe('SHOPEE-001');
    expect(item.availableQuantity).toBe(12);
    expect(item.availabilityStatus).toBe('AVAILABLE');
  });

  it('INV-T-067f: assinatura é determinística — mesmos inputs geram mesmo sign', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      json: async () => ({ error: '', message: '' }),
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;

    await provider.testConnection(config);
    const url1 = new URL((fetchMock as jest.Mock).mock.calls[0][0] as string);
    const sign1 = url1.searchParams.get('sign');
    const ts1 = url1.searchParams.get('timestamp');

    const apiPath = '/api/v2/shop/get_shop_info';
    const expectedSign = createHmac('sha256', config.partnerKey)
      .update(
        `${config.partnerId}${apiPath}${ts1}${config.accessToken}${config.shopId}`,
      )
      .digest('hex');

    expect(sign1).toBe(expectedSign);
  });

  it('INV-T-067g: fetchStock para quando item list retorna array vazio', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(makeItemListResponse([])) as unknown as typeof fetch;

    const batches: unknown[] = [];
    for await (const batch of provider.fetchStock(config)) {
      batches.push(batch);
    }

    expect(batches).toHaveLength(0);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
