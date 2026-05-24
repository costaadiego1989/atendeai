import { AggregateRoot } from '../../../../shared/domain/AggregateRoot';
import { UniqueEntityID } from '../../../../shared/domain/UniqueEntityID';
import { TenantId } from '../../../../shared/domain/TenantId';
import { Message } from './Message';
import {
  MessagingChannel,
  assertMessagingChannel,
} from '../value-objects/MessagingChannel';

export type ConversationStatus = 'ACTIVE' | 'ARCHIVED' | 'PENDING_HUMAN';

interface ConversationProps {
  tenantId: TenantId;
  contactId: UniqueEntityID;
  branchId?: string | null;
  channel: MessagingChannel;
  status: ConversationStatus;
  messages: Message[];
  startedAt: Date;
  updatedAt: Date;
}

export class Conversation extends AggregateRoot<ConversationProps> {
  private constructor(props: ConversationProps, id?: UniqueEntityID) {
    super(props, id);
  }

  get tenantId(): TenantId {
    return this.props.tenantId;
  }
  get contactId(): UniqueEntityID {
    return this.props.contactId;
  }
  get branchId(): string | null | undefined {
    return this.props.branchId;
  }
  get channel(): MessagingChannel {
    return this.props.channel;
  }
  get status(): ConversationStatus {
    return this.props.status;
  }
  get messages(): ReadonlyArray<Message> {
    return this.props.messages;
  }
  get startedAt(): Date {
    return this.props.startedAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public static reconstitute(
    props: ConversationProps,
    id?: UniqueEntityID,
  ): Conversation {
    return new Conversation(props, id);
  }

  public static create(
    props: Omit<
      ConversationProps,
      'status' | 'messages' | 'startedAt' | 'updatedAt'
    >,
    id?: UniqueEntityID,
  ): Conversation {
    return new Conversation(
      {
        ...props,
        channel: assertMessagingChannel(props.channel),
        status: 'ACTIVE',
        messages: [],
        startedAt: new Date(),
        updatedAt: new Date(),
      },
      id,
    );
  }

  public addMessage(message: Message): void {
    this.props.messages.push(message);
    this.props.updatedAt = new Date();
  }

  public markAsPendingHuman(): void {
    this.props.status = 'PENDING_HUMAN';
    this.props.updatedAt = new Date();
  }

  public activate(): void {
    this.props.status = 'ACTIVE';
    this.props.updatedAt = new Date();
  }

  public archive(): void {
    this.props.status = 'ARCHIVED';
    this.props.updatedAt = new Date();
  }
}
