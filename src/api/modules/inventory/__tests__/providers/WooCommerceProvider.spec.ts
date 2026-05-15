import { WooCommerceProvider } from '../../application/providers/WooCommerceProvider';

describe('WooCommerceProvider', () => {
  const provider = new WooCommerceProvider();
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  const config = {
    storeUrl: 'https://minha-loja.com.br',
    consumerKey: 'ck_abc123',
    consumerSecret: 'cs_xyz789',
  };

  const expectedAuth = `Basic ${Buffer.from('ck_abc123:cs_xyz789').toString('base64')}`;

  function makeWooPage(products: unknown[], totalPages = 1) {
    return {
      ok: true,
      json: async () => products,
      headers: {
        get: (name: string) => (name === 'X-WP-TotalPages' ? String(totalPages) : null),
      },
    };
  }

  // ─── testConnection ────────────────────────────────────────────────────────

  it('INV-T-065a: testConnection lança erro quando storeUrl, consumerKey ou consumerSecret ausente', async () => {
    await expect(provider.testConnection({ consumerKey: 'k', consumerSecret: 's' })).rejects.toThrow();
    await expect(provider.testConnection({ storeUrl: 'https://x.com', consumerSecret: 's' })).rejects.toThrow();
    await expect(provider.testConnection({ storeUrl: 'https://x.com', consumerKey: 'k' })).rejects.toThrow();
  });

  it('INV-T-065b: testConnection usa Basic Auth com base64(consumerKey:consumerSecret)', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;

    await provider.testConnection(config);

    const headers = (fetchMock as jest.Mock).mock.calls[0][1].headers;
    expect(headers['Authorization']).toBe(expectedAuth);
  });

  // ─── fetchStock ────────────────────────────────────────────────────────────

  it('INV-T-065c: fetchStock chama GET /wp-json/wc/v3/products com per_page e page', async () => {
    const fetchMock = jest.fn().mockResolvedValue(makeWooPage([])) as unknown as typeof fetch;
    global.fetch = fetchMock;

    const gen = provider.fetchStock(config);
    await gen.next();

    const url = (fetchMock as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('/wp-json/wc/v3/products');
    expect(url).toContain('page=1');
  });

  it('INV-T-065d: fetchStock mapeia produto WooCommerce para InventoryItemSnapshot', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeWooPage([{ id: 1, type: 'simple', sku: 'WOO-001', name: 'Produto WC', stock_quantity: 8, price: '35.00', regular_price: '35.00' }]),
    ) as unknown as typeof fetch;

    const batches: any[][] = [];
    for await (const batch of provider.fetchStock(config)) {
      batches.push(batch);
    }

    expect(batches).toHaveLength(1);
    const item = batches[0][0];
    expect(item.sku).toBe('WOO-001');
    expect(item.name).toBe('Produto WC');
    expect(item.availableQuantity).toBe(8);
    expect(item.availabilityStatus).toBe('AVAILABLE');
  });

  it('INV-T-065e: fetchStock pagina usando X-WP-TotalPages header', async () => {
    const product1 = { id: 1, type: 'simple', sku: 'W1', name: 'P1', stock_quantity: 5, price: '10.00' };
    const product2 = { id: 2, type: 'simple', sku: 'W2', name: 'P2', stock_quantity: 3, price: '20.00' };

    const fetchMock = jest.fn()
      .mockResolvedValueOnce(makeWooPage([product1], 2))
      .mockResolvedValueOnce(makeWooPage([product2], 2)) as unknown as typeof fetch;
    global.fetch = fetchMock;

    const batches: unknown[] = [];
    for await (const batch of provider.fetchStock(config)) {
      batches.push(batch);
    }

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(batches).toHaveLength(2);
  });
});
