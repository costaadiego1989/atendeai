import { ValueObject } from '../../../../shared/domain/ValueObject';

interface PhoneNumberProps {
  value: string;
}

/**
 * Normalizes and validates phone numbers.
 * Strips spaces, dashes, parentheses, and leading "+".
 * Accepts digits-only strings of length 8–15 (E.164 range).
 */
export class PhoneNumber extends ValueObject<PhoneNumberProps> {
  private constructor(props: PhoneNumberProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  /**
   * Strip all non-digit characters (spaces, dashes, parens, "+").
   */
  public static normalize(raw: string): string {
    return raw.replace(/\D/g, '');
  }

  /**
   * Returns true when the digits-only string has 8–15 chars (E.164 range).
   */
  public static isValid(raw: string | undefined | null): boolean {
    if (!raw) return false;
    const digits = PhoneNumber.normalize(raw);
    return digits.length >= 8 && digits.length <= 15;
  }

  public static create(raw: string): PhoneNumber {
    if (!PhoneNumber.isValid(raw)) {
      throw new Error(
        `Invalid phone number "${raw}". Must contain 8–15 digits after stripping non-numeric characters.`,
      );
    }
    return new PhoneNumber({ value: PhoneNumber.normalize(raw) });
  }
}
