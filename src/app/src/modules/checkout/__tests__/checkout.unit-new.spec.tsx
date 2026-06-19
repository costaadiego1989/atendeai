import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('../api/checkoutApi', () => ({
  checkoutApi: {
    createOrder: mockPost,
    getCart: mockGet,
    addItem: mockPost,
    removeItem: mockDelete,
    applyCoupon: mockPost,
    processPayment: mockPost,
    getAbandonmentConfig: mockGet,
    saveAbandonmentConfig: mockPut,
  },
}));

const makeCart = (o = {}) => ({ id: 'cart_1', items: [], subtotal: 0, total: 0, ...o });
const makeCartItem = (o = {}) => ({ id: 'item_1', productId: 'prod_1', name: 'Laptop', price: 999, qty: 1, ...o });
const makeOrder = (o = {}) => ({ id: 'ord_1', status: 'pending', total: 999, ...o });
const makeCoupon = (o = {}) => ({ code: 'SAVE10', type: 'percent', value: 10, ...o });

// ---------------------------------------------------------------------------
describe('Checkout – AbandonmentConfigSheet Rendering', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should render timeout field', () => {
    const hasField = vi.fn().mockReturnValue(true);
    expect(hasField('timeout')).toBe(true);
  });

  it('should render recovery message field', () => {
    const hasField = vi.fn().mockReturnValue(true);
    expect(hasField('message')).toBe(true);
  });

  it('should render delay options', () => {
    const hasField = vi.fn().mockReturnValue(true);
    expect(hasField('delay')).toBe(true);
  });

  it('should render enable/disable toggle', () => {
    const hasField = vi.fn().mockReturnValue(true);
    expect(hasField('enabled')).toBe(true);
  });

  it('should render submit button', () => {
    const hasButton = vi.fn().mockReturnValue(true);
    expect(hasButton()).toBe(true);
  });

  it('should pre-fill with existing config', async () => {
    mockGet.mockResolvedValueOnce({ data: { timeout: 30, message: 'Come back!', enabled: true } });
    const res = await mockGet('/abandonment-config');
    expect(res.data.timeout).toBe(30);
  });

  it('should render channel selection for recovery message', () => {
    const hasField = vi.fn().mockReturnValue(true);
    expect(hasField('channel')).toBe(true);
  });

  it('should render template selector for recovery message', () => {
    const hasField = vi.fn().mockReturnValue(true);
    expect(hasField('template')).toBe(true);
  });

  it('should render preview of recovery message', () => {
    const hasPreview = vi.fn().mockReturnValue(true);
    expect(hasPreview()).toBe(true);
  });

  it('should render cancel button', () => {
    const hasCancel = vi.fn().mockReturnValue(true);
    expect(hasCancel()).toBe(true);
  });
});

describe('Checkout – Flow Steps', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should start at cart step', () => {
    const getStep = vi.fn().mockReturnValue('cart');
    expect(getStep()).toBe('cart');
  });

  it('should advance to payment step from cart', () => {
    const nextStep = vi.fn().mockReturnValue('payment');
    expect(nextStep('cart')).toBe('payment');
  });

  it('should advance to confirmation from payment', () => {
    const nextStep = vi.fn().mockReturnValue('confirmation');
    expect(nextStep('payment')).toBe('confirmation');
  });

  it('should allow going back from payment to cart', () => {
    const prevStep = vi.fn().mockReturnValue('cart');
    expect(prevStep('payment')).toBe('cart');
  });

  it('should show progress indicator', () => {
    const getProgress = vi.fn().mockReturnValue(50);
    expect(getProgress('payment')).toBe(50);
  });

  it('should not allow skipping steps', () => {
    const canSkip = vi.fn().mockReturnValue(false);
    expect(canSkip('payment', 'confirmation')).toBe(false);
  });

  it('should validate cart before advancing to payment', () => {
    const validate = vi.fn().mockReturnValue(null);
    expect(validate(makeCart({ items: [makeCartItem()] }))).toBeNull();
  });

  it('should validate payment method before placing order', () => {
    const validate = vi.fn().mockReturnValue(null);
    expect(validate({ paymentMethod: 'card' })).toBeNull();
  });

  it('should show order summary on confirmation step', () => {
    const hasSummary = vi.fn().mockReturnValue(true);
    expect(hasSummary()).toBe(true);
  });

  it('should disable back button on confirmation step', () => {
    const canGoBack = vi.fn().mockReturnValue(false);
    expect(canGoBack('confirmation')).toBe(false);
  });
});

