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
