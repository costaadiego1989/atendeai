import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';
import { ValueObject } from '@shared/domain/ValueObject';

export type ProspectChannel = 'WHATSAPP' | 'INSTAGRAM';

interface ProspectChannelProps {
  value: ProspectChannel;
}

export class ProspectChannelVO extends ValueObject<ProspectChannelProps> {
  private constructor(props: ProspectChannelProps) {
    super(props);
  }

  get value(): ProspectChannel {
    return this.props.value;
  }

  public static create(value: string = 'WHATSAPP'): ProspectChannelVO {
    const validChannels: ProspectChannel[] = ['WHATSAPP', 'INSTAGRAM'];

    if (!validChannels.includes(value as ProspectChannel)) {
      throw new ValidationErrorException(`Invalid prospect channel: ${value}`);
    }

    return new ProspectChannelVO({
      value: value as ProspectChannel,
    });
  }
}