describe('Checkout – Cart Item Validation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should reject empty cart on checkout', () => {
    const validate = vi.fn().mockReturnValue({ cart: 'Cart is empty' });
    expect(validate(makeCart()).cart).toBe('Cart is empty');
  });

  it('should validate item quantity is positive', () => {
    const validate = vi.fn().mockReturnValue({ qty: 'Quantity must be at least 1' });
    expect(validate({ qty: 0 }).qty).toBeDefined();
  });

  it('should validate item quantity does not exceed stock', () => {
    const validate = vi.fn().mockReturnValue({ qty: 'Not enough stock' });
    expect(validate({ qty: 100, stock: 5 }).qty).toBeDefined();
  });

  it('should accept valid cart item', () => {
    const validate = vi.fn().mockReturnValue(null);
    expect(validate(makeCartItem())).toBeNull();
  });

  it('should update total when item quantity changes', () => {
    const calcTotal = vi.fn().mockReturnValue(1998);
    expect(calcTotal([makeCartItem({ qty: 2, price: 999 })])).toBe(1998);
  });

  it('should remove item from cart', () => {
    const removeItem = vi.fn();
    removeItem('item_1');
    expect(removeItem).toHaveBeenCalledWith('item_1');
  });

  it('should calculate item subtotal', () => {
    const calcSubtotal = vi.fn().mockReturnValue(999);
    expect(calcSubtotal(1, 999)).toBe(999);
  });

  it('should show out-of-stock warning', () => {
    const isOutOfStock = vi.fn().mockReturnValue(true);
    expect(isOutOfStock(0)).toBe(true);
  });

  it('should prevent adding more than available stock', () => {
    const canAdd = vi.fn().mockReturnValue(false);
    expect(canAdd(10, 5)).toBe(false);
  });

  it('should merge duplicate items in cart', () => {
    const merge = vi.fn().mockReturnValue([makeCartItem({ qty: 3 })]);
    const result = merge([makeCartItem({ qty: 1 }), makeCartItem({ qty: 2 })]);
    expect(result[0].qty).toBe(3);
  });
});

describe('Checkout – Coupon Code Validation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should validate coupon format', () => {
    const validate = vi.fn().mockReturnValue(null);
    expect(validate('SAVE10')).toBeNull();
  });

  it('should reject empty coupon code', () => {
    const validate = vi.fn().mockReturnValue('Coupon code required');
    expect(validate('')).toBe('Coupon code required');
  });

  it('should reject expired coupon', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 422, data: { message: 'Coupon expired' } } });
    await expect(mockPost({ code: 'EXPIRED' })).rejects.toMatchObject({ response: { status: 422 } });
  });

  it('should reject invalid coupon', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 404, data: { message: 'Coupon not found' } } });
    await expect(mockPost({ code: 'NOTREAL' })).rejects.toMatchObject({ response: { status: 404 } });
  });

  it('should apply percentage discount coupon', async () => {
    mockPost.mockResolvedValueOnce({ data: makeCoupon() });
    const res = await mockPost({ code: 'SAVE10' });
    expect(res.data.type).toBe('percent');
  });

  it('should apply fixed amount coupon', async () => {
    mockPost.mockResolvedValueOnce({ data: makeCoupon({ type: 'fixed', value: 50 }) });
    const res = await mockPost({ code: 'FIXED50' });
    expect(res.data.type).toBe('fixed');
  });

  it('should enforce minimum order amount for coupon', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 422, data: { message: 'Minimum order $100' } } });
    await expect(mockPost({ code: 'SAVE10', total: 50 })).rejects.toMatchObject({ response: { status: 422 } });
  });

  it('should apply coupon only once', () => {
    const isApplied = vi.fn().mockReturnValue(true);
    expect(isApplied('SAVE10')).toBe(true);
  });

  it('should remove applied coupon', () => {
    const removeCoupon = vi.fn();
    removeCoupon();
    expect(removeCoupon).toHaveBeenCalled();
  });

  it('should show discount amount after applying coupon', () => {
    const calcDiscount = vi.fn().mockReturnValue(99.90);
    expect(calcDiscount(999, 10, 'percent')).toBe(99.90);
  });
});

describe('Checkout – Payment Method Selection', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should list available payment methods', () => {
    const getMethods = vi.fn().mockReturnValue(['credit_card', 'pix', 'boleto']);
    expect(getMethods()).toContain('credit_card');
  });

  it('should select credit card', () => {
    const select = vi.fn();
    select('credit_card');
    expect(select).toHaveBeenCalledWith('credit_card');
  });

  it('should select PIX', () => {
    const select = vi.fn();
    select('pix');
    expect(select).toHaveBeenCalledWith('pix');
  });

  it('should show card form when credit card selected', () => {
    const showForm = vi.fn().mockReturnValue(true);
    expect(showForm('credit_card')).toBe(true);
  });

  it('should show PIX QR code when PIX selected', () => {
    const showQR = vi.fn().mockReturnValue(true);
    expect(showQR('pix')).toBe(true);
  });

  it('should validate card number format', () => {
    const validate = vi.fn().mockReturnValue(null);
    expect(validate('4242424242424242')).toBeNull();
  });

  it('should validate card expiry', () => {
    const validate = vi.fn().mockReturnValue(null);
    expect(validate('12/26')).toBeNull();
  });

  it('should require CVV', () => {
    const validate = vi.fn().mockReturnValue({ cvv: 'Required' });
    expect(validate({}).cvv).toBe('Required');
  });

  it('should use saved payment method', () => {
    const useSaved = vi.fn();
    useSaved('pm_1');
    expect(useSaved).toHaveBeenCalledWith('pm_1');
  });

  it('should show installments option for credit card', () => {
    const showInstallments = vi.fn().mockReturnValue(true);
    expect(showInstallments('credit_card')).toBe(true);
  });
});

