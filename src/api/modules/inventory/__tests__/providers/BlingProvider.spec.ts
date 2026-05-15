import { BlingProvider } from '../../application/providers/BlingProvider';

describe('BlingProvider (extended)', () => {
  const provider = new BlingProvider();
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  const config = { accessToken: 'bling-token' };

  function makeBlingPage(
    items: Array<{ id: number; codigo: string; nome: string; estoque?: number; preco?: number }>,
  ) {
    return {
      ok: true,
      json: async () => ({
        data: items.map((i) => ({
          id: i.id,
          codigo: i.codigo,
          nome: i.nome,
          estoque: { saldoVirtual: i.estoque ?? 0 },
          preço: i.preco ?? 0,
        })),
      }),
    };
  }

  // ─── testConnection ────────────────────────────────────────────────────────

  it('INV-T-061f: testConnection retorna true quando resposta é 200', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    }) as unknown as typeof fetch;

    const result = await provider.testConnection(config);
    expect(result).toBe(true);
  });

  // ─── fetchStock ────────────────────────────────────────────────────────────

  it('INV-T-061a: fetchStock mapeia codigo, nome, saldoVirtual e preço para snapshot', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeBlingPage([{ id: 1001, codigo: 'BLING-001', nome: 'Produto Bling', estoque: 10, preco: 59.9 }]),
    ) as unknown as typeof fetch;

    const batches: any[][] = [];
    for await (const batch of provider.fetchStock(config)) {
      batches.push(batch);
    }

    expect(batches).toHaveLength(1);
    const item = batches[0][0];
    expect(item.sku).toBe('BLING-001');
    expect(item.name).toBe('Produto Bling');
    expect(item.externalReference).toBe('1001');
    expect(item.availableQuantity).toBe(10);
    expect(item.currency).toBe('BRL');
  });

  it('INV-T-061b: fetchStock para quando página retorna <100 itens (faz 1 fetch)', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeBlingPage([{ id: 1, codigo: 'SKU-A', nome: 'A', estoque: 5 }]),
    ) as unknown as typeof fetch;

    const batches: unknown[] = [];
    for await (const batch of provider.fetchStock(config)) {
      batches.push(batch);
    }

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(batches).toHaveLength(1);
  });

  it('INV-T-061c: fetchStock busca página 2 quando primeira página tem exatamente 100 itens', async () => {
    const page1Items = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      codigo: `SKU-${i + 1}`,
      nome: `Produto ${i + 1}`,
      estoque: 1,
    }));

    const fetchMock = jest.fn()
      .mockResolvedValueOnce(makeBlingPage(page1Items))
      .mockResolvedValueOnce(makeBlingPage([])) as unknown as typeof fetch;
    global.fetch = fetchMock;

    for await (const _ of provider.fetchStock(config)) { }

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondUrl = (fetchMock as jest.Mock).mock.calls[1][0] as string;
    expect(secondUrl).toContain('pagina=2');
  });

  it('INV-T-061d: qty=0 → availabilityStatus UNAVAILABLE', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeBlingPage([{ id: 2, codigo: 'OUT-001', nome: 'Sem Estoque', estoque: 0 }]),
    ) as unknown as typeof fetch;

    const batches: any[][] = [];
    for await (const batch of provider.fetchStock(config)) {
      batches.push(batch);
    }

    expect(batches[0][0].availabilityStatus).toBe('UNAVAILABLE');
    expect(batches[0][0].availableQuantity).toBe(0);
  });

  it('INV-T-061e: qty>0 → availabilityStatus AVAILABLE', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      makeBlingPage([{ id: 3, codigo: 'IN-001', nome: 'Com Estoque', estoque: 7 }]),
    ) as unknown as typeof fetch;

    const batches: any[][] = [];
    for await (const batch of provider.fetchStock(config)) {
      batches.push(batch);
    }

    expect(batches[0][0].availabilityStatus).toBe('AVAILABLE');
    expect(batches[0][0].availableQuantity).toBe(7);
  });
});
