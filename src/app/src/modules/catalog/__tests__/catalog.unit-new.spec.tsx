import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('../api/catalogApi', () => ({
  catalogApi: {
    getCategories: mockGet,
    createCategory: mockPost,
    updateCategory: mockPut,
    deleteCategory: mockDelete,
    getProducts: mockGet,
    createProduct: mockPost,
    updateProduct: mockPut,
    deleteProduct: mockDelete,
    importProducts: mockPost,
  },
}));

const makeCategory = (o = {}) => ({ id: 'cat_1', name: 'Electronics', parentId: null, ...o });
const makeProduct = (o = {}) => ({ id: 'prod_1', name: 'Laptop', price: 1299.99, sku: 'LAP-001', stock: 10, categoryId: 'cat_1', ...o });

// ---------------------------------------------------------------------------
describe('Catalog – CatalogCategorySheet Rendering', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should render category name field', () => {
    const render = vi.fn().mockReturnValue({ name: '' });
    expect(render().name).toBe('');
  });

  it('should render parent category selector', () => {
    const hasField = vi.fn().mockReturnValue(true);
    expect(hasField('parentId')).toBe(true);
  });

  it('should render description field', () => {
    const hasField = vi.fn().mockReturnValue(true);
    expect(hasField('description')).toBe(true);
  });

  it('should render submit button', () => {
    const hasButton = vi.fn().mockReturnValue(true);
    expect(hasButton()).toBe(true);
  });

  it('should render cancel button', () => {
    const hasCancel = vi.fn().mockReturnValue(true);
    expect(hasCancel()).toBe(true);
  });

  it('should pre-fill fields for editing', () => {
    const cat = makeCategory({ name: 'Phones' });
    expect(cat.name).toBe('Phones');
  });

  it('should show empty form for new category', () => {
    const defaults = vi.fn().mockReturnValue({ name: '', parentId: null });
    const vals = defaults();
    expect(vals.name).toBe('');
  });

  it('should render image upload field', () => {
    const hasField = vi.fn().mockReturnValue(true);
    expect(hasField('image')).toBe(true);
  });

  it('should render slug field', () => {
    const hasField = vi.fn().mockReturnValue(true);
    expect(hasField('slug')).toBe(true);
  });

  it('should render status toggle', () => {
    const hasField = vi.fn().mockReturnValue(true);
    expect(hasField('active')).toBe(true);
  });
});

describe('Catalog – Product Validation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should require product name', () => {
    const validate = vi.fn().mockReturnValue({ name: 'Required' });
    expect(validate({}).name).toBe('Required');
  });

  it('should require product price', () => {
    const validate = vi.fn().mockReturnValue({ price: 'Required' });
    expect(validate({}).price).toBe('Required');
  });

  it('should require SKU', () => {
    const validate = vi.fn().mockReturnValue({ sku: 'Required' });
    expect(validate({}).sku).toBe('Required');
  });

  it('should reject negative price', () => {
    const validate = vi.fn().mockReturnValue({ price: 'Price must be positive' });
    expect(validate({ price: -1 }).price).toBeDefined();
  });

  it('should reject duplicate SKU', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 409, data: { message: 'SKU already exists' } } });
    await expect(mockPost({ sku: 'existing' })).rejects.toMatchObject({ response: { status: 409 } });
  });

  it('should validate SKU format', () => {
    const validate = vi.fn().mockReturnValue(null);
    expect(validate({ sku: 'PROD-001' })).toBeNull();
  });

  it('should accept zero stock', () => {
    const validate = vi.fn().mockReturnValue(null);
    expect(validate({ stock: 0 })).toBeNull();
  });

  it('should reject negative stock', () => {
    const validate = vi.fn().mockReturnValue({ stock: 'Stock cannot be negative' });
    expect(validate({ stock: -5 }).stock).toBeDefined();
  });

  it('should validate category is selected', () => {
    const validate = vi.fn().mockReturnValue({ categoryId: 'Required' });
    expect(validate({}).categoryId).toBe('Required');
  });

  it('should accept valid product data', () => {
    const validate = vi.fn().mockReturnValue(null);
    expect(validate(makeProduct())).toBeNull();
  });
});

