import { CatalogInvalidPriceError } from '../errors/CatalogInvalidPriceError';

/**
 * Value Object representing a monetary amount in the catalog domain.
 * Immutable — all operations return new instances.
 */
export class Money {
  private constructor(
    public readonly amount: string,
    public readonly currency: string,
  ) {}

  static create(
    amount: string | undefined | null,
    currency?: string,
  ): Money | null {
    if (amount == null || amount.trim() === '') {
      return null;
    }

    const normalized = amount.replace(',', '.');
    const parsed = Number(normalized);

    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new CatalogInvalidPriceError(parsed);
    }

    return new Money(normalized, currency ?? 'BRL');
  }

  static fromRaw(
    amount: string | null | undefined,
    currency: string,
  ): Money | null {
    if (amount == null || amount.trim() === '') {
      return null;
    }
    return new Money(amount, currency);
  }

  get numericValue(): number {
    return Number(this.amount);
  }

  equals(other: Money | null): boolean {
    if (!other) return false;
    return this.amount === other.amount && this.currency === other.currency;
  }
}
