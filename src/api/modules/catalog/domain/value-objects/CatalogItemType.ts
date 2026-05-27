/**
 * Value Object representing a catalog item type.
 * Enforces valid type values.
 */
export type CatalogItemTypeValue = 'PRODUCT' | 'SERVICE' | 'RENTAL';

const VALID_TYPES: CatalogItemTypeValue[] = ['PRODUCT', 'SERVICE', 'RENTAL'];

export class CatalogItemType {
  private constructor(public readonly value: CatalogItemTypeValue) {}

  static create(type: string): CatalogItemType {
    const upper = type.toUpperCase() as CatalogItemTypeValue;
    if (!VALID_TYPES.includes(upper)) {
      throw new Error(
        `Tipo de item inválido: "${type}". Valores aceitos: ${VALID_TYPES.join(', ')}.`,
      );
    }
    return new CatalogItemType(upper);
  }

  static fromRaw(type: string): CatalogItemType {
    return new CatalogItemType(type as CatalogItemTypeValue);
  }

  get isService(): boolean {
    return this.value === 'SERVICE';
  }

  get isProduct(): boolean {
    return this.value === 'PRODUCT';
  }

  get isRental(): boolean {
    return this.value === 'RENTAL';
  }

  equals(other: CatalogItemType): boolean {
    return this.value === other.value;
  }
}
