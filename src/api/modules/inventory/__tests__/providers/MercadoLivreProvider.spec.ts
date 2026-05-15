import { MercadoLivreProvider } from '../../application/providers/MercadoLivreProvider';

describe('MercadoLivreProvider', () => {
  const provider = new MercadoLivreProvider();
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  const config = { userId: 'USER123', accessToken: 'ml-token' };

  function makeSearchResponse(ids: string[], total?: number) {
    return {
      ok: true,
      json: async () => ({ results: ids, paging: { total: total ?? ids.length, offset: 0, limit: 50 } }),
    };
  }

  function makeDetailResponse(items: Array<{ id: string; title: string; qty: number; price: number; sku?: string }>) {
    return {
      ok: true,
      json: async () =>
        items.map((i) => ({
          code: 200,
          body: {
            id: i.id,
            title: i.title,
            available_quantity: i.qty,
            price: i.price,
            currency_id: 'BRL',
            seller_custom_field: i.sku ?? null,
          },
        })),
    };
  }

  // ─── testConnection ────────────────────────────────────────────────────────

  it('INV-T-066a: testConnection lança erro quando userId ou accessToken ausente', async () => {
    await expect(provider.testConnection({ accessToken: 'tok' })).rejects.toThrow(/userId|accessToken/i);
    await expect(provider.testConnection({ userId: 'U1' })).rejects.toThrow(/userId|accessToken/i);
  });

  it('INV-T-066b: testConnection chama GET /users/{userId} com Bearer', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'USER123' }),
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;

    await provider.testConnection(config);

    const url = (fetchMock as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('/users/USER123');

    const headers = (fetchMock as jest.Mock).mock.calls[0][1].headers;
    expect(headers['Authorization']).toBe('Bearer ml-token');
  });

  // ─── fetchStock ────────────────────────────────────────────────────────────

  it('INV-T-066c: fetchStock step 1 busca IDs no endpoint de search com offset+limit', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(makeSearchResponse(['MLB1']))
      .mockResolvedValueOnce(makeDetailResponse([{ id: 'MLB1', title: 'P', qty: 1, price: 10 }])) as unknown as typeof fetch;
    global.fetch = fetchMock;

    for await (const _ of provider.fetchStock(config)) { }

    const searchUrl = (fetchMock as jest.Mock).mock.calls[0][0] as string;
    expect(searchUrl).toContain(`/users/${config.userId}/items/search`);
    expect(searchUrl).toContain('offset=0');
    expect(searchUrl).toContain('limit=50');
  });

  it('INV-T-066d: fetchStock step 2 busca detalhes via /items?ids=...&attributes=...', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(makeSearchResponse(['MLB1234567890']))
      .mockResolvedValueOnce(makeDetailResponse([{ id: 'MLB1234567890', title: 'Produto', qty: 3, price: 99.90, sku: 'ML-SKU-001' }])) as unknown as typeof fetch;
    global.fetch = fetchMock;

    for await (const _ of provider.fetchStock(config)) { }

    const detailUrl = (fetchMock as jest.Mock).mock.calls[1][0] as string;
    expect(detailUrl).toContain('/items');
    expect(detailUrl).toContain('MLB1234567890');
    expect(detailUrl).toContain('attributes=');
  });

  it('INV-T-066e: fetchStock mapeia detalhe para InventoryItemSnapshot com seller_custom_field como sku', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(makeSearchResponse(['MLB1234567890']))
      .mockResolvedValueOnce(makeDetailResponse([
        { id: 'MLB1234567890', title: 'Produto ML', qty: 3, price: 99.90, sku: 'ML-SKU-001' },
      ])) as unknown as typeof fetch;

    const batches: any[][] = [];
    for await (const batch of provider.fetchStock(config)) {
      batches.push(batch);
    }

    expect(batches).toHaveLength(1);
    const item = batches[0][0];
    expect(item.sku).toBe('ML-SKU-001');
    expect(item.name).toBe('Produto ML');
    expect(item.availableQuantity).toBe(3);
    expect(item.availabilityStatus).toBe('AVAILABLE');
    expect(item.externalReference).toBe('MLB1234567890');
  });

  it('INV-T-066f: fetchStock para quando search retorna results vazio', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeSearchResponse([]),
    ) as unknown as typeof fetch;

    const batches: unknown[] = [];
    for await (const batch of provider.fetchStock(config)) {
      batches.push(batch);
    }

    expect(batches).toHaveLength(0);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('INV-T-066g: fetchStock pagina incrementando offset por 50', async () => {
    const page1Ids = Array.from({ length: 50 }, (_, i) => `MLB${i + 1}`);
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(makeSearchResponse(page1Ids, 100)) // total=100 → continua paginando
      .mockResolvedValueOnce({
        ok: true,
        json: async () => page1Ids.map((id, i) => ({
          code: 200,
          body: { id, title: `P${i}`, available_quantity: 1, price: 10, currency_id: 'BRL', seller_custom_field: `SKU-${i}` },
        })),
      })
      .mockResolvedValueOnce(makeSearchResponse([])) as unknown as typeof fetch;
    global.fetch = fetchMock;

    for await (const _ of provider.fetchStock(config)) { }

    const secondSearchUrl = (fetchMock as jest.Mock).mock.calls[2][0] as string;
    expect(secondSearchUrl).toContain('offset=50');
  });
});
