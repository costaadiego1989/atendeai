import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { HttpProspectWebsiteEnricher } from '../infrastructure/services/HttpProspectWebsiteEnricher';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

describe('HttpProspectWebsiteEnricher', () => {
  let enricher: HttpProspectWebsiteEnricher;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();

    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === 'PROSPECT_WEBSITE_TIMEOUT_MS') {
          return 5000;
        }
        return defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    enricher = new HttpProspectWebsiteEnricher(configService);
  });

  it('should extract contacts from homepage and contact page', async () => {
    (axios.get as jest.Mock)
      .mockResolvedValueOnce({
        data: `
          <html>
            <body>
              <a href="/contato">Contato</a>
              <a href="mailto:comercial@clinicasorriso.com.br">Email</a>
            </body>
          </html>
        `,
      })
      .mockResolvedValueOnce({
        data: `
          <html>
            <body>
              Ligue para (19) 3333-4444
            </body>
          </html>
        `,
      });

    const result = await enricher.enrich({
      website: 'https://clinicasorriso.com.br',
    });

    expect(axios.get).toHaveBeenNthCalledWith(
      1,
      'https://clinicasorriso.com.br',
      expect.objectContaining({
        timeout: 5000,
      }),
    );
    expect(axios.get).toHaveBeenNthCalledWith(
      2,
      'https://clinicasorriso.com.br/contato',
      expect.objectContaining({
        timeout: 5000,
      }),
    );
    expect(result).toEqual({
      email: 'comercial@clinicasorriso.com.br',
      phone: '1933334444',
    });
  });

  it('should return empty enrichment when website is missing', async () => {
    await expect(enricher.enrich({ website: undefined })).resolves.toEqual({});
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('should tolerate inaccessible websites and return empty enrichment', async () => {
    (axios.get as jest.Mock).mockRejectedValue(new Error('ECONNRESET'));

    await expect(
      enricher.enrich({
        website: 'https://clinicasorriso.com.br',
      }),
    ).resolves.toEqual({});
  });
});
