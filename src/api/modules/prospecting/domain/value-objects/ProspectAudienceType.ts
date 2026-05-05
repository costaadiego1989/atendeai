import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { ValueObject } from '@shared/domain/ValueObject';

export type ProspectAudienceType = 'REENGAGEMENT' | 'CONTACT_LIST';

interface ProspectAudienceTypeProps {
  value: ProspectAudienceType;
}

export class ProspectAudienceTypeVO extends ValueObject<ProspectAudienceTypeProps> {
  private constructor(props: ProspectAudienceTypeProps) {
    super(props);
  }

  get value(): ProspectAudienceType {
    return this.props.value;
  }

  public static create(value: string): ProspectAudienceTypeVO {
    const validTypes: ProspectAudienceType[] = [
      'REENGAGEMENT',
      'CONTACT_LIST',
    ];

    if (!validTypes.includes(value as ProspectAudienceType)) {
      throw new ValidationErrorException(
        `Invalid prospect audience type: ${value}`,
      );
    }

    return new ProspectAudienceTypeVO({
      value: value as ProspectAudienceType,
    });
  }
}
