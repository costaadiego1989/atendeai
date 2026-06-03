import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { isAxiosError } from 'axios';
import * as crypto from 'crypto';
import {
  SOCIAL_ACCOUNT_FACADE,
  ISocialAccountFacade,
} from '../../application/ports/ISocialAccountFacade';

interface FacebookPage {
  id: string;
  name: string;
  instagram_business_account?: { id: string };
}

interface InstagramAccountInfo {
  id: string;
  username: string;
  name: string;
  profile_picture_url?: string;
}

@Injectable()
export class SocialOAuthService {
  private readonly logger = new Logger(SocialOAuthService.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject(SOCIAL_ACCOUNT_FACADE)
    private readonly socialAccountFacade: ISocialAccountFacade,
  ) {}

  private get appId(): string {
    return this.configService.getOrThrow<string>('META_APP_ID');
  }

  private get appSecret(): string {
    return this.configService.getOrThrow<string>('META_APP_SECRET');
  }

  private get stateSecret(): string {
    return (
      this.configService.get<string>('META_INSTAGRAM_STATE_SECRET') ??
      this.appSecret
    );
  }

  private get redirectUri(): string {
    return this.configService.getOrThrow<string>('META_OAUTH_REDIRECT_URI');
  }

  get successUrl(): string {
    return this.configService.getOrThrow<string>('META_OAUTH_SUCCESS_URL');
  }

  private get graphVersion(): string {
    return this.configService.get<string>('META_GRAPH_API_VERSION') || 'v21.0';
  }

  private get graphBaseUrl(): string {
    return `https://graph.facebook.com/${this.graphVersion}`;
  }

  buildOAuthUrl(tenantId: string): string {
    const state = this.buildState(tenantId);
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      scope: [
        'instagram_basic',
        'instagram_manage_comments',
        'instagram_manage_messages',
        'pages_show_list',
        'pages_read_engagement',
      ].join(','),
      response_type: 'code',
      state,
    });
    return `https://www.facebook.com/dialog/oauth?${params.toString()}`;
  }

  async handleCallback(code: string, state: string): Promise<string> {
    const tenantId = this.parseAndVerifyState(state);

    let shortToken: string;
    try {
      shortToken = await this.exchangeCodeForToken(code);
    } catch (err) {
      this.logger.error(
        `Code exchange failed for tenant ${tenantId}: ${this.extractMessage(err)}`,
      );
      return `${this.successUrl}?instagram_error=token_exchange_failed`;
    }

    let pages: FacebookPage[];
    try {
      const response = await axios.get<{ data: FacebookPage[] }>(
        `${this.graphBaseUrl}/me/accounts`,
        {
          params: {
            access_token: shortToken,
            fields: 'id,name,instagram_business_account',
          },
        },
      );
      pages = response.data?.data ?? [];
    } catch (err) {
      this.logger.error(
        `Failed to fetch Facebook Pages for tenant ${tenantId}: ${this.extractMessage(err)}`,
      );
      return `${this.successUrl}?instagram_error=pages_fetch_failed`;
    }

    const pageWithIg = pages.find((p) => p.instagram_business_account?.id);
    if (!pageWithIg?.instagram_business_account) {
      this.logger.warn(
        `No Instagram Business account found for tenant ${tenantId}`,
      );
      return `${this.successUrl}?instagram_error=no_instagram_account`;
    }

    const igAccountId = pageWithIg.instagram_business_account.id;
    const pageId = pageWithIg.id;

    let igInfo: InstagramAccountInfo;
    try {
      const response = await axios.get<InstagramAccountInfo>(
        `${this.graphBaseUrl}/${igAccountId}`,
        {
          params: {
            access_token: shortToken,
            fields: 'id,username,name,profile_picture_url',
          },
        },
      );
      igInfo = response.data;
    } catch (err) {
      this.logger.error(
        `Failed to fetch Instagram account info for tenant ${tenantId}: ${this.extractMessage(err)}`,
      );
      return `${this.successUrl}?instagram_error=account_info_failed`;
    }

    try {
      const result = await this.socialAccountFacade.connectAccount({
        tenantId,
        platform: 'INSTAGRAM',
        externalAccountId: igAccountId,
        accessToken: shortToken,
        pageId,
        username: igInfo.username,
        displayName: igInfo.name,
        profilePictureUrl: igInfo.profile_picture_url,
      });
      this.logger.log(
        `Instagram account connected for tenant ${tenantId}: ${result.id}`,
      );
    } catch (err) {
      this.logger.error(
        `connectAccount failed for tenant ${tenantId}: ${this.extractMessage(err)}`,
      );
      return `${this.successUrl}?instagram_error=connect_failed`;
    }

    return `${this.successUrl}?instagram_connected=true`;
  }

  private async exchangeCodeForToken(code: string): Promise<string> {
    const response = await axios.get<{ access_token: string }>(
      `${this.graphBaseUrl}/oauth/access_token`,
      {
        params: {
          client_id: this.appId,
          client_secret: this.appSecret,
          redirect_uri: this.redirectUri,
          code,
        },
      },
    );
    const token = response.data?.access_token;
    if (!token) throw new BadRequestException('No access_token in response');
    return token;
  }

  private buildState(tenantId: string): string {
    const timestamp = Date.now().toString();
    const payload = `${tenantId}|${timestamp}`;
    const sig = crypto
      .createHmac('sha256', this.stateSecret)
      .update(payload)
      .digest('hex');
    return Buffer.from(`${payload}|${sig}`).toString('base64url');
  }

  private parseAndVerifyState(state: string): string {
    let decoded: string;
    try {
      decoded = Buffer.from(state, 'base64url').toString('utf8');
    } catch {
      throw new BadRequestException('Invalid OAuth state encoding');
    }

    const parts = decoded.split('|');
    if (parts.length !== 3) {
      throw new BadRequestException('Malformed OAuth state');
    }

    const [tenantId, timestamp, sig] = parts;
    const payload = `${tenantId}|${timestamp}`;

    const expectedSig = crypto
      .createHmac('sha256', this.stateSecret)
      .update(payload)
      .digest('hex');

    const sigBuf = Buffer.from(sig, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    if (
      sigBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expectedBuf)
    ) {
      throw new BadRequestException('Invalid OAuth state signature');
    }

    const ts = parseInt(timestamp, 10);
    const age = Date.now() - ts;
    if (!Number.isFinite(age) || age < 0 || age > 10 * 60 * 1000) {
      throw new BadRequestException('OAuth state expired');
    }

    return tenantId;
  }

  private extractMessage(err: unknown): string {
    if (isAxiosError(err)) {
      return JSON.stringify(err.response?.data ?? err.message);
    }
    return err instanceof Error ? err.message : String(err);
  }
}
