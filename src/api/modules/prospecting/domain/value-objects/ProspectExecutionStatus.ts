import { ValueObject } from '@shared/domain/ValueObject';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';

export type ProspectExecutionStatus =
  | 'PENDING'
  | 'CONTACTED'
  | 'RESPONDED'
  | 'STOPPED'
  | 'FAILED';

interface ProspectExecutionStatusProps {
  value: ProspectExecutionStatus;
}

export class ProspectExecutionStatusVO extends ValueObject<ProspectExecutionStatusProps> {
  private constructor(props: ProspectExecutionStatusProps) {
    super(props);
  }

  get value(): ProspectExecutionStatus {
    return this.props.value;
  }

  public static create(value: string = 'PENDING'): ProspectExecutionStatusVO {
    const validStatuses: ProspectExecutionStatus[] = [
      'PENDING',
      'CONTACTED',
      'RESPONDED',
      'STOPPED',
      'FAILED',
    ];

    if (!validStatuses.includes(value as ProspectExecutionStatus)) {
      throw new ValidationErrorException(
        `Invalid prospect execution status: ${value}`,
      );
    }

    return new ProspectExecutionStatusVO({
      value: value as ProspectExecutionStatus,
    });
  }
}
