export interface CatalogCategoryProps {
  id: string;
  tenantId: string;
  parentCategoryId?: string | null;
  parentCategoryName?: string | null;
  path: string[];
  level: number;
  name: string;
  description?: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * CatalogCategory domain entity.
 * Encapsulates business rules and invariants for catalog categories.
 */
export class CatalogCategory {
  private constructor(private readonly props: CatalogCategoryProps) {}

  static create(props: CatalogCategoryProps): CatalogCategory {
    if (!props.name || !props.name.trim()) {
      throw new Error('O nome da categoria é obrigatório.');
    }

    if (props.level < 0) {
      throw new Error('O nível da categoria não pode ser negativo.');
    }

    if (props.path.length !== props.level + 1) {
      throw new Error(
        'O path da categoria deve ter comprimento igual ao nível + 1.',
      );
    }

    return new CatalogCategory({
      ...props,
      name: props.name.trim(),
      description: props.description?.trim() || null,
    });
  }

  static fromPersistence(props: CatalogCategoryProps): CatalogCategory {
    return new CatalogCategory(props);
  }

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get parentCategoryId(): string | null | undefined {
    return this.props.parentCategoryId;
  }

  get parentCategoryName(): string | null | undefined {
    return this.props.parentCategoryName;
  }

  get path(): string[] {
    return [...this.props.path];
  }

  get level(): number {
    return this.props.level;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | null | undefined {
    return this.props.description;
  }

  get active(): boolean {
    return this.props.active;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get isRoot(): boolean {
    return this.props.level === 0;
  }

  get isChild(): boolean {
    return this.props.level > 0;
  }

  /**
   * Checks if this category is a descendant of the given category ID.
   */
  isDescendantOf(categoryId: string): boolean {
    return this.props.path.includes(categoryId);
  }

  /**
   * Returns a plain object representation for persistence/serialization.
   */
  toRecord(): CatalogCategoryProps {
    return { ...this.props };
  }
}
