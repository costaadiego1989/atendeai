import { ValueObject } from '../../../../shared/domain/ValueObject.js';
import { ValidationErrorException } from '../../../../shared/domain/exceptions/DomainExceptions';

interface CNPJProps {
  value: string;
}

export class CNPJ extends ValueObject<CNPJProps> {
  private constructor(props: CNPJProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  public static create(cnpj: string): CNPJ {
    const cleaned = cnpj.replace(/\D/g, '');

    if (cleaned.length !== 14) {
      throw new ValidationErrorException('CNPJ must have 14 digits');
    }

    if (!CNPJ.isValid(cleaned)) {
      throw new ValidationErrorException('Invalid CNPJ');
    }

    return new CNPJ({ value: CNPJ.format(cleaned) });
  }

  private static isValid(cnpj: string): boolean {
    if (/^(\d)\1+$/.test(cnpj)) return false;

    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    const calcDigit = (digits: string, weights: number[]): number => {
      const sum = weights.reduce(
        (acc, weight, i) => acc + parseInt(digits[i], 10) * weight,
        0,
      );
      const rest = sum % 11;
      return rest < 2 ? 0 : 11 - rest;
    };

    const digit1 = calcDigit(cnpj, weights1);
    const digit2 = calcDigit(cnpj, weights2);

    return (
      parseInt(cnpj[12], 10) === digit1 && parseInt(cnpj[13], 10) === digit2
    );
  }

  private static format(cnpj: string): string {
    return cnpj.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      '$1.$2.$3/$4-$5',
    );
  }

  public toClean(): string {
    return this.props.value.replace(/\D/g, '');
  }
}
