import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { isAxiosError } from 'axios';

export interface LongLivedTokenResult {
  accessToken: string;
  expiresInSeconds: number;
}

@Injectable()
export class MetaTokenExchangeService {
  private readonly logger = new Logger(MetaTokenExchangeService.name);

  constructor(private readonly configService: ConfigService) {}

  private get graphVersion(): string {
    return this.configService.get<string>('META_GRAPH_API_VERSION') || 'v21.0';
  }

  private get baseUrl(): string {
    return `https://graph.facebook.com/${this.graphVersion}`;
  }

  async exchangeForLongLivedToken(
    shortLivedToken: string,
  ): Promise<LongLivedTokenResult> {
    const appId = this.configService.get<string>('META_APP_ID');
    const appSecret = this.configService.get<string>('META_APP_SECRET');

    if (!appId || !appSecret) {
      throw new Error(
        'META_APP_ID and META_APP_SECRET must be configured for token exchange',
      );
    }

    try {
      const response = await axios.get(`${this.baseUrl}/oauth/access_token`, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: shortLivedToken,
        },
      });

      const accessToken = response.data?.access_token;
      const expiresIn = response.data?.expires_in;

      if (!accessToken) {
        throw new Error('Long-lived token exchange returned no access_token');
      }

      this.logger.log(
        `Long-lived token obtained, expires in ${expiresIn || 'unknown'} seconds`,
      );

      return {
        accessToken,
        expiresInSeconds: expiresIn || 5184000, // default 60 days
      };
    } catch (error) {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Long-lived token exchange failed: status=${status}, message=${message}`,
      );
      throw error;
    }
  }

  async refreshLongLivedToken(
    currentToken: string,
  ): Promise<LongLivedTokenResult> {
    const appId = this.configService.get<string>('META_APP_ID');
    const appSecret = this.configService.get<string>('META_APP_SECRET');

    if (!appId || !appSecret) {
      throw new Error(
        'META_APP_ID and META_APP_SECRET must be configured for token refresh',
      );
    }

    try {
      const response = await axios.get(`${this.baseUrl}/oauth/access_token`, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: currentToken,
        },
      });

      const accessToken = response.data?.access_token;
      const expiresIn = response.data?.expires_in;

      if (!accessToken) {
        throw new Error('Token refresh returned no access_token');
      }

      this.logger.log(
        `Token refreshed, expires in ${expiresIn || 'unknown'} seconds`,
      );

      return {
        accessToken,
        expiresInSeconds: expiresIn || 5184000,
      };
    } catch (error) {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Token refresh failed: status=${status}, message=${message}`,
      );
      throw error;
    }
  }
}
