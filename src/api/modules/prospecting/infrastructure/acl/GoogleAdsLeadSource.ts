import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Inject, Injectable } from '@nestjs/common';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import {
  GoogleAdsLeadItem,
  IGoogleAdsLeadSource,
} from '../../domain/ports/IGoogleAdsLeadSource';
import {
  GOOGLE_ADS_CONNECTION_REPOSITORY,
  IGoogleAdsConnectionRepository,
} from '../../domain/repositories/IGoogleAdsConnectionRepository';
import { GoogleAdsOAuthService } from '../services/GoogleAdsOAuthService';

@Injectable()
export class GoogleAdsLeadSource implements IGoogleAdsLeadSource {
  private readonly apiBaseUrl = 'https://googleads.googleapis.com/v18';

  constructor(
    private readonly configService: ConfigService,
    @Inject(GOOGLE_ADS_CONNECTION_REPOSITORY)
    private readonly connectionRepository: IGoogleAdsConnectionRepository,
    private readonly oauthService: GoogleAdsOAuthService,
  ) {}

  async pullLeads(input: {
    tenantId: string;
    limit?: number;
  }): Promise<GoogleAdsLeadItem[]> {
    const connection = await this.getTenantConnection(input.tenantId);
    const accessToken = await this.oauthService.getAccessToken(
      connection.refreshToken,
    );
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const response = await axios.post(
      `${this.apiBaseUrl}/customers/${connection.customerId}/googleAds:searchStream`,
      {
        query: `
          SELECT
            lead_form_submission_data.id,
            lead_form_submission_data.asset,
            lead_form_submission_data.campaign,
            lead_form_submission_data.lead_form_submission_fields,
            lead_form_submission_data.custom_lead_form_submission_fields,
            lead_form_submission_data.submission_date_time,
            campaign.name
          FROM lead_form_submission_data
          ORDER BY lead_form_submission_data.submission_date_time DESC
          LIMIT ${limit}
        `,
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

    const chunks = Array.isArray(response.data) ? response.data : [];
    const rows = chunks.flatMap((chunk) => chunk.results ?? []);
    return rows.map((row: any) => {
      const leadData = row.leadFormSubmissionData ?? {};
      const fields = [
        ...(leadData.leadFormSubmissionFields ?? []),
        ...(leadData.customLeadFormSubmissionFields ?? []),
      ].map((field: any) => ({
        key: String(field.fieldType || field.name || 'field').toLowerCase(),
        value: String(field.fieldValue ?? field.value ?? ''),
      }));

      const getField = (...candidates: string[]) =>
        fields.find((field) =>
          candidates.some((candidate) => field.key.includes(candidate)),
        )?.value;

      return {
        externalLeadId: String(
          leadData.id ??
            leadData.resourceName ??
            `${connection.customerId}-${leadData.submissionDateTime ?? Date.now()}`,
        ),
        googleAdsCustomerId: connection.customerId,
        campaignName: row.campaign?.name ?? undefined,
        formName:
          String(leadData.asset ?? '')
            .split('/')
            .pop() || undefined,
        fullName: getField('full_name', 'name', 'nome'),
        phone: getField('phone_number', 'phone', 'telefone', 'whatsapp'),
        email: getField('email'),
        city: getField('city', 'cidade'),
        state: getField('province', 'state', 'estado'),
        instagramHandle: getField('instagram'),
        document: getField('cpf', 'cnpj', 'documento'),
        submissionAt: new Date(
          leadData.submissionDateTime ?? new Date().toISOString(),
        ),
        fields,
        rawPayload: row,
      } satisfies GoogleAdsLeadItem;
    });
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