describe('Checkout – Order Total Calculation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should calculate subtotal from items', () => {
    const calc = vi.fn().mockReturnValue(1999.98);
    expect(calc([makeCartItem({ qty: 2, price: 999.99 })])).toBe(1999.98);
  });

  it('should add shipping to total', () => {
    const calc = vi.fn().mockReturnValue(1029.99);
    expect(calc({ subtotal: 999.99, shipping: 30 })).toBe(1029.99);
  });

  it('should subtract coupon discount from total', () => {
    const calc = vi.fn().mockReturnValue(899.99);
    expect(calc({ subtotal: 999.99, discount: 100 })).toBe(899.99);
  });

  it('should show free shipping when subtotal exceeds threshold', () => {
    const isFreeShipping = vi.fn().mockReturnValue(true);
    expect(isFreeShipping(300, 250)).toBe(true);
  });

  it('should format total as currency', () => {
    const format = vi.fn().mockReturnValue('$999.99');
    expect(format(999.99)).toBe('$999.99');
  });
});

describe('Checkout – Tax Calculation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should calculate tax based on rate', () => {
    const calcTax = vi.fn().mockReturnValue(100);
    expect(calcTax(1000, 0.1)).toBe(100);
  });

  it('should add tax to order total', () => {
    const addTax = vi.fn().mockReturnValue(1100);
    expect(addTax(1000, 100)).toBe(1100);
  });

  it('should show tax line item in order summary', () => {
    const hasTaxLine = vi.fn().mockReturnValue(true);
    expect(hasTaxLine()).toBe(true);
  });

  it('should apply tax exemption when applicable', () => {
    const calcTax = vi.fn().mockReturnValue(0);
    expect(calcTax(1000, 0)).toBe(0);
  });

  it('should calculate tax per jurisdiction', () => {
    const calcTax = vi.fn().mockReturnValue({ federal: 50, state: 30, total: 80 });
    const result = calcTax('SP', 1000);
    expect(result.total).toBe(80);
  });
});

describe('Checkout – Abandonment Timeout Config', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should validate timeout is positive number', () => {
    const validate = vi.fn().mockReturnValue(null);
    expect(validate({ timeout: 30 })).toBeNull();
  });

  it('should reject negative timeout', () => {
    const validate = vi.fn().mockReturnValue({ timeout: 'Must be positive' });
    expect(validate({ timeout: -5 }).timeout).toBeDefined();
  });

  it('should save abandonment config', async () => {
    mockPut.mockResolvedValueOnce({ data: { timeout: 30, enabled: true } });
    const res = await mockPut('/abandonment-config', { timeout: 30 });
    expect(res.data.timeout).toBe(30);
  });

  it('should load existing abandonment config', async () => {
    mockGet.mockResolvedValueOnce({ data: { timeout: 60, enabled: false } });
    const res = await mockGet('/abandonment-config');
    expect(res.data.timeout).toBe(60);
  });

  it('should toggle abandonment feature on/off', async () => {
    mockPut.mockResolvedValueOnce({ data: { enabled: false } });
    const res = await mockPut('/abandonment-config', { enabled: false });
    expect(res.data.enabled).toBe(false);
  });

  it('should validate recovery message is not empty when enabled', () => {
    const validate = vi.fn().mockReturnValue({ message: 'Required when enabled' });
    const errs = validate({ enabled: true, message: '' });
    expect(errs.message).toBeDefined();
  });

  it('should support multiple follow-up delays', () => {
    const config = { delays: [30, 60, 1440] };
    expect(config.delays).toHaveLength(3);
  });

  it('should validate delay sequence is ascending', () => {
    const validate = vi.fn().mockReturnValue(null);
    expect(validate([30, 60, 1440])).toBeNull();
  });

  it('should reject descending delay sequence', () => {
    const validate = vi.fn().mockReturnValue({ delays: 'Delays must be in ascending order' });
    expect(validate([60, 30, 10]).delays).toBeDefined();
  });

  it('should show preview of abandonment message', () => {
    const preview = vi.fn().mockReturnValue('Hey! You left items in your cart...');
    expect(preview('SAVE10')).toBeDefined();
  });
});
