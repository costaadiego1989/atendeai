import { ValueObject } from '../../../../shared/domain/ValueObject.js';
import { ValidationErrorException } from '../../../../shared/domain/exceptions/DomainExceptions';

interface PhoneProps {
  value: string;
}

export class Phone extends ValueObject<PhoneProps> {
  private constructor(props: PhoneProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  public static create(phone: string): Phone {
    const cleaned = phone.replace(/\D/g, '');

    if (!/^\+?[1-9]\d{1,14}$/.test(cleaned)) {
      throw new ValidationErrorException(
        'Invalid phone number format. Must be international format (e.g., +5511999999999)',
      );
    }

    const formatted = cleaned.startsWith('55')
      ? `+${cleaned}`
      : `+55${cleaned}`;

    return new Phone({ value: formatted });
  }
}
