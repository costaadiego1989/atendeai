import { Injectable } from '@nestjs/common';
import { WhatsAppProvider } from '../../../domain/entities/WhatsAppConfig';
import { BubbleWhatsConfigurationStrategy } from './BubbleWhatsConfigurationStrategy';
import { Dialog360ConfigurationStrategy } from './Dialog360ConfigurationStrategy';
import { MetaCloudConfigurationStrategy } from './MetaCloudConfigurationStrategy';
import { IWhatsAppConfigurationStrategy } from './IWhatsAppConfigurationStrategy';

@Injectable()
export class WhatsAppConfigurationStrategyRegistry {
  private readonly strategies = new Map<
    WhatsAppProvider,
    IWhatsAppConfigurationStrategy
  >();

  constructor(
    bubbleWhatsConfigurationStrategy: BubbleWhatsConfigurationStrategy,
    dialog360ConfigurationStrategy: Dialog360ConfigurationStrategy,
    metaCloudConfigurationStrategy: MetaCloudConfigurationStrategy,
  ) {
    this.strategies.set(
      bubbleWhatsConfigurationStrategy.provider,
      bubbleWhatsConfigurationStrategy,
    );
    this.strategies.set(
      dialog360ConfigurationStrategy.provider,
      dialog360ConfigurationStrategy,
    );
    this.strategies.set(
      metaCloudConfigurationStrategy.provider,
      metaCloudConfigurationStrategy,
    );
  }

  resolve(provider: WhatsAppProvider): IWhatsAppConfigurationStrategy {
    const strategy = this.strategies.get(provider);
    if (!strategy) {
      throw new Error(`WhatsApp provider strategy not configured: ${provider}`);
    }

    return strategy;
  }
}
