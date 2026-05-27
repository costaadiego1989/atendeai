import { CatalogItemType } from '../value-objects/CatalogItemType';
import { Money } from '../value-objects/Money';

export interface CatalogItemProps {
  id: string;
  tenantId: string;
  categoryId?: string | null;
  categoryName?: string | null;
  type: string;
  name: string;
  description?: string | null;
  basePrice?: string | null;
  currency: string;
  tags: string[];
  active: boolean;
  source: string;
  externalReference?: string | null;
  imageUrl?: string | null;
  weightGrams?: number | null;
  heightCm?: number | null;
  widthCm?: number | null;
  lengthCm?: number | null;
  attributes: Record<string, unknown>;
  variants: Array<Record<string, unknown>>;
  optionGroups: Array<Record<string, unknown>>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * CatalogItem domain entity.
 * Encapsulates business rules and invariants for catalog items.
 */
export class CatalogItem {
  private constructor(private readonly props: CatalogItemProps) {}

  static create(props: CatalogItemProps): CatalogItem {
    CatalogItemType.create(props.type);

    if (!props.name || !props.name.trim()) {
      throw new Error('O nome do item é obrigatório.');
    }

    if (props.basePrice != null && props.basePrice.trim() !== '') {
      Money.create(props.basePrice, props.currency);
    }

    return new CatalogItem({
      ...props,
      name: props.name.trim(),
      description: props.description?.trim() || null,
    });
  }

  static fromPersistence(props: CatalogItemProps): CatalogItem {
    return new CatalogItem(props);
  }

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get categoryId(): string | null | undefined {
    return this.props.categoryId;
  }

  get categoryName(): string | null | undefined {
    return this.props.categoryName;
  }

  get type(): CatalogItemType {
    return CatalogItemType.fromRaw(this.props.type);
  }

  get typeValue(): string {
    return this.props.type;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | null | undefined {
    return this.props.description;
  }

  get basePrice(): Money | null {
    return Money.fromRaw(this.props.basePrice, this.props.currency);
  }

  get basePriceRaw(): string | null | undefined {
    return this.props.basePrice;
  }

  get currency(): string {
    return this.props.currency;
  }

  get tags(): string[] {
    return [...this.props.tags];
  }

  get active(): boolean {
    return this.props.active;
  }

  get source(): string {
    return this.props.source;
  }

  get externalReference(): string | null | undefined {
    return this.props.externalReference;
  }

  get imageUrl(): string | null | undefined {
    return this.props.imageUrl;
  }

  get weightGrams(): number | null | undefined {
    return this.props.weightGrams;
  }

  get heightCm(): number | null | undefined {
    return this.props.heightCm;
  }

  get widthCm(): number | null | undefined {
    return this.props.widthCm;
  }

  get lengthCm(): number | null | undefined {
    return this.props.lengthCm;
  }

  get attributes(): Record<string, unknown> {
    return this.props.attributes;
  }

  get variants(): Array<Record<string, unknown>> {
    return this.props.variants;
  }

  get optionGroups(): Array<Record<string, unknown>> {
    return this.props.optionGroups;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get isService(): boolean {
    return this.type.isService;
  }

  get isProduct(): boolean {
    return this.type.isProduct;
  }

  get hasVariants(): boolean {
    return this.props.variants.length > 0;
  }

  /**
   * Resolves a SKU for this item based on external reference or name.
   */
  resolveSku(reference?: string): string | undefined {
    const candidate = (reference ?? this.props.externalReference)?.trim();
    if (candidate) {
      return candidate.toUpperCase();
    }

    const normalized = this.props.name
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toUpperCase();

    return normalized || undefined;
  }

  /**
   * Returns a plain object representation for persistence/serialization.
   */
  toRecord(): CatalogItemProps {
    return { ...this.props };
  }
}
