import { ValueObject } from '../../../../shared/domain/ValueObject.js';

interface CompanyNameProps {
  value: string;
}

export class CompanyName extends ValueObject<CompanyNameProps> {
  private constructor(props: CompanyNameProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  public static create(name: string): CompanyName {
    if (!name || name.trim().length < 2) {
      throw new Error('Company name must have at least 2 characters');
    }
    if (name.trim().length > 255) {
      throw new Error('Company name must have at most 255 characters');
    }
    return new CompanyName({ value: name.trim() });
  }
}
