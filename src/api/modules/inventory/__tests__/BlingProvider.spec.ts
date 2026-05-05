import { BlingProvider } from '../application/providers/BlingProvider';

describe('BlingProvider', () => {
  const provider = new BlingProvider();
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('INV-T-060a: testConnection falha quando falta accessToken', async () => {
    await expect(provider.testConnection({})).rejects.toThrow(/accessToken/);
  });

  it('INV-T-060b: testConnection propaga erro HTTP não OK', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
    }) as unknown as typeof fetch;

    await expect(
      provider.testConnection({ accessToken: 'bad' }),
    ).rejects.toThrow(/401/);
  });

  it('INV-T-060c: fetchStock falha quando API de produtos retorna não OK', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
    }) as unknown as typeof fetch;

    const gen = provider.fetchStock({ accessToken: 'tok' });
    await expect(gen.next()).rejects.toThrow(/429/);
  });

  it('INV-T-060d: fetchStock página vazia termina sem yield obrigatório', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    }) as unknown as typeof fetch;

    const batches: unknown[] = [];
    for await (const b of provider.fetchStock({ accessToken: 'tok' })) {
      batches.push(b);
    }
    expect(batches).toHaveLength(0);
    expect(global.fetch).toHaveBeenCalled();
  });
});
