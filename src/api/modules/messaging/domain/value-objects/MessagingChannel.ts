import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';

export type MessagingChannel = 'WHATSAPP' | 'INSTAGRAM' | 'WEB_CHAT';

const SUPPORTED_CHANNELS: ReadonlySet<MessagingChannel> = new Set([
  'WHATSAPP',
  'INSTAGRAM',
  'WEB_CHAT',
]);

export function isMessagingChannel(value: string): value is MessagingChannel {
  return SUPPORTED_CHANNELS.has(value as MessagingChannel);
}

export function assertMessagingChannel(value: string): MessagingChannel {
  if (!isMessagingChannel(value)) {
    throw new ValidationErrorException(
      `Unsupported messaging channel: ${value}`,
    );
  }
  return value;
}
