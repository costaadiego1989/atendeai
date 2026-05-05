import { AggregateRoot } from '../../../../shared/domain/AggregateRoot';
import { UniqueEntityID } from '../../../../shared/domain/UniqueEntityID';
import { TenantId } from '../../../../shared/domain/TenantId';

export type IntentType =
  | 'GREETING'
  | 'QUESTION'
  | 'COMPLAINT'
  | 'PURCHASE'
  | 'SCHEDULING'
  | 'UNKNOWN';
export type SentimentType = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

interface AISessionProps {
  conversationId: string;
  tenantId: TenantId;
  intent: IntentType | null;
  sentiment: SentimentType | null;
  confidence: number | null;
  tokensUsed: number;
  createdAt: Date;
  updatedAt: Date;
}

export class AISession extends AggregateRoot<AISessionProps> {
  private constructor(props: AISessionProps, id?: UniqueEntityID) {
    super(props, id);
  }

  get conversationId(): string {
    return this.props.conversationId;
  }
  get tenantId(): TenantId {
    return this.props.tenantId;
  }
  get intent(): IntentType | null {
    return this.props.intent;
  }
  get sentiment(): SentimentType | null {
    return this.props.sentiment;
  }
  get confidence(): number | null {
    return this.props.confidence;
  }
  get tokensUsed(): number {
    return this.props.tokensUsed;
  }

  public static create(
    props: Pick<AISessionProps, 'conversationId' | 'tenantId'>,
    id?: UniqueEntityID,
  ): AISession {
    return new AISession(
      {
        ...props,
        intent: null,
        sentiment: null,
        confidence: null,
        tokensUsed: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      id,
    );
  }

  public recordResponse(
    intent: IntentType,
    sentiment: SentimentType,
    confidence: number,
    tokensUsed: number,
  ): void {
    this.props.intent = intent;
    this.props.sentiment = sentiment;
    this.props.confidence = confidence;
    this.props.tokensUsed += tokensUsed;
    this.props.updatedAt = new Date();
  }

  public shouldEscalate(threshold: number): boolean {
    return this.props.confidence !== null && this.props.confidence < threshold;
  }
}
