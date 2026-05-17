import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  IProspectSearchSource,
  ProspectSearchSourceResult,
} from '../../domain/ports/IProspectSearchSource';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';

@Injectable()
export class GooglePlacesProspectSearchSource implements IProspectSearchSource {
  readonly source = 'GOOGLE_PLACES' as const;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fieldMask =
    'places.id,places.displayName,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,nextPageToken';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GOOGLE_PLACES_API_KEY') || '';
    this.baseUrl =
      this.configService.get<string>('GOOGLE_PLACES_BASE_URL') ||
      'https://places.googleapis.com/v1';
  }

  async search(input: {
    businessTypeQuery: string;
    city: string;
    state?: string;
    neighborhood?: string;
    maxResults: number;
  }): Promise<ProspectSearchSourceResult[]> {
    if (!this.apiKey.trim()) {
      throw new ValidationErrorException(
        'Google Places API key is not configured',
      );
    }

    const textQuery = this.buildTextQuery(
      input.businessTypeQuery,
      input.city,
      input.state,
      input.neighborhood,
    );
    const normalizedMaxResults = Math.min(Math.max(input.maxResults, 1), 60);
    const results: ProspectSearchSourceResult[] = [];
    let pageToken: string | undefined;

    while (results.length < normalizedMaxResults) {
      const remaining = normalizedMaxResults - results.length;
      const pageSize = Math.min(remaining, 20);
      const response = await axios.post(
        `${this.baseUrl}/places:searchText`,
        {
          textQuery,
          pageSize,
          ...(pageToken ? { pageToken } : {}),
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': this.apiKey,
            'X-Goog-FieldMask': this.fieldMask,
          },
        },
      );

      const places = Array.isArray(response.data?.places)
        ? response.data.places
        : [];

      for (const place of places) {
        if (results.length >= normalizedMaxResults) {
          break;
        }

        results.push({
          externalId: place.id,
          businessName: place.displayName?.text || 'Unknown business',
          city: input.city,
          state: input.state,
          phone: place.nationalPhoneNumber || place.internationalPhoneNumber,
          website: place.websiteUri,
          email: undefined,
        });
      }

      pageToken = response.data?.nextPageToken;
      if (!pageToken || places.length === 0) {
        break;
      }
    }

    return results;
  }

  private buildTextQuery(
    businessTypeQuery: string,
    city: string,
    state?: string,
    neighborhood?: string,
  ): string {
    const location = [neighborhood?.trim(), city.trim(), state?.trim()]
      .filter(Boolean)
      .join(', ');
    return `${businessTypeQuery.trim()} em ${location}`;
  }
}
