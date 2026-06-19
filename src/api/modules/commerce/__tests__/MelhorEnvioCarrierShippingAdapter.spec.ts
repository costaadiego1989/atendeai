import { ConfigService } from '@nestjs/config';
import { MelhorEnvioCarrierShippingAdapter } from '../infrastructure/adapters/MelhorEnvioCarrierShippingAdapter';
import { CarrierShippingQuoteInput } from '../domain/ports/ICarrierShippingAdapter';

const baseInput: CarrierShippingQuoteInput = {
  originCep: '01001-000',
  destinationCep: '20040-002',
  weightGrams: 1500,
  heightCm: 10,
  widthCm: 20,
  lengthCm: 30,
};

function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  const values: Record<string, string> = {
    MELHOR_ENVIO_SANDBOX: 'true',
    MELHOR_ENVIO_TOKEN: 'test-token',
    ...overrides,
  };
  return {
    get: jest.fn((key: string, def?: string) => values[key] ?? def),
  } as unknown as ConfigService;
}

describe('MelhorEnvioCarrierShippingAdapter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('quoteShipping', () => {
    it('maps a successful response to available options', async () => {
      const apiResponse = [
        {
          id: 1,
          name: 'PAC',
          price: '25.50',
          delivery_time: 5,
          company: { id: 1, name: 'Correios' },
        },
        {
          id: 2,
          name: 'SEDEX',
          price: '40.00',
          delivery_range: { min: 1, max: 2 },
          company: { id: 1, name: 'Correios' },
        },
      ];
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(apiResponse),
      } as any);

      const adapter = new MelhorEnvioCarrierShippingAdapter(makeConfig());
      const result = await adapter.quoteShipping(baseInput);

      expect(result.options).toHaveLength(2);
      expect(result.options[0]).toEqual(
        expect.objectContaining({
          serviceCode: '1',
          serviceName: 'PAC',
          carrierName: 'Correios',
          price: 25.5,
          deliveryDays: 5,
          available: true,
        }),
      );
      // delivery_range.max used when delivery_time absent
      expect(result.options[1].deliveryDays).toBe(2);
      expect(result.options[1].available).toBe(true);
    });

    it('marks options with error as unavailable', async () => {
      const apiResponse = [
        { id: 3, name: 'Jadlog', error: 'CEP nao atendido' },
      ];
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(apiResponse),
      } as any);

      const adapter = new MelhorEnvioCarrierShippingAdapter(makeConfig());
      const result = await adapter.quoteShipping(baseInput);

      expect(result.options).toHaveLength(1);
      expect(result.options[0].available).toBe(false);
      expect(result.options[0].errorMessage).toBe('CEP nao atendido');
    });

    it('returns empty options when API responds non-ok', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
        text: jest.fn().mockResolvedValue('Unauthorized'),
      } as any);

      const adapter = new MelhorEnvioCarrierShippingAdapter(makeConfig());
      const result = await adapter.quoteShipping(baseInput);

      expect(result.options).toEqual([]);
    });

    it('returns empty options when fetch throws (timeout/network)', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockRejectedValue(new Error('The operation was aborted'));

      const adapter = new MelhorEnvioCarrierShippingAdapter(makeConfig());
      const result = await adapter.quoteShipping(baseInput);

      expect(result.options).toEqual([]);
    });

    it('sends sanitized CEPs, weight in kg and bearer token to the sandbox URL', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue([]),
      } as any);

      const adapter = new MelhorEnvioCarrierShippingAdapter(makeConfig());
      await adapter.quoteShipping(baseInput);

      const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        'https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate',
      );
      expect((options.headers as Record<string, string>).Authorization).toBe(
        'Bearer test-token',
      );
      const body = JSON.parse(options.body as string);
      expect(body.from.postal_code).toBe('01001000');
      expect(body.to.postal_code).toBe('20040002');
      expect(body.package.weight).toBe(1.5); // grams -> kg
      expect(body.package.width).toBe(20);
    });

    it('uses production URL when sandbox is disabled', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue([]),
      } as any);

      const adapter = new MelhorEnvioCarrierShippingAdapter(
        makeConfig({ MELHOR_ENVIO_SANDBOX: 'false' }),
      );
      await adapter.quoteShipping(baseInput);

      const [url] = fetchSpy.mock.calls[0] as [string];
      expect(url).toBe(
        'https://api.melhorenvio.com.br/api/v2/me/shipment/calculate',
      );
    });
  });
});
