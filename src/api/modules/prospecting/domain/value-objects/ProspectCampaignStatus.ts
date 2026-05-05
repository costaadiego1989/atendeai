import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { ValueObject } from '@shared/domain/ValueObject';

export type ProspectCampaignStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'ARCHIVED';

interface ProspectCampaignStatusProps {
  value: ProspectCampaignStatus;
}

export class ProspectCampaignStatusVO extends ValueObject<ProspectCampaignStatusProps> {
  private constructor(props: ProspectCampaignStatusProps) {
    super(props);
  }

  get value(): ProspectCampaignStatus {
    return this.props.value;
  }

  public static create(value: string = 'DRAFT'): ProspectCampaignStatusVO {
    const validStatuses: ProspectCampaignStatus[] = [
      'DRAFT',
      'ACTIVE',
      'PAUSED',
      'COMPLETED',
      'ARCHIVED',
    ];

    if (!validStatuses.includes(value as ProspectCampaignStatus)) {
      throw new ValidationErrorException(
        `Invalid prospect campaign status: ${value}`,
      );
    }

    return new ProspectCampaignStatusVO({
      value: value as ProspectCampaignStatus,
    });
  }
}
