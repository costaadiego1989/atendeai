import {
  IMessagingGateway,
  MessagingChannel,
  MessagingProvider,
} from './IMessagingGateway';

export interface IMessagingGatewayRegistry {
  resolve(
    channel: MessagingChannel,
    provider: MessagingProvider,
  ): IMessagingGateway | null;
  resolveAll(channel: MessagingChannel): IMessagingGateway[];
}

export const MESSAGING_GATEWAY_REGISTRY = Symbol('IMessagingGatewayRegistry');
