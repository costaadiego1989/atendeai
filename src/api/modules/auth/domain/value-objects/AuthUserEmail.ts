import { ValueObject } from '@shared/domain/ValueObject';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';

interface AuthUserEmailProps {
  value: string;
}

export class AuthUserEmail extends ValueObject<AuthUserEmailProps> {
  private constructor(props: AuthUserEmailProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  public static create(email: string): AuthUserEmail {
    if (!email || !email.includes('@')) {
      throw new ValidationErrorException('Invalid email');
    }
    return new AuthUserEmail({ value: email.toLowerCase().trim() });
  }
}
