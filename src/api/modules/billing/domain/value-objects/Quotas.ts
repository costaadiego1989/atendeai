import { ValueObject } from '../../../../shared/domain/ValueObject';
import { getPlanQuotas } from '../constants/PlanQuotas';

export type PlanType = 'ESSENCIAL' | 'PROFISSIONAL' | 'ESCALA' | 'TRIAL';

interface SubscriptionQuotas {
  messages: number;
  aiTokens: number;
  contacts: number;
}

export class Quotas extends ValueObject<SubscriptionQuotas> {
  private constructor(props: SubscriptionQuotas) {
    super(props);
  }

  get messages(): number {
    return this.props.messages;
  }
  get aiTokens(): number {
    return this.props.aiTokens;
  }
  get contacts(): number {
    return this.props.contacts;
  }

  /**
   * Checks if any quota dimension is exceeded by the given usage values.
   */
  public isExceeded(usage: {
    messagesUsed: number;
    aiTokensUsed: number;
    contactsUsed: number;
  }): boolean {
    return (
      usage.messagesUsed >= this.props.messages ||
      usage.aiTokensUsed >= this.props.aiTokens ||
      usage.contactsUsed >= this.props.contacts
    );
  }

  /**
   * Checks if usage has reached the warning threshold (80% of any quota).
   */
  public warningThresholdReached(
    usage: {
      messagesUsed: number;
      aiTokensUsed: number;
      contactsUsed: number;
    },
    threshold = 0.8,
  ): boolean {
    return (
      usage.messagesUsed >= this.props.messages * threshold ||
      usage.aiTokensUsed >= this.props.aiTokens * threshold ||
      usage.contactsUsed >= this.props.contacts * threshold
    );
  }

  /**
   * Returns the remaining percentage for the most consumed quota dimension.
   * Returns a value between 0 and 100.
   */
  public remainingPercentage(usage: {
    messagesUsed: number;
    aiTokensUsed: number;
    contactsUsed: number;
  }): number {
    const messagesRemaining =
      this.props.messages > 0
        ? ((this.props.messages - usage.messagesUsed) / this.props.messages) *
          100
        : 0;
    const aiTokensRemaining =
      this.props.aiTokens > 0
        ? ((this.props.aiTokens - usage.aiTokensUsed) / this.props.aiTokens) *
          100
        : 0;
    const contactsRemaining =
      this.props.contacts > 0
        ? ((this.props.contacts - usage.contactsUsed) / this.props.contacts) *
          100
        : 0;

    return Math.max(
      0,
      Math.min(messagesRemaining, aiTokensRemaining, contactsRemaining),
    );
  }

  public static reconstitute(
    messages: number,
    aiTokens: number,
    contacts: number,
  ): Quotas {
    return new Quotas({ messages, aiTokens, contacts });
  }

  public static create(plan: PlanType): Quotas {
    const quotas = getPlanQuotas(plan);
    return new Quotas(quotas);
  }
}
