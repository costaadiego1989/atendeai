import { Injectable } from '@nestjs/common';
import { WhatsAppConfig } from '../../../domain/entities/WhatsAppConfig';
import { ConfigureWhatsAppInput } from '../../use-cases/interfaces/IConfigureWhatsAppUseCase';
import { IWhatsAppConfigurationStrategy } from './IWhatsAppConfigurationStrategy';
import { ValidationErrorException } from '../../../../../shared/domain/exceptions/DomainExceptions';

@Injectable()
export class MetaCloudConfigurationStrategy implements IWhatsAppConfigurationStrategy {
  readonly provider = 'META_CLOUD' as const;

  async configure(input: ConfigureWhatsAppInput): Promise<WhatsAppConfig> {
    const accessToken = input.metaAccessToken?.trim();
    if (!accessToken) {
      throw new ValidationErrorException(
        'Meta WhatsApp access token is required',
      );
    }

    const phoneNumberId = input.metaPhoneNumberId?.trim();
    if (!phoneNumberId) {
      throw new ValidationErrorException(
        'Meta WhatsApp phone number id is required',
      );
    }

    const activating = !!input.metaActivate;
    const configuredAt = new Date().toISOString();

    const config = WhatsAppConfig.create({
      provider: this.provider,
      credentials: {
        accessToken,
        phoneNumberId,
        status: activating ? 'ACTIVE' : 'PENDING_VERIFICATION',
        configuredAt,
        ...(input.metaWabaId?.trim()
          ? { wabaId: input.metaWabaId.trim() }
          : {}),
        ...(input.metaBusinessId?.trim()
          ? { businessId: input.metaBusinessId.trim() }
          : {}),
      },
      whatsappNumber: input.whatsappNumber,
      webhookSecret: input.webhookSecret?.trim() || null,
    });

    if (activating) {
      config.activate();
    }

    return config;
  }
}
