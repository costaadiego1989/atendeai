import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { isAxiosError } from 'axios';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { StructuredLogEmitter } from '@shared/infrastructure/observability/StructuredLogEmitter';

export interface MetaInstagramSelectableAccount {
  instagramAccountId: string;
  username: string | null;
  pageId: string;
  pageName: string | null;
  profilePictureUrl: string | null;
}

@Injectable()
export class MetaInstagramOAuthService {
  private readonly authUrl = 'https://www.facebook.com/dialog/oauth';
  private readonly graphBaseUrl = 'https://graph.facebook.com';

  constructor(
    private readonly configService: ConfigService,
    private readonly structuredLog: StructuredLogEmitter,
  ) {}

  buildAuthorizationUrl(state: string): string {
    this.ensurePlatformConfigured();

    const params = new URLSearchParams({
      client_id: this.getClientId(),
      redirect_uri: this.getRedirectUri(),
      response_type: 'code',
      state,
    });

    const loginConfigId = this.getLoginConfigId();
    if (loginConfigId) {
      params.set('config_id', loginConfigId);
    } else {
      params.set(
        'scope',
        ['pages_show_list', 'business_management', 'instagram_basic'].join(','),
      );
    }

    return `${this.authUrl}?${params.toString()}`;
  }

  async exchangeCodeForAccessToken(
    code: string,
    tenantId?: string,
  ): Promise<string> {
    this.ensurePlatformConfigured();

    try {
      const response = await axios.get(
        `${this.graphBaseUrl}/${this.getGraphApiVersion()}/oauth/access_token`,
        {
          params: {
            client_id: this.getClientId(),
            client_secret: this.getClientSecret(),
            redirect_uri: this.getRedirectUri(),
            code,
          },
        },
      );

      const accessToken = response.data?.access_token;
      if (!accessToken) {
        this.structuredLog.emit({
          level: 'warn',
          event: 'tenant.channel.meta_instagram.oauth.token_missing',
          message: 'Meta OAuth response did not include access_token',
          tenantId,
          attributes: {
            provider: 'META_INSTAGRAM',
          },
        });
        throw new ValidationErrorException(
          'Meta OAuth access token could not be obtained',
        );
      }

      return accessToken;
    } catch (error) {
      if (error instanceof ValidationErrorException) {
        throw error;
      }
      const status = isAxiosError(error) ? error.response?.status : undefined;
      const message = error instanceof Error ? error.message : String(error);
      this.structuredLog.emit({
        level: 'warn',
        event: 'tenant.channel.meta_instagram.oauth.exchange_failed',
        message: 'Meta OAuth code exchange HTTP request failed',
        tenantId,
        attributes: {
          provider: 'META_INSTAGRAM',
          http_status: status != null ? String(status) : 'n/a',
          error_message: message.slice(0, 400),
        },
      });
      throw error;
    }
  }

  async listInstagramAccounts(
    accessToken: string,
    tenantId?: string,
  ): Promise<MetaInstagramSelectableAccount[]> {
    try {
      const response = await axios.get(
        `${this.graphBaseUrl}/${this.getGraphApiVersion()}/me/accounts`,
        {
          params: {
            access_token: accessToken,
            fields:
              'id,name,instagram_business_account{id,username,profile_picture_url},connected_instagram_account{id,username,profile_picture_url}',
          },
        },
      );

      const pages = Array.isArray(response.data?.data)
        ? response.data.data
        : [];
      const deduped = new Map<string, MetaInstagramSelectableAccount>();

      for (const page of pages) {
        const instagramAccount =
          page?.instagram_business_account ?? page?.connected_instagram_account;
        const instagramAccountId = instagramAccount?.id
          ? String(instagramAccount.id)
          : '';

        if (!instagramAccountId || deduped.has(instagramAccountId)) {
          continue;
        }

        deduped.set(instagramAccountId, {
          instagramAccountId,
          username: instagramAccount?.username
            ? String(instagramAccount.username)
            : null,
          pageId: String(page?.id ?? ''),
          pageName: page?.name ? String(page.name) : null,
          profilePictureUrl: instagramAccount?.profile_picture_url
            ? String(instagramAccount.profile_picture_url)
            : null,
        });
      }

      return Array.from(deduped.values());
    } catch (error) {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      const message = error instanceof Error ? error.message : String(error);
      this.structuredLog.emit({
        level: 'warn',
        event: 'tenant.channel.meta_instagram.accounts_list.failed',
        message: 'Meta Graph list Instagram accounts failed',
        tenantId,
        attributes: {
          provider: 'META_INSTAGRAM',
          http_status: status != null ? String(status) : 'n/a',
          error_message: message.slice(0, 400),
        },
      });
      throw error;
    }
  }

  ensurePlatformConfigured() {
    if (
      !this.getClientId() ||
      !this.getClientSecret() ||
      !this.getRedirectUri()
    ) {
      throw new ValidationErrorException(
        'Meta Instagram OAuth platform credentials are not configured',
      );
    }
  }

  getClientId(): string {
    return this.configService.get<string>('META_APP_ID') || '';
  }

  getClientSecret(): string {
    return this.configService.get<string>('META_APP_SECRET') || '';
  }

  getRedirectUri(): string {
    return (
      this.configService.get<string>('META_INSTAGRAM_OAUTH_REDIRECT_URI') || ''
    );
  }

  getGraphApiVersion(): string {
    return this.configService.get<string>('META_GRAPH_API_VERSION') || 'v20.0';
  }

  getLoginConfigId(): string {
    return (
      this.configService.get<string>('META_INSTAGRAM_LOGIN_CONFIG_ID') || ''
    );
  }
}
