import { ValueObject } from '../../../../shared/domain/ValueObject';

interface ContactNameProps {
  value: string;
}

export class ContactName extends ValueObject<ContactNameProps> {
  private constructor(props: ContactNameProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  public static create(name: string): ContactName {
    if (!name || name.length < 3) {
      throw new Error('Contact name must be at least 3 characters long');
    }
    return new ContactName({ value: name });
  }
}
