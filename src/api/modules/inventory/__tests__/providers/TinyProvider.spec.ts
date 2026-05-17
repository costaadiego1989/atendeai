import { TinyProvider } from '../../application/providers/TinyProvider';

describe('TinyProvider', () => {
  const provider = new TinyProvider();
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  // ─── testConnection ────────────────────────────────────────────────────────

  it('INV-T-062a: testConnection lança erro quando token ausente', async () => {
    await expect(provider.testConnection({})).rejects.toThrow(/Token/);
  });

  it('INV-T-062b: testConnection lança erro quando resposta HTTP não OK', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
    }) as unknown as typeof fetch;

    await expect(provider.testConnection({ token: 'tok' })).rejects.toThrow();
  });

  it('INV-T-062c: testConnection retorna true em HTTP 200 com status OK', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ retorno: { status: 'OK' } }),
    }) as unknown as typeof fetch;

    const result = await provider.testConnection({ token: 'tok' });
    expect(result).toBe(true);
  });

  // ─── fetchStock ────────────────────────────────────────────────────────────

  it('INV-T-062d: fetchStock faz POST para produtos.pesquisa.php com body correto', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        retorno: { status: 'OK', número_paginas: 1, produtos: [] },
      }),
    }) as unknown as typeof fetch;
    global.fetch = fetchMock;

    const gen = provider.fetchStock({ token: 'meu-token' });
    await gen.next();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.tiny.com.br/api2/produtos.pesquisa.php',
      expect.objectContaining({ method: 'POST' }),
    );

    const call = (fetchMock as jest.Mock).mock.calls[0];
    const body = call[1].body as URLSearchParams;
    expect(body.get('token')).toBe('meu-token');
    expect(body.get('formato')).toBe('JSON');
    expect(body.get('pagina')).toBe('1');
  });

  it('INV-T-062e: fetchStock pagina usando número_paginas da resposta', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          retorno: {
            status: 'OK',
            número_paginas: 2,
            produtos: [
              {
                produto: {
                  codigo: 'P1',
                  nome: 'Prod 1',
                  saldo_estoque: '5',
                  preço: '10.00',
                },
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          retorno: {
            status: 'OK',
            número_paginas: 2,
            produtos: [
              {
                produto: {
                  codigo: 'P2',
                  nome: 'Prod 2',
                  saldo_estoque: '3',
                  preço: '20.00',
                },
              },
            ],
          },
        }),
      }) as unknown as typeof fetch;
    global.fetch = fetchMock;

    const batches: unknown[] = [];
    for await (const batch of provider.fetchStock({ token: 'tok' })) {
      batches.push(batch);
    }

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(batches).toHaveLength(2);
  });

  it('INV-T-062f: fetchStock mapeia resposta para InventoryItemSnapshot corretamente', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        retorno: {
          status: 'OK',
          número_paginas: 1,
          produtos: [
            {
              produto: {
                id: '9',
                codigo: 'SKU-T01',
                nome: 'Produto Tiny Teste',
                saldo_estoque: '7',
                preço: '19.90',
              },
            },
          ],
        },
      }),
    }) as unknown as typeof fetch;

    const batches: any[][] = [];
    for await (const batch of provider.fetchStock({ token: 'tok' })) {
      batches.push(batch);
    }

    expect(batches).toHaveLength(1);
    const item = batches[0][0];
    expect(item.sku).toBe('SKU-T01');
    expect(item.name).toBe('Produto Tiny Teste');
    expect(item.availableQuantity).toBe(7);
    expect(item.availabilityStatus).toBe('AVAILABLE');
    expect(item.currentPrice).toBe('19.90');
  });

  it('INV-T-062g: fetchStock para quando produtos está vazio', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        retorno: { status: 'OK', número_paginas: 1, produtos: [] },
      }),
    }) as unknown as typeof fetch;

    const batches: unknown[] = [];
    for await (const batch of provider.fetchStock({ token: 'tok' })) {
      batches.push(batch);
    }

    expect(batches).toHaveLength(0);
  });
});
