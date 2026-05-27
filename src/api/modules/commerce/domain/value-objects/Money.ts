import { ValueObject } from '@shared/domain/ValueObject';

interface MoneyProps {
  amount: number;
  currency: string;
}

export class Money extends ValueObject<MoneyProps> {
  private constructor(props: MoneyProps) {
    super(props);
  }

  static create(amount: number, currency = 'BRL'): Money {
    if (!Number.isFinite(amount)) {
      throw new Error('Money amount must be a finite number');
    }
    const rounded = Math.round(amount * 100) / 100;
    return new Money({ amount: rounded, currency: currency.toUpperCase() });
  }

  static zero(currency = 'BRL'): Money {
    return new Money({ amount: 0, currency: currency.toUpperCase() });
  }

  get amount(): number {
    return this.props.amount;
  }

  get currency(): string {
    return this.props.currency;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.create(
      this.props.amount + other.props.amount,
      this.props.currency,
    );
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.create(
      this.props.amount - other.props.amount,
      this.props.currency,
    );
  }

  multiply(factor: number): Money {
    if (!Number.isFinite(factor)) {
      throw new Error('Multiplication factor must be a finite number');
    }
    return Money.create(this.props.amount * factor, this.props.currency);
  }

  isZero(): boolean {
    return this.props.amount === 0;
  }

  isPositive(): boolean {
    return this.props.amount > 0;
  }

  isNegative(): boolean {
    return this.props.amount < 0;
  }

  private assertSameCurrency(other: Money): void {
    if (this.props.currency !== other.props.currency) {
      throw new Error(
        `Cannot operate on different currencies: ${this.props.currency} vs ${other.props.currency}`,
      );
    }
  }
}
