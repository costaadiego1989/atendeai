import { ValueObject } from '@shared/domain/ValueObject';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';

export type ProspectSearchSource = 'GOOGLE_PLACES' | 'GOOGLE_ADS_AUDIENCE';

interface ProspectSearchSourceProps {
  value: ProspectSearchSource;
}

export class ProspectSearchSourceVO extends ValueObject<ProspectSearchSourceProps> {
  private constructor(props: ProspectSearchSourceProps) {
    super(props);
  }

  get value(): ProspectSearchSource {
    return this.props.value;
  }

  public static create(value: string): ProspectSearchSourceVO {
    const normalized = value.toUpperCase().trim() as ProspectSearchSource;
    const validValues: ProspectSearchSource[] = [
      'GOOGLE_PLACES',
      'GOOGLE_ADS_AUDIENCE',
    ];

    if (!validValues.includes(normalized)) {
      throw new ValidationErrorException(
        `Invalid prospect search source: ${value}`,
      );
    }

    return new ProspectSearchSourceVO({ value: normalized });
  }
}
