import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { GoogleAdsAccessibleAccount } from '../../domain/types/GoogleAdsConnection';

@Injectable()
export class GoogleAdsOAuthService {
  private readonly oauthUrl = 'https://oauth2.googleapis.com/token';
  private readonly authUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  private readonly apiBaseUrl = 'https://googleads.googleapis.com/v18';

  constructor(private readonly configService: ConfigService) {}

  buildAuthorizationUrl(state: string): string {
    this.ensurePlatformConfigured();
    const params = new URLSearchParams({
      client_id: this.getClientId(),
      redirect_uri: this.getRedirectUri(),
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/adwords',
        'https://www.googleapis.com/auth/userinfo.email',
      ].join(' '),
      state,
    });

    return `${this.authUrl}?${params.toString()}`;
  }

  async exchangeCodeForRefreshToken(code: string): Promise<{
    refreshToken: string;
    email?: string;
  }> {
    this.ensurePlatformConfigured();
    const response = await axios.post(
      this.oauthUrl,
      new URLSearchParams({
        client_id: this.getClientId(),
        client_secret: this.getClientSecret(),
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.getRedirectUri(),
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    const refreshToken = response.data?.refresh_token;
    const accessToken = response.data?.access_token;

    if (!refreshToken) {
      throw new ValidationErrorException(
        'Google Ads OAuth did not return a refresh token',
      );
    }

    let email: string | undefined;
    if (accessToken) {
      try {
        const userInfo = await axios.get(
          'https://www.googleapis.com/oauth2/v2/userinfo',
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );
        email = userInfo.data?.email;
      } catch {
        email = undefined;
      }
    }

    return {
      refreshToken,
      email,
    };
  }

  async getAccessToken(refreshToken: string): Promise<string> {
    this.ensurePlatformConfigured();
    const response = await axios.post(
      this.oauthUrl,
      new URLSearchParams({
        client_id: this.getClientId(),
        client_secret: this.getClientSecret(),
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    const token = response.data?.access_token;
    if (!token) {
      throw new ValidationErrorException(
        'Google Ads OAuth access token could not be obtained',
      );
    }

    return token;
  }

  async listAccessibleAccounts(
    refreshToken: string,
  ): Promise<GoogleAdsAccessibleAccount[]> {
    const accessToken = await this.getAccessToken(refreshToken);
    const developerToken = this.getDeveloperToken();

    const accessible = await axios.get(
      `${this.apiBaseUrl}/customers:listAccessibleCustomers`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'developer-token': developerToken,
        },
      },
    );

    const resourceNames: string[] = accessible.data?.resourceNames ?? [];
    const customerIds = resourceNames
      .map((value) => String(value).split('/').pop())
      .filter(Boolean) as string[];

    const accounts: GoogleAdsAccessibleAccount[] = [];
    for (const customerId of customerIds) {
      try {
        const details = await axios.post(
          `${this.apiBaseUrl}/customers/${customerId}/googleAds:searchStream`,
          {
            query: `
              SELECT
                customer.id,
                customer.descriptive_name,
                customer.manager
              FROM customer
            `,
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'developer-token': developerToken,
            },
          },
        );

        const firstRow = details.data?.[0]?.results?.[0]?.customer;
        accounts.push({
          customerId,
          descriptiveName: firstRow?.descriptiveName || `Conta ${customerId}`,
          isManager: Boolean(firstRow?.manager),
        });
      } catch {
        accounts.push({
          customerId,
          descriptiveName: `Conta ${customerId}`,
          isManager: false,
        });
      }
    }

    return accounts;
  }

  ensurePlatformConfigured() {
    if (
      !this.getDeveloperToken() ||
      !this.getClientId() ||
      !this.getClientSecret() ||
      !this.getRedirectUri()
    ) {
      throw new ValidationErrorException(
        'Google Ads OAuth platform credentials are not configured',
      );
    }
  }

  getDeveloperToken(): string {
    return this.configService.get<string>('GOOGLE_ADS_DEVELOPER_TOKEN') || '';
  }

  getClientId(): string {
    return this.configService.get<string>('GOOGLE_ADS_CLIENT_ID') || '';
  }

  getClientSecret(): string {
    return this.configService.get<string>('GOOGLE_ADS_CLIENT_SECRET') || '';
  }

  getRedirectUri(): string {
    return (
      this.configService.get<string>('GOOGLE_ADS_OAUTH_REDIRECT_URI') || ''
    );
  }
}
