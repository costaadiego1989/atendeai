import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsAppConfig } from '../../../domain/entities/WhatsAppConfig';
import { ConfigureWhatsAppInput } from '../../use-cases/interfaces/IConfigureWhatsAppUseCase';
import { IWhatsAppConfigurationStrategy } from './IWhatsAppConfigurationStrategy';
import { Dialog360ManagementAcl } from '../../../infrastructure/acl/Dialog360ManagementAcl';

@Injectable()
export class Dialog360ConfigurationStrategy
  implements IWhatsAppConfigurationStrategy
{
  readonly provider = 'D360' as const;

  constructor(
    private readonly configService: ConfigService,
    private readonly dialog360ManagementAcl: Dialog360ManagementAcl,
  ) {}

  async configure(input: ConfigureWhatsAppInput): Promise<WhatsAppConfig> {
    const apiKey = input.d360ApiKey?.trim();
    if (!apiKey) {
      throw new Error('360dialog API key is required');
    }

    const webhookUrl = this.resolveWebhookUrl(input.d360WebhookUrl);
    if (webhookUrl) {
      await this.dialog360ManagementAcl.configurePhoneWebhook({
        apiKey,
        url: webhookUrl,
        tenantId: input.tenantId,
      });
    }

    const config = WhatsAppConfig.create({
      provider: this.provider,
      credentials: {
        apiKey,
        baseUrl:
          this.configService.get<string>('D360_BASE_URL') ||
          'https://waba-v2.360dialog.io',
      },
      whatsappNumber: input.whatsappNumber,
      webhookSecret: null,
    });

    config.activate();
    return config;
  }

  private resolveWebhookUrl(explicitUrl?: string): string | null {
    if (explicitUrl?.trim()) {
      return explicitUrl.trim();
    }

    const directWebhookUrl = this.configService.get<string>(
      'D360_DEFAULT_WEBHOOK_URL',
    );
    if (directWebhookUrl?.trim()) {
      return directWebhookUrl.trim();
    }

    const appPublicBaseUrl = this.configService.get<string>('APP_PUBLIC_BASE_URL');
    if (!appPublicBaseUrl?.trim()) {
      return null;
    }

    return `${appPublicBaseUrl.replace(/\/$/, '')}/api/v1/webhooks/whatsapp`;
  }
}
