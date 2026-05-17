import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import {
  GoogleAdsInsightItem,
  IGoogleAdsInsightsSource,
} from '../../domain/ports/IGoogleAdsInsightsSource';
import {
  GOOGLE_ADS_CONNECTION_REPOSITORY,
  IGoogleAdsConnectionRepository,
} from '../../domain/repositories/IGoogleAdsConnectionRepository';
import { GoogleAdsOAuthService } from '../services/GoogleAdsOAuthService';

@Injectable()
export class GoogleAdsInsightsSource implements IGoogleAdsInsightsSource {
  private readonly apiBaseUrl = 'https://googleads.googleapis.com/v18';

  constructor(
    private readonly configService: ConfigService,
    @Inject(GOOGLE_ADS_CONNECTION_REPOSITORY)
    private readonly connectionRepository: IGoogleAdsConnectionRepository,
    private readonly oauthService: GoogleAdsOAuthService,
  ) {}

  async generateInsights(input: {
    tenantId: string;
    segment: string;
    city?: string;
    state?: string;
    country?: string;
    ageRange?: string;
    gender?: string;
    interest?: string;
  }): Promise<GoogleAdsInsightItem[]> {
    const connection = await this.getTenantConnection(input.tenantId);
    const accessToken = await this.oauthService.getAccessToken(
      connection.refreshToken,
    );
    const endpoint = `${this.apiBaseUrl}/customers/${connection.customerId}:generateKeywordIdeas`;
    const response = await axios.post(
      endpoint,
      {
        language: 'languageConstants/1014',
        geoTargetConstants: [],
        keywordSeed: {
          keywords: [
            [input.segment, input.interest, input.city, input.state]
              .filter(Boolean)
              .join(' '),
          ],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'developer-token':
            this.configService.get<string>('GOOGLE_ADS_DEVELOPER_TOKEN') || '',
          ...(connection.loginCustomerId
            ? { 'login-customer-id': connection.loginCustomerId }
            : {}),
        },
      },
    );

    const ideas = Array.isArray(response.data?.results)
      ? response.data.results
      : [];

    const mapped: GoogleAdsInsightItem[] = [];
    const topIdeas = ideas.slice(0, 12);
    for (const idea of topIdeas) {
      const text = idea.text || idea.keywordIdeaMetrics?.text;
      const monthlySearches =
        idea.keywordIdeaMetrics?.avgMonthlySearches ??
        idea.keywordIdeaMetrics?.averageMonthlySearches;
      const competition = idea.keywordIdeaMetrics?.competition;
      if (!text) {
        continue;
      }

      mapped.push({
        resultType: 'KEYWORD_THEME',
        title: text,
        subtitle:
          input.city || input.state
            ? `Tema observado em ${[input.city, input.state].filter(Boolean).join(' / ')}`
            : 'Tema relacionado ao segmento',
        metricValue: monthlySearches,
        score: typeof competition === 'number' ? competition : undefined,
        metadata: {
          segment: input.segment,
          interest: input.interest,
          monthlySearches,
          competition,
        },
      });
    }

    if (topIdeas[0]) {
      mapped.unshift({
        resultType: 'DEMAND_ESTIMATE',
        title: `Demanda estimada para ${input.segment}`,
        subtitle: [input.city, input.state, input.country]
          .filter(Boolean)
          .join(' / '),
        metricValue:
          topIdeas.reduce((sum: number, item: any) => {
            const monthly =
              item.keywordIdeaMetrics?.avgMonthlySearches ??
              item.keywordIdeaMetrics?.averageMonthlySearches ??
              0;
            return sum + monthly;
          }, 0) || undefined,
        metadata: {
          ageRange: input.ageRange,
          gender: input.gender,
          interest: input.interest,
        },
      });
    }

    if (input.interest) {
      mapped.push({
        resultType: 'INTEREST',
        title: input.interest,
        subtitle: 'Interesse usado como sinal de intenção',
        metadata: {
          segment: input.segment,
          ageRange: input.ageRange,
          gender: input.gender,
        },
      });
    }

    mapped.push({
      resultType: 'REGION',
      title:
        [input.city, input.state].filter(Boolean).join(' / ') ||
        input.country ||
        'Brasil',
      subtitle: 'Região alvo considerada na consulta',
      metadata: {
        city: input.city,
        state: input.state,
        country: input.country || 'BR',
      },
    });

    return mapped;
  }

  private async getTenantConnection(tenantId: string) {
    this.oauthService.ensurePlatformConfigured();
    const connection = await this.connectionRepository.findByTenantId(tenantId);
    if (!connection || !connection.customerId) {
      throw new ValidationErrorException(
        'Google Ads ainda não foi conectado e configurado para este tenant',
      );
    }
    return connection;
  }
}
