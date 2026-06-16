import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { isAxiosError } from 'axios';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';

export interface MetaWhatsAppSignupResult {
  accessToken: string;
}

/**
 * Handles the WhatsApp Cloud API Embedded Signup server-side exchange.
 *
 * The frontend runs Meta's Embedded Signup (Facebook Login for Business) JS SDK
 * and returns a short-lived authorization `code` plus the selected
 * `waba_id` / `phone_number_id`. This service exchanges that code for a
 * business access token and subscribes our app to the WABA so inbound message
 * and status webhooks are delivered.
 *
 * Reuses the shared META_APP_ID / META_APP_SECRET / META_GRAPH_API_VERSION
 * configuration (env reuse only — no cross-module code dependency).
 */
@Injectable()
export class MetaWhatsAppEmbeddedSignupService {
  private readonly logger = new Logger(MetaWhatsAppEmbeddedSignupService.name);
  private readonly graphBaseUrl = 'https://graph.facebook.com';

  constructor(private readonly configService: ConfigService) {}

  async exchangeCodeForAccessToken(
    code: string,
    tenantId?: string,
  ): Promise<MetaWhatsAppSignupResult> {
    this.ensurePlatformConfigured();

    const trimmedCode = code?.trim();
    if (!trimmedCode) {
      throw new ValidationErrorException(
        'Meta Embedded Signup authorization code is required',
      );
    }

    try {
      const response = await axios.get(
        `${this.graphBaseUrl}/${this.getGraphApiVersion()}/oauth/access_token`,
        {
          params: {
            client_id: this.getClientId(),
            client_secret: this.getClientSecret(),
            code: trimmedCode,
          },
        },
      );

      const accessToken = response.data?.access_token;
      if (!accessToken) {
        throw new ValidationErrorException(
          'Meta WhatsApp access token could not be obtained',
        );
      }

      return { accessToken: String(accessToken) };
    } catch (error) {
      if (error instanceof ValidationErrorException) {
        throw error;
      }
      this.logError('embedded_signup.exchange_failed', error, tenantId);
      throw new ValidationErrorException(
        isAxiosError(error)
          ? 'Meta authorization failed — verify META_APP_ID and META_APP_SECRET'
          : error instanceof Error
            ? error.message
            : 'Meta authorization request failed',
      );
    }
  }

  /**
   * Subscribes our Meta app to the tenant's WABA so message + status webhooks
   * are routed to POST /webhooks/whatsapp. Idempotent on Meta's side.
   */
  async subscribeAppToWaba(
    wabaId: string,
    accessToken: string,
    tenantId?: string,
  ): Promise<void> {
    const trimmedWabaId = wabaId?.trim();
    if (!trimmedWabaId) {
      throw new ValidationErrorException('Meta WhatsApp WABA id is required');
    }

    try {
      await axios.post(
        `${this.graphBaseUrl}/${this.getGraphApiVersion()}/${trimmedWabaId}/subscribed_apps`,
        undefined,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
    } catch (error) {
      this.logError('embedded_signup.waba_subscribe_failed', error, tenantId);
      throw new ValidationErrorException(
        isAxiosError(error)
          ? 'Meta WABA subscription failed — verify app configuration and access token'
          : error instanceof Error
            ? error.message
            : 'Meta WABA subscription request failed',
      );
    }
  }

  ensurePlatformConfigured(): void {
    if (!this.getClientId() || !this.getClientSecret()) {
      throw new ValidationErrorException(
        'Meta WhatsApp platform credentials are not configured',
      );
    }
  }

  getClientId(): string {
    return this.configService.get<string>('META_APP_ID') || '';
  }

  getClientSecret(): string {
    return this.configService.get<string>('META_APP_SECRET') || '';
  }

  getGraphApiVersion(): string {
    return this.configService.get<string>('META_GRAPH_API_VERSION') || 'v21.0';
  }

  private logError(event: string, error: unknown, tenantId?: string): void {
    const status = isAxiosError(error) ? error.response?.status : undefined;
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(
      `${event}: tenant=${tenantId ?? 'n/a'} status=${status ?? 'n/a'} message=${message.slice(0, 400)}`,
    );
  }
}
