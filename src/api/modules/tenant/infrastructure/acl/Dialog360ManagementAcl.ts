import { Injectable } from '@nestjs/common';
import axios, { isAxiosError } from 'axios';
import { ConfigService } from '@nestjs/config';
import { StructuredLogEmitter } from '@shared/infrastructure/observability/StructuredLogEmitter';

export interface ConfigureDialog360WebhookInput {
  apiKey: string;
  url: string;
  headers?: Record<string, string>;
  tenantId?: string;
}

@Injectable()
export class Dialog360ManagementAcl {
  private readonly baseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly structuredLog: StructuredLogEmitter,
  ) {
    this.baseUrl =
      this.configService.get<string>('D360_BASE_URL') ||
      'https://waba-v2.360dialog.io';
  }

  async configurePhoneWebhook(input: ConfigureDialog360WebhookInput): Promise<void> {
    try {
      await axios.post(
        `${this.baseUrl}/v1/configs/webhook`,
        {
          url: input.url,
          ...(input.headers && Object.keys(input.headers).length > 0
            ? { headers: input.headers }
            : {}),
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'D360-API-KEY': input.apiKey,
          },
        },
      );
    } catch (error) {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      const message = error instanceof Error ? error.message : String(error);

      this.structuredLog.emit({
        level: 'warn',
        event: 'tenant.channel.dialog360.configure_webhook.failed',
        message: '360dialog webhook configuration request failed',
        tenantId: input.tenantId,
        attributes: {
          provider: 'D360',
          http_status: status != null ? String(status) : 'n/a',
          error_message: message.slice(0, 400),
        },
      });

      throw error;
    }
  }
}
