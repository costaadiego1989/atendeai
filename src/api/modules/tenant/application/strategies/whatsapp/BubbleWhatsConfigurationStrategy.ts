import { Injectable } from '@nestjs/common';
import { WhatsAppConfig } from '../../../domain/entities/WhatsAppConfig';
import { ConfigureWhatsAppInput } from '../../use-cases/interfaces/IConfigureWhatsAppUseCase';
import { IWhatsAppConfigurationStrategy } from './IWhatsAppConfigurationStrategy';

@Injectable()
export class BubbleWhatsConfigurationStrategy
  implements IWhatsAppConfigurationStrategy
{
  readonly provider = 'BUBBLEWHATS' as const;

  async configure(input: ConfigureWhatsAppInput): Promise<WhatsAppConfig> {
    const config = WhatsAppConfig.create({
      provider: this.provider,
      credentials: {
        id: input.bubbleWhatsId || '',
        token: input.bubbleWhatsToken || '',
        apiUrl: input.bubbleWhatsApiUrl || '',
      },
      whatsappNumber: input.whatsappNumber,
      webhookSecret: input.webhookSecret || null,
    });

    config.activate();
    return config;
  }
}
