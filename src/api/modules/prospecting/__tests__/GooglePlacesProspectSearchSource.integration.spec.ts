import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { GooglePlacesProspectSearchSource } from '../infrastructure/acl/GooglePlacesProspectSearchSource';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
}));

describe('GooglePlacesProspectSearchSource', () => {
  let source: GooglePlacesProspectSearchSource;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();

    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === 'GOOGLE_PLACES_API_KEY') return 'google-places-key';
        if (key === 'GOOGLE_PLACES_BASE_URL') {
          return 'https://places.googleapis.com/v1';
        }
        return defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    source = new GooglePlacesProspectSearchSource(configService);
  });

  it('should call Google Places Text Search and normalize the first page', async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        places: [
          {
            id: 'place-1',
            displayName: { text: 'Clinica Sorriso' },
            nationalPhoneNumber: '(19) 3333-4444',
            websiteUri: 'https://clinicasorriso.com.br',
          },
          {
            id: 'place-2',
            displayName: { text: 'Odonto Centro' },
            internationalPhoneNumber: '+55 19 3555-6666',
          },
        ],
      },
    });

    const result = await source.search({
      businessTypeQuery: 'Clinica odontologica',
      city: 'Campinas',
      state: 'SP',
      maxResults: 10,
    });

    expect(axios.post).toHaveBeenCalledWith(
      'https://places.googleapis.com/v1/places:searchText',
      {
        textQuery: 'Clinica odontologica em Campinas, SP',
        pageSize: 10,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': 'google-places-key',
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,nextPageToken',
        },
      },
    );
    expect(result).toEqual([
      {
        externalId: 'place-1',
        businessName: 'Clinica Sorriso',
        city: 'Campinas',
        state: 'SP',
        phone: '(19) 3333-4444',
        website: 'https://clinicasorriso.com.br',
        email: undefined,
      },
      {
        externalId: 'place-2',
        businessName: 'Odonto Centro',
        city: 'Campinas',
        state: 'SP',
        phone: '+55 19 3555-6666',
        website: undefined,
        email: undefined,
      },
    ]);
  });

  it('should paginate until reaching the requested max results', async () => {
    (axios.post as jest.Mock)
      .mockResolvedValueOnce({
        data: {
          places: Array.from({ length: 20 }, (_, index) => ({
            id: `place-${index + 1}`,
            displayName: { text: `Empresa ${index + 1}` },
          })),
          nextPageToken: 'token-page-2',
        },
      })
      .mockResolvedValueOnce({
        data: {
          places: Array.from({ length: 20 }, (_, index) => ({
            id: `place-${index + 21}`,
            displayName: { text: `Empresa ${index + 21}` },
          })),
        },
      });

    const result = await source.search({
      businessTypeQuery: 'Academia',
      city: 'Sao Paulo',
      maxResults: 25,
    });

    expect(axios.post).toHaveBeenNthCalledWith(
      1,
      'https://places.googleapis.com/v1/places:searchText',
      {
        textQuery: 'Academia em Sao Paulo',
        pageSize: 20,
      },
      expect.any(Object),
    );
    expect(axios.post).toHaveBeenNthCalledWith(
      2,
      'https://places.googleapis.com/v1/places:searchText',
      {
        textQuery: 'Academia em Sao Paulo',
        pageSize: 5,
        pageToken: 'token-page-2',
      },
      expect.any(Object),
    );
    expect(result).toHaveLength(25);
    expect(result[24]).toEqual(
      expect.objectContaining({
        externalId: 'place-25',
        businessName: 'Empresa 25',
        city: 'Sao Paulo',
      }),
    );
  });

  it('should throw when the Google Places API key is not configured', async () => {
    configService.get.mockImplementation(
      (key: string, defaultValue?: unknown) => {
        if (key === 'GOOGLE_PLACES_API_KEY') return '';
        if (key === 'GOOGLE_PLACES_BASE_URL') {
          return 'https://places.googleapis.com/v1';
        }
        return defaultValue as any;
      },
    );

    source = new GooglePlacesProspectSearchSource(configService);

    await expect(
      source.search({
        businessTypeQuery: 'Clinica odontologica',
        city: 'Campinas',
        maxResults: 10,
      }),
    ).rejects.toThrow(ValidationErrorException);
  });
});
