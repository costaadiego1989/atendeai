import { Entity } from '../../../../shared/domain/Entity.js';
import { UniqueEntityID } from '../../../../shared/domain/UniqueEntityID.js';

export type WhatsAppConfigStatus =
  | 'PENDING_VERIFICATION'
  | 'ACTIVE'
  | 'INACTIVE';
export type WhatsAppProvider = 'BUBBLEWHATS' | 'TWILIO' | 'D360' | 'META_CLOUD';

interface WhatsAppConfigProps {
  provider: WhatsAppProvider;
  credentials: Record<string, string>;
  whatsappNumber: string;
  webhookSecret: string | null;
  status: WhatsAppConfigStatus;
  configuredAt: Date;
}

export class WhatsAppConfig extends Entity<WhatsAppConfigProps> {
  private constructor(
    props: WhatsAppConfigProps,
    id?: UniqueEntityID,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(props, id, createdAt, updatedAt);
  }

  get provider(): WhatsAppProvider {
    return this.props.provider;
  }

  get credentials(): Record<string, string> {
    return { ...this.props.credentials };
  }

  get whatsappNumber(): string {
    return this.props.whatsappNumber;
  }

  get webhookSecret(): string | null {
    return this.props.webhookSecret;
  }

  get status(): WhatsAppConfigStatus {
    return this.props.status;
  }

  get configuredAt(): Date {
    return this.props.configuredAt;
  }

  public static create(
    props: Omit<WhatsAppConfigProps, 'status' | 'configuredAt'>,
    id?: UniqueEntityID,
  ): WhatsAppConfig {
    if (!props.whatsappNumber) {
      throw new Error('WhatsApp number is required');
    }
    if (!props.provider) {
      throw new Error('WhatsApp provider is required');
    }
    if (!props.credentials || Object.keys(props.credentials).length === 0) {
      throw new Error('WhatsApp credentials are required');
    }

    if (props.provider === 'BUBBLEWHATS') {
      if (!props.credentials.id) {
        throw new Error('BubbleWhats id is required');
      }
      if (!props.credentials.token) {
        throw new Error('BubbleWhats token is required');
      }
      if (!props.credentials.apiUrl) {
        throw new Error('BubbleWhats API URL is required');
      }
    }

    if (props.provider === 'D360') {
      if (!props.credentials.apiKey) {
        throw new Error('360dialog API key is required');
      }
    }

    if (props.provider === 'META_CLOUD') {
      if (!props.credentials.accessToken) {
        throw new Error('Meta WhatsApp access token is required');
      }
      if (!props.credentials.phoneNumberId) {
        throw new Error('Meta WhatsApp phone number id is required');
      }
    }

    return new WhatsAppConfig(
      {
        ...props,
        status: 'PENDING_VERIFICATION',
        configuredAt: new Date(),
      },
      id,
    );
  }

  public activate(): void {
    this.props.status = 'ACTIVE';
  }

  public static reconstitute(
    props: WhatsAppConfigProps,
    id: UniqueEntityID,
    createdAt?: Date,
    updatedAt?: Date,
  ): WhatsAppConfig {
    return new WhatsAppConfig(props, id, createdAt, updatedAt);
  }
}
