import { Entity } from '../../../../shared/domain/Entity';
import { UniqueEntityID } from '../../../../shared/domain/UniqueEntityID';
import { MessageContent } from '../value-objects/MessageContent';

export type MessageDirection = 'INBOUND' | 'OUTBOUND';
export type MessageSource = 'AI' | 'HUMAN' | 'SYSTEM' | 'CONTACT';
export type DeliveryStatus =
  | 'PENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED';

interface MessageProps {
  conversationId: UniqueEntityID;
  direction: MessageDirection;
  contentType: string;
  content: MessageContent;
  sentBy: MessageSource;
  deliveryStatus: DeliveryStatus;
  externalId?: string;
  createdAt: Date;
}

export class Message extends Entity<MessageProps> {
  private static lastCreatedAtMs = 0;

  private constructor(props: MessageProps, id?: UniqueEntityID) {
    super(props, id);
  }

  get conversationId(): UniqueEntityID {
    return this.props.conversationId;
  }
  get direction(): MessageDirection {
    return this.props.direction;
  }
  get contentType(): string {
    return this.props.contentType;
  }
  get content(): MessageContent {
    return this.props.content;
  }
  get sentBy(): MessageSource {
    return this.props.sentBy;
  }
  get deliveryStatus(): DeliveryStatus {
    return this.props.deliveryStatus;
  }
  get externalId(): string | undefined {
    return this.props.externalId;
  }

  public static reconstitute(props: MessageProps, id: UniqueEntityID): Message {
    return new Message(props, id);
  }

  public static create(
    props: Omit<MessageProps, 'deliveryStatus' | 'createdAt'>,
    id?: UniqueEntityID,
  ): Message {
    const now = Date.now();
    const nextCreatedAtMs =
      now <= Message.lastCreatedAtMs ? Message.lastCreatedAtMs + 1 : now;
    Message.lastCreatedAtMs = nextCreatedAtMs;

    return new Message(
      {
        ...props,
        deliveryStatus: props.direction === 'INBOUND' ? 'SENT' : 'PENDING',
        createdAt: new Date(nextCreatedAtMs),
      },
      id,
    );
  }

  public updateStatus(status: DeliveryStatus): void {
    this.props.deliveryStatus = status;
  }
}
