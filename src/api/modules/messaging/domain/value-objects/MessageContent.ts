import { ValueObject } from '../../../../shared/domain/ValueObject';

export type MessageContentType =
  | 'TEXT'
  | 'IMAGE'
  | 'AUDIO'
  | 'VIDEO'
  | 'DOCUMENT'
  | 'BUTTON';

export type MessageContentProps = {
  type: MessageContentType;
  text?: string;
  url?: string;
  metadata?: Record<string, any>;
  [key: string]: unknown;
};

export class MessageContent extends ValueObject<MessageContentProps> {
  private constructor(props: MessageContentProps) {
    super(props);
  }

  get type(): MessageContentType {
    return this.props.type;
  }
  get text(): string | undefined {
    return this.props.text;
  }
  get url(): string | undefined {
    return this.props.url;
  }

  public toPersistence(): MessageContentProps {
    return {
      type: this.props.type,
      text: this.props.text,
      url: this.props.url,
      metadata: this.props.metadata,
    };
  }

  public static createText(text: string): MessageContent {
    return new MessageContent({ type: 'TEXT', text });
  }

  public static create(props: MessageContentProps): MessageContent {
    return new MessageContent(props);
  }
}
