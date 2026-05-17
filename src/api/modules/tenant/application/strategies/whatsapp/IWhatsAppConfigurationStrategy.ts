import {
  WhatsAppConfig,
  WhatsAppProvider,
} from '../../../domain/entities/WhatsAppConfig';
import { ConfigureWhatsAppInput } from '../../use-cases/interfaces/IConfigureWhatsAppUseCase';

export interface IWhatsAppConfigurationStrategy {
  readonly provider: WhatsAppProvider;
  configure(input: ConfigureWhatsAppInput): Promise<WhatsAppConfig>;
}

export const WHATSAPP_CONFIGURATION_STRATEGY_REGISTRY = Symbol(
  'WHATSAPP_CONFIGURATION_STRATEGY_REGISTRY',
);
