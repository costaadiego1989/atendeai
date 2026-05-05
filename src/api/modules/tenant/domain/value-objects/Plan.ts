import { ValueObject } from '../../../../shared/domain/ValueObject.js';
import { ValidationErrorException } from '../../../../shared/domain/exceptions/DomainExceptions';

export type PlanType = 'ESSENCIAL' | 'PROFISSIONAL' | 'ESCALA' | 'TRIAL';

interface PlanProps {
  value: PlanType;
}

export class Plan extends ValueObject<PlanProps> {
  private constructor(props: PlanProps) {
    super(props);
  }

  get value(): PlanType {
    return this.props.value;
  }

  public static create(plan: string): Plan {
    const validPlans: PlanType[] = ['ESSENCIAL', 'PROFISSIONAL', 'ESCALA', 'TRIAL'];
    const upper = plan.toUpperCase() as PlanType;

    if (!validPlans.includes(upper)) {
      throw new ValidationErrorException(
        `Invalid plan: ${plan}. Valid options: ${validPlans.join(', ')}`,
      );
    }

    return new Plan({ value: upper });
  }

  public static essencial(): Plan {
    return new Plan({ value: 'ESSENCIAL' });
  }

  public isEssencial(): boolean {
    return this.props.value === 'ESSENCIAL';
  }

  public isProfissional(): boolean {
    return this.props.value === 'PROFISSIONAL';
  }

  public isEscala(): boolean {
    return this.props.value === 'ESCALA';
  }

  public static trial(): Plan {
    return new Plan({ value: 'TRIAL' });
  }

  public isTrial(): boolean {
    return this.props.value === 'TRIAL';
  }
}
