import { ValueObject } from '@shared/domain/ValueObject';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';

export type ProspectSearchStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED';

interface ProspectSearchStatusProps {
  value: ProspectSearchStatus;
}

export class ProspectSearchStatusVO extends ValueObject<ProspectSearchStatusProps> {
  private constructor(props: ProspectSearchStatusProps) {
    super(props);
  }

  get value(): ProspectSearchStatus {
    return this.props.value;
  }

  public static create(value: string): ProspectSearchStatusVO {
    const normalized = value.toUpperCase().trim() as ProspectSearchStatus;
    const validValues: ProspectSearchStatus[] = [
      'PENDING',
      'RUNNING',
      'COMPLETED',
      'FAILED',
    ];

    if (!validValues.includes(normalized)) {
      throw new ValidationErrorException(
        `Invalid prospect search status: ${value}`,
      );
    }

    return new ProspectSearchStatusVO({ value: normalized });
  }
}
