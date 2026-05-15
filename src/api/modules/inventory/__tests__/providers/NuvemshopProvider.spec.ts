import { NuvemshopProvider } from '../../application/providers/NuvemshopProvider';

describe('NuvemshopProvider', () => {
  const provider = new NuvemshopProvider();
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  const config = { storeId: '12345', accessToken: 'ns-token', userAgent: 'Test/1.0' };

  // ─── testConnection ────────────────────────────────────────────────────────

  it('INV-T-063a: testConnection lança erro quando storeId ou accessToken ausente', async () => {
    await expect(provider.testConnection({ accessToken: 'tok' })).rejects.toThrow(/storeId/);
    await expect(provider.testConnection({ storeId: '1' })).rejects.toThrow(/accessToken/);
  });

  it('INV-T-063b: testConnection usa header "Authentication: bearer {token}" (não Authorization)', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 12345 }),
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;

    await provider.testConnection(config);

    const headers = (fetchMock as jest.Mock).mock.calls[0][1].headers;
    expect(headers['Authentication']).toBe('bearer ns-token');
    expect(headers['Authorization']).toBeUndefined();
  });

  it('INV-T-063c: testConnection lança erro em resposta não OK', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      statusText: 'Unauthorized',
    }) as unknown as typeof fetch;

    await expect(provider.testConnection(config)).rejects.toThrow(/Autenticação falhou/i);
  });

  // ─── fetchStock ────────────────────────────────────────────────────────────

  it('INV-T-063d: fetchStock chama GET /v1/{storeId}/products?page=1&per_page=50', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;

    const gen = provider.fetchStock(config);
    await gen.next();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.nuvemshop.com.br/v1/12345/products?page=1&per_page=50',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('INV-T-063e: fetchStock mapeia variants para InventoryItemSnapshot', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 1,
          name: { pt: 'Produto NS Teste' },
          variants: [
            { id: 11, sku: 'NS-SKU-001', stock: 20, price: '49.90', values: ['Padrão'] },
          ],
        },
      ],
    }) as unknown as typeof fetch;

    const batches: any[][] = [];
    for await (const batch of provider.fetchStock(config)) {
      batches.push(batch);
    }

    expect(batches).toHaveLength(1);
    const item = batches[0][0];
    expect(item.sku).toBe('NS-SKU-001');
    expect(item.name).toBe('Produto NS Teste - Padrão');
    expect(item.availableQuantity).toBe(20);
    expect(item.availabilityStatus).toBe('AVAILABLE');
    expect(item.currentPrice).toBe('49.90');
  });

  it('INV-T-063f: fetchStock para quando array vazio retornado', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }) as unknown as typeof fetch;

    const batches: unknown[] = [];
    for await (const batch of provider.fetchStock(config)) {
      batches.push(batch);
    }

    expect(batches).toHaveLength(0);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
