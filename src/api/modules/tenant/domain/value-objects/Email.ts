import { ValueObject } from '../../../../shared/domain/ValueObject.js';
import { ValidationErrorException } from '../../../../shared/domain/exceptions/DomainExceptions';

interface EmailProps {
  value: string;
}

export class Email extends ValueObject<EmailProps> {
  private constructor(props: EmailProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  public static create(email: string): Email {
    const trimmed = email?.trim().toLowerCase();
    if (!trimmed || !Email.isValid(trimmed)) {
      throw new ValidationErrorException('Invalid email address');
    }
    return new Email({ value: trimmed });
  }

  private static isValid(email: string): boolean {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }
}
