import { ValueObject } from '../../../../shared/domain/ValueObject';

export type ContactStage =
  | 'LEAD'
  | 'PROSPECT'
  | 'OPPORTUNITY'
  | 'CUSTOMER'
  | 'INACTIVE';

interface ContactStageProps {
  value: ContactStage;
}

export class ContactStageVO extends ValueObject<ContactStageProps> {
  private constructor(props: ContactStageProps) {
    super(props);
  }

  get value(): ContactStage {
    return this.props.value;
  }

  public static create(value: string = 'LEAD'): ContactStageVO {
    const validStages = [
      'LEAD',
      'PROSPECT',
      'OPPORTUNITY',
      'CUSTOMER',
      'INACTIVE',
    ];
    if (!validStages.includes(value)) {
      throw new Error(`Invalid contact stage: ${value}`);
    }
    return new ContactStageVO({ value: value as ContactStage });
  }

  public isLead(): boolean {
    return this.props.value === 'LEAD';
  }
  public isProspect(): boolean {
    return this.props.value === 'PROSPECT';
  }
  public isOpportunity(): boolean {
    return this.props.value === 'OPPORTUNITY';
  }
  public isCustomer(): boolean {
    return this.props.value === 'CUSTOMER';
  }
}