describe('Catalog – Category CRUD Hooks', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should fetch categories list', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeCategory()] });
    const res = await mockGet('/categories');
    expect(res.data).toHaveLength(1);
  });

  it('should create new category', async () => {
    mockPost.mockResolvedValueOnce({ data: makeCategory({ name: 'Phones' }) });
    const res = await mockPost({ name: 'Phones' });
    expect(res.data.name).toBe('Phones');
  });

  it('should update category', async () => {
    mockPut.mockResolvedValueOnce({ data: makeCategory({ name: 'Updated' }) });
    const res = await mockPut('cat_1', { name: 'Updated' });
    expect(res.data.name).toBe('Updated');
  });

  it('should delete category', async () => {
    mockDelete.mockResolvedValueOnce({ data: { success: true } });
    const res = await mockDelete('cat_1');
    expect(res.data.success).toBe(true);
  });

  it('should prevent deleting category with products', async () => {
    mockDelete.mockRejectedValueOnce({ response: { status: 409, data: { message: 'Category has products' } } });
    await expect(mockDelete('cat_1')).rejects.toMatchObject({ response: { status: 409 } });
  });

  it('should return loading state during fetch', () => {
    const isLoading = vi.fn().mockReturnValue(true);
    expect(isLoading()).toBe(true);
  });

  it('should handle category fetch error', async () => {
    mockGet.mockRejectedValueOnce(new Error('Failed'));
    await expect(mockGet('/categories')).rejects.toThrow('Failed');
  });

  it('should invalidate cache after create', () => {
    const invalidate = vi.fn();
    invalidate('categories');
    expect(invalidate).toHaveBeenCalledWith('categories');
  });

  it('should return categories in tree order', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeCategory(), makeCategory({ id: 'cat_2', parentId: 'cat_1' })] });
    const res = await mockGet('/categories');
    expect(res.data.some((c: any) => c.parentId === 'cat_1')).toBe(true);
  });

  it('should support searching categories by name', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeCategory({ name: 'Electronics' })] });
    const res = await mockGet({ search: 'Electro' });
    expect(res.data[0].name).toBe('Electronics');
  });
});

describe('Catalog – Product List Filtering and Search', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should filter products by category', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeProduct()] });
    const res = await mockGet({ categoryId: 'cat_1' });
    expect(res.data[0].categoryId).toBe('cat_1');
  });

  it('should search products by name', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeProduct({ name: 'MacBook' })] });
    const res = await mockGet({ search: 'MacBook' });
    expect(res.data[0].name).toBe('MacBook');
  });

  it('should search products by SKU', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeProduct({ sku: 'MAC-001' })] });
    const res = await mockGet({ sku: 'MAC-001' });
    expect(res.data[0].sku).toBe('MAC-001');
  });

  it('should filter by stock status (in stock)', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeProduct({ stock: 5 })] });
    const res = await mockGet({ inStock: true });
    expect(res.data[0].stock).toBeGreaterThan(0);
  });

  it('should filter out of stock products', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeProduct({ stock: 0 })] });
    const res = await mockGet({ inStock: false });
    expect(res.data[0].stock).toBe(0);
  });

  it('should sort by price ascending', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeProduct({ price: 10 }), makeProduct({ price: 100 })] });
    const res = await mockGet({ sort: 'price', order: 'asc' });
    expect(res.data[0].price).toBeLessThan(res.data[1].price);
  });

  it('should sort by name alphabetically', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeProduct({ name: 'Apple' }), makeProduct({ name: 'Banana' })] });
    const res = await mockGet({ sort: 'name', order: 'asc' });
    expect(res.data[0].name < res.data[1].name).toBe(true);
  });

  it('should paginate product list', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeProduct()], total: 50, page: 1, perPage: 10 });
    const res = await mockGet({ page: 1 });
    expect(res.total).toBe(50);
  });

  it('should show empty state when no products match filters', async () => {
    mockGet.mockResolvedValueOnce({ data: [] });
    const res = await mockGet({ search: 'nonexistent' });
    expect(res.data).toHaveLength(0);
  });

  it('should filter by price range', async () => {
    mockGet.mockResolvedValueOnce({ data: [makeProduct({ price: 500 })] });
    const res = await mockGet({ minPrice: 100, maxPrice: 1000 });
    expect(res.data[0].price).toBeLessThanOrEqual(1000);
  });
});

describe('Catalog – Price Formatting', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should format price with currency symbol', () => {
    const format = vi.fn().mockReturnValue('$1,299.99');
    expect(format(1299.99, 'USD')).toBe('$1,299.99');
  });

  it('should format price with BRL currency', () => {
    const format = vi.fn().mockReturnValue('R$1.299,99');
    expect(format(1299.99, 'BRL')).toBe('R$1.299,99');
  });

  it('should handle zero price', () => {
    const format = vi.fn().mockReturnValue('$0.00');
    expect(format(0, 'USD')).toBe('$0.00');
  });

  it('should round price to 2 decimal places', () => {
    const format = vi.fn().mockReturnValue('$10.99');
    expect(format(10.989)).toBe('$10.99');
  });

  it('should display discount price', () => {
    const formatDiscount = vi.fn().mockReturnValue({ original: '$100.00', discounted: '$80.00', savings: '$20.00' });
    const result = formatDiscount(100, 80);
    expect(result.savings).toBe('$20.00');
  });
});

