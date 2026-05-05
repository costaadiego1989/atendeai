import { ValueObject } from './ValueObject';
import { ValidationErrorException } from './exceptions/DomainExceptions';

interface CPFProps {
  value: string;
}

export class CPF extends ValueObject<CPFProps> {
  private constructor(props: CPFProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  public toClean(): string {
    return this.props.value.replace(/\D/g, '');
  }

  public static create(cpf: string): CPF {
    const cleaned = cpf.replace(/\D/g, '');

    if (cleaned.length !== 11) {
      throw new ValidationErrorException('CPF must have 11 digits');
    }

    if (!CPF.isValid(cleaned)) {
      throw new ValidationErrorException('Invalid CPF');
    }

    return new CPF({ value: CPF.format(cleaned) });
  }

  private static isValid(cpf: string): boolean {
    if (/^(\d)\1{10}$/.test(cpf)) {
      return false;
    }

    const calcDigit = (base: string, factor: number): number => {
      let total = 0;

      for (const digit of base) {
        total += Number(digit) * factor--;
      }

      const remainder = total % 11;
      return remainder < 2 ? 0 : 11 - remainder;
    };

    const digit1 = calcDigit(cpf.slice(0, 9), 10);
    const digit2 = calcDigit(cpf.slice(0, 10), 11);

    return digit1 === Number(cpf[9]) && digit2 === Number(cpf[10]);
  }

  private static format(cpf: string): string {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
}
