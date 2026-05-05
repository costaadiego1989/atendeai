import { ValueObject } from '@shared/domain/ValueObject';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';

export type ProspectStopReason =
  | 'OPT_OUT'
  | 'HUMAN_HANDOFF'
  | 'DISQUALIFIED'
  | 'CAMPAIGN_PAUSED';

interface ProspectStopReasonProps {
  value: ProspectStopReason;
}

export class ProspectStopReasonVO extends ValueObject<ProspectStopReasonProps> {
  private constructor(props: ProspectStopReasonProps) {
    super(props);
  }

  get value(): ProspectStopReason {
    return this.props.value;
  }

  public static create(value: string): ProspectStopReasonVO {
    const validReasons: ProspectStopReason[] = [
      'OPT_OUT',
      'HUMAN_HANDOFF',
      'DISQUALIFIED',
      'CAMPAIGN_PAUSED',
    ];

    const normalized = value.toUpperCase() as ProspectStopReason;

    if (!validReasons.includes(normalized)) {
      throw new ValidationErrorException(
        `Invalid prospect stop reason: ${value}`,
      );
    }

    return new ProspectStopReasonVO({ value: normalized });
  }
}