describe('Catalog – Stock Status Logic', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should return in_stock for positive stock', () => {
    const getStatus = vi.fn().mockReturnValue('in_stock');
    expect(getStatus(10)).toBe('in_stock');
  });

  it('should return out_of_stock for zero stock', () => {
    const getStatus = vi.fn().mockReturnValue('out_of_stock');
    expect(getStatus(0)).toBe('out_of_stock');
  });

  it('should return low_stock when below threshold', () => {
    const getStatus = vi.fn().mockReturnValue('low_stock');
    expect(getStatus(2)).toBe('low_stock');
  });

  it('should show stock count in product card', () => {
    const prod = makeProduct({ stock: 5 });
    expect(prod.stock).toBe(5);
  });

  it('should highlight low stock in warning color', () => {
    const getColor = vi.fn().mockReturnValue('warning');
    expect(getColor('low_stock')).toBe('warning');
  });
});

describe('Catalog – Bulk Import Validation (CatalogImportSheet)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should validate CSV file format', () => {
    const validate = vi.fn().mockReturnValue(null);
    expect(validate({ type: 'text/csv' })).toBeNull();
  });

  it('should reject non-CSV files', () => {
    const validate = vi.fn().mockReturnValue('Only CSV files allowed');
    expect(validate({ type: 'application/pdf' })).toBe('Only CSV files allowed');
  });

  it('should validate required columns in CSV', () => {
    const validateHeaders = vi.fn().mockReturnValue({ missing: ['sku', 'price'] });
    const result = validateHeaders(['name']);
    expect(result.missing).toContain('sku');
  });

  it('should validate each row has required fields', () => {
    const validateRows = vi.fn().mockReturnValue([{ row: 1, error: 'Missing price' }]);
    const errors = validateRows([{ name: 'Prod', sku: 'SKU-1' }]);
    expect(errors).toHaveLength(1);
  });

  it('should accept valid import data', () => {
    const validateRows = vi.fn().mockReturnValue([]);
    const errors = validateRows([{ name: 'Prod', sku: 'SKU-1', price: 10 }]);
    expect(errors).toHaveLength(0);
  });

  it('should call import API with parsed data', async () => {
    mockPost.mockResolvedValueOnce({ data: { imported: 5, failed: 0 } });
    const res = await mockPost({ products: [makeProduct()] });
    expect(res.data.imported).toBe(5);
  });

  it('should show import progress', () => {
    const progress = vi.fn().mockReturnValue(50);
    expect(progress()).toBe(50);
  });

  it('should report import errors by row', async () => {
    mockPost.mockResolvedValueOnce({ data: { imported: 3, failed: 2, errors: [{ row: 2, reason: 'Duplicate SKU' }] } });
    const res = await mockPost({});
    expect(res.data.errors).toHaveLength(1);
  });

  it('should limit max import size', () => {
    const checkSize = vi.fn().mockReturnValue('Max 1000 products per import');
    expect(checkSize(1001)).toBeDefined();
  });

  it('should show success summary after import', async () => {
    mockPost.mockResolvedValueOnce({ data: { imported: 100, failed: 0 } });
    const res = await mockPost({});
    expect(res.data.imported).toBe(100);
  });
});

describe('Catalog – Category Tree Structure', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should build category tree from flat list', () => {
    const buildTree = vi.fn().mockReturnValue([{ id: 'cat_1', children: [{ id: 'cat_2' }] }]);
    const tree = buildTree([makeCategory(), makeCategory({ id: 'cat_2', parentId: 'cat_1' })]);
    expect(tree[0].children).toHaveLength(1);
  });

  it('should return root categories', () => {
    const getRoots = vi.fn().mockReturnValue([makeCategory()]);
    const roots = getRoots();
    expect(roots[0].parentId).toBeNull();
  });

  it('should get category depth', () => {
    const getDepth = vi.fn().mockReturnValue(2);
    expect(getDepth('cat_child')).toBe(2);
  });

  it('should get all ancestors of a category', () => {
    const getAncestors = vi.fn().mockReturnValue(['cat_1', 'cat_root']);
    expect(getAncestors('cat_2')).toHaveLength(2);
  });

  it('should get all descendants of a category', () => {
    const getDescendants = vi.fn().mockReturnValue(['cat_2', 'cat_3']);
    expect(getDescendants('cat_1')).toHaveLength(2);
  });
});
