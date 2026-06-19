// catalog.unit-new.spec.ts — comprehensive unit tests for the catalog module
import { CatalogItem, CatalogItemProps } from '../domain/entities/CatalogItem';
import { CatalogCategory, CatalogCategoryProps } from '../domain/entities/CatalogCategory';
import { CatalogItemType } from '../domain/value-objects/CatalogItemType';
import { Money } from '../domain/value-objects/Money';

const makeItemProps = (overrides: Partial<CatalogItemProps> = {}): CatalogItemProps => ({
  id: 'item-1',
  tenantId: 'tenant-1',
  type: 'PRODUCT',
  name: 'Test Product',
  currency: 'BRL',
  tags: [],
  active: true,
  source: 'MANUAL',
  attributes: {},
  variants: [],
  optionGroups: [],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

const makeCategoryProps = (overrides: Partial<CatalogCategoryProps> = {}): CatalogCategoryProps => ({
  id: 'cat-1',
  tenantId: 'tenant-1',
  path: ['root'],
  level: 0,
  name: 'Category A',
  active: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

// ─── CatalogItemType ──────────────────────────────────────────────────────────
describe('CatalogItemType', () => {
  it('should create PRODUCT type', () => {
    const t = CatalogItemType.create('PRODUCT');
    expect(t.value).toBe('PRODUCT');
  });

  it('should create SERVICE type', () => {
    const t = CatalogItemType.create('SERVICE');
    expect(t.value).toBe('SERVICE');
  });

  it('should create RENTAL type', () => {
    const t = CatalogItemType.create('RENTAL');
    expect(t.value).toBe('RENTAL');
  });

  it('should accept lowercase input', () => {
    const t = CatalogItemType.create('product');
    expect(t.value).toBe('PRODUCT');
  });

  it('should accept mixed case input', () => {
    const t = CatalogItemType.create('Service');
    expect(t.value).toBe('SERVICE');
  });

  it('should throw for invalid type', () => {
    expect(() => CatalogItemType.create('INVALID')).toThrow();
  });

  it('should throw for empty string', () => {
    expect(() => CatalogItemType.create('')).toThrow();
  });

  it('should throw for numeric string', () => {
    expect(() => CatalogItemType.create('123')).toThrow();
  });

  it('should report isProduct correctly', () => {
    expect(CatalogItemType.create('PRODUCT').isProduct).toBe(true);
    expect(CatalogItemType.create('SERVICE').isProduct).toBe(false);
  });

  it('should report isService correctly', () => {
    expect(CatalogItemType.create('SERVICE').isService).toBe(true);
    expect(CatalogItemType.create('PRODUCT').isService).toBe(false);
  });

  it('should report isRental correctly', () => {
    expect(CatalogItemType.create('RENTAL').isRental).toBe(true);
    expect(CatalogItemType.create('SERVICE').isRental).toBe(false);
  });

  it('equals should return true for same type', () => {
    const a = CatalogItemType.create('PRODUCT');
    const b = CatalogItemType.create('PRODUCT');
    expect(a.equals(b)).toBe(true);
  });

  it('equals should return false for different types', () => {
    const a = CatalogItemType.create('PRODUCT');
    const b = CatalogItemType.create('SERVICE');
    expect(a.equals(b)).toBe(false);
  });

  it('fromRaw should create type from valid string', () => {
    const t = CatalogItemType.fromRaw('SERVICE');
    expect(t.value).toBe('SERVICE');
  });

  it('fromRaw should throw for invalid string', () => {
    expect(() => CatalogItemType.fromRaw('INVALID')).toThrow();
  });
});

// ─── Money ────────────────────────────────────────────────────────────────────
describe('Money', () => {
  it('should create money with valid amount', () => {
    const m = Money.create('10.50', 'BRL');
    expect(m).not.toBeNull();
    expect(m!.numericValue).toBe(10.5);
  });

  it('should accept comma as decimal separator', () => {
    const m = Money.create('10,50', 'BRL');
    expect(m!.numericValue).toBe(10.5);
  });

  it('should return null for null amount', () => {
    expect(Money.create(null)).toBeNull();
  });

  it('should return null for undefined amount', () => {
    expect(Money.create(undefined)).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(Money.create('')).toBeNull();
  });

  it('should throw for negative amount', () => {
    expect(() => Money.create('-5.00', 'BRL')).toThrow();
  });

  it('should throw for non-numeric string', () => {
    expect(() => Money.create('abc', 'BRL')).toThrow();
  });

  it('should accept zero price', () => {
    const m = Money.create('0', 'BRL');
    expect(m!.numericValue).toBe(0);
  });

  it('should default to BRL currency when none provided', () => {
    const m = Money.create('10.00');
    expect(m!.currency).toBe('BRL');
  });

  it('should respect provided currency', () => {
    const m = Money.create('10.00', 'USD');
    expect(m!.currency).toBe('USD');
  });

  it('equals should return true for same amount and currency', () => {
    const a = Money.create('10.00', 'BRL')!;
    const b = Money.create('10.00', 'BRL')!;
    expect(a.equals(b)).toBe(true);
  });

  it('equals should return false for different amounts', () => {
    const a = Money.create('10.00', 'BRL')!;
    const b = Money.create('20.00', 'BRL')!;
    expect(a.equals(b)).toBe(false);
  });

  it('equals should return false for different currencies', () => {
    const a = Money.create('10.00', 'BRL')!;
    const b = Money.create('10.00', 'USD')!;
    expect(a.equals(b)).toBe(false);
  });

  it('equals should return false when compared to null', () => {
    const a = Money.create('10.00', 'BRL')!;
    expect(a.equals(null)).toBe(false);
  });
});

// ─── CatalogItem ──────────────────────────────────────────────────────────────
describe('CatalogItem entity', () => {
  it('should create a valid product item', () => {
    const item = CatalogItem.create(makeItemProps());
    expect(item).toBeDefined();
    expect(item.name).toBe('Test Product');
  });

  it('should trim whitespace from name', () => {
    const item = CatalogItem.create(makeItemProps({ name: '  Trimmed Name  ' }));
    expect(item.name).toBe('Trimmed Name');
  });

  it('should throw for empty name', () => {
    expect(() => CatalogItem.create(makeItemProps({ name: '' }))).toThrow();
  });

  it('should throw for whitespace-only name', () => {
    expect(() => CatalogItem.create(makeItemProps({ name: '   ' }))).toThrow();
  });

  it('should throw for invalid item type', () => {
    expect(() => CatalogItem.create(makeItemProps({ type: 'INVALID' }))).toThrow();
  });

  it('should throw for negative base price', () => {
    expect(() => CatalogItem.create(makeItemProps({ basePrice: '-10.00' }))).toThrow();
  });

  it('should allow null base price (free/unlisted item)', () => {
    const item = CatalogItem.create(makeItemProps({ basePrice: null }));
    expect(item.basePrice).toBeNull();
  });

  it('should allow zero base price', () => {
    const item = CatalogItem.create(makeItemProps({ basePrice: '0.00' }));
    expect(item).toBeDefined();
  });

  it('should expose tenantId', () => {
    const item = CatalogItem.create(makeItemProps({ tenantId: 'tenant-abc' }));
    expect(item.tenantId).toBe('tenant-abc');
  });

  it('should expose type as PRODUCT', () => {
    const item = CatalogItem.create(makeItemProps({ type: 'PRODUCT' }));
    expect(item.type).toBe('PRODUCT');
  });

  it('should expose type as SERVICE', () => {
    const item = CatalogItem.create(makeItemProps({ type: 'SERVICE' }));
    expect(item.type).toBe('SERVICE');
  });

  it('should allow tags array', () => {
    const item = CatalogItem.create(makeItemProps({ tags: ['tag1', 'tag2'] }));
    expect(item.tags).toContain('tag1');
  });

  it('fromPersistence should not throw for valid props', () => {
    const item = CatalogItem.fromPersistence(makeItemProps());
    expect(item).toBeDefined();
  });

  it('should store imageUrl when provided', () => {
    const item = CatalogItem.create(makeItemProps({ imageUrl: 'https://example.com/img.png' }));
    expect(item.imageUrl).toBe('https://example.com/img.png');
  });

  it('should handle empty description gracefully', () => {
    const item = CatalogItem.create(makeItemProps({ description: '' }));
    expect(item.description).toBeNull();
  });

  it('should handle SQL injection in name by storing it as string (no interpretation)', () => {
    const name = "Product'; DROP TABLE catalog; --";
    const item = CatalogItem.create(makeItemProps({ name }));
    expect(item.name).toBe(name.trim());
  });

  it('should handle XSS attempt in description', () => {
    const item = CatalogItem.create(makeItemProps({ description: '<script>alert(1)</script>' }));
    expect(item.description).toBe('<script>alert(1)</script>');
  });
});

// ─── CatalogCategory ──────────────────────────────────────────────────────────
describe('CatalogCategory entity', () => {
  it('should create a valid root category', () => {
    const cat = CatalogCategory.create(makeCategoryProps());
    expect(cat.name).toBe('Category A');
  });

  it('should trim whitespace from name', () => {
    const cat = CatalogCategory.create(makeCategoryProps({ name: '  Food  ' }));
    expect(cat.name).toBe('Food');
  });

  it('should throw for empty name', () => {
    expect(() => CatalogCategory.create(makeCategoryProps({ name: '' }))).toThrow();
  });

  it('should throw for negative level', () => {
    expect(() => CatalogCategory.create(makeCategoryProps({ level: -1, path: [] }))).toThrow();
  });

  it('should throw when path length does not match level + 1', () => {
    expect(() => CatalogCategory.create(makeCategoryProps({ level: 0, path: [] }))).toThrow();
  });

  it('should create subcategory at level 1', () => {
    const cat = CatalogCategory.create(makeCategoryProps({ level: 1, path: ['root', 'sub'] }));
    expect(cat.level).toBe(1);
  });

  it('should expose id correctly', () => {
    const cat = CatalogCategory.create(makeCategoryProps({ id: 'cat-999' }));
    expect(cat.id).toBe('cat-999');
  });

  it('should expose tenantId', () => {
    const cat = CatalogCategory.create(makeCategoryProps({ tenantId: 'tenant-xyz' }));
    expect(cat.tenantId).toBe('tenant-xyz');
  });

  it('fromPersistence should not throw for valid props', () => {
    const cat = CatalogCategory.fromPersistence(makeCategoryProps());
    expect(cat).toBeDefined();
  });

  it('should handle deep path (level 4)', () => {
    const cat = CatalogCategory.create(makeCategoryProps({
      level: 4,
      path: ['a', 'b', 'c', 'd', 'e'],
    }));
    expect(cat.path).toHaveLength(5);
  });

  it('should store parentCategoryId when provided', () => {
    const cat = CatalogCategory.create(makeCategoryProps({ parentCategoryId: 'parent-1', level: 1, path: ['root', 'cat'] }));
    expect(cat.parentCategoryId).toBe('parent-1');
  });

  it('should allow null description', () => {
    const cat = CatalogCategory.create(makeCategoryProps({ description: null }));
    expect(cat.description).toBeNull();
  });
});
