import { ValueObject } from '@shared/domain/ValueObject';
import { ProposalTitleTooShortError } from '../errors/ProposalTitleTooShortError';

interface ProposalTitleProps {
  value: string;
}

export class ProposalTitle extends ValueObject<ProposalTitleProps> {
  private constructor(props: ProposalTitleProps) {
    super(props);
  }

  public static create(title: string): ProposalTitle {
    if (!title || title.trim().length < 3) {
      throw new ProposalTitleTooShortError();
    }
    return new ProposalTitle({ value: title.trim() });
  }

  get value(): string {
    return this.props.value;
  }
}
