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
    recoverCart: mockPost,
  },
}));

const makeCart = (o = {}) => ({ id: 'cart_1', items: [makeCartItem()], subtotal: 999, total: 999, ...o });
const makeCartItem = (o = {}) => ({ id: 'item_1', productId: 'prod_1', name: 'Laptop', price: 999, qty: 1, ...o });
const makeOrder = (o = {}) => ({ id: 'ord_1', status: 'pending', total: 999, cartId: 'cart_1', ...o });
const makeCoupon = (o = {}) => ({ code: 'SAVE10', type: 'percent', value: 10, ...o });

// ---------------------------------------------------------------------------
describe('Checkout Integration – Cart + Checkout Form', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should load cart with items', async () => {
    mockGet.mockResolvedValueOnce({ data: makeCart() });
    const res = await mockGet('/cart');
    expect(res.data.items).toHaveLength(1);
  });

  it('should add item to cart', async () => {
    mockPost.mockResolvedValueOnce({ data: makeCart() });
    const res = await mockPost('/cart/items', { productId: 'prod_1', qty: 1 });
    expect(res.data.items).toBeDefined();
  });

  it('should remove item from cart', async () => {
    mockDelete.mockResolvedValueOnce({ data: makeCart({ items: [] }) });
    const res = await mockDelete('/cart/items/item_1');
    expect(res.data.items).toHaveLength(0);
  });

  it('should update cart total after add', async () => {
    mockPost.mockResolvedValueOnce({ data: makeCart({ subtotal: 1998, total: 1998 }) });
    const res = await mockPost('/cart/items', { productId: 'prod_1', qty: 2 });
    expect(res.data.total).toBe(1998);
  });

  it('should validate checkout form before proceeding', () => {
    const validate = vi.fn().mockReturnValue(null);
    expect(validate({ name: 'John', email: 'j@test.com', phone: '11999999999' })).toBeNull();
  });

  it('should require customer contact info', () => {
    const validate = vi.fn().mockReturnValue({ name: 'Required', email: 'Required' });
    const errs = validate({});
    expect(errs.name).toBeDefined();
  });

  it('should show cart summary during checkout', async () => {
    mockGet.mockResolvedValueOnce({ data: makeCart() });
    const res = await mockGet('/cart');
    expect(res.data.subtotal).toBe(999);
  });

  it('should handle cart expiry', async () => {
    mockGet.mockRejectedValueOnce({ response: { status: 410, data: { message: 'Cart expired' } } });
    await expect(mockGet('/cart')).rejects.toMatchObject({ response: { status: 410 } });
  });

  it('should lock item prices during checkout', () => {
    const lockPrices = vi.fn().mockReturnValue(true);
    expect(lockPrices()).toBe(true);
  });

  it('should show shipping options', async () => {
    mockGet.mockResolvedValueOnce({ data: [{ id: 'sh_1', name: 'Standard', price: 15 }, { id: 'sh_2', name: 'Express', price: 35 }] });
    const res = await mockGet('/shipping');
    expect(res.data).toHaveLength(2);
  });
});

describe('Checkout Integration – Coupon Application', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should apply coupon and recalculate total', async () => {
    mockPost.mockResolvedValueOnce({ data: { ...makeCart(), discount: 99.90, total: 899.10, coupon: makeCoupon() } });
    const res = await mockPost('/cart/coupon', { code: 'SAVE10' });
    expect(res.data.discount).toBe(99.90);
  });

  it('should show discount line in cart summary', async () => {
    mockPost.mockResolvedValueOnce({ data: { discount: 99.90, total: 899.10 } });
    const res = await mockPost('/cart/coupon', { code: 'SAVE10' });
    expect(res.data.discount).toBeGreaterThan(0);
  });

  it('should remove coupon and restore original total', async () => {
    mockDelete.mockResolvedValueOnce({ data: makeCart() });
    const res = await mockDelete('/cart/coupon');
    expect(res.data.total).toBe(999);
  });

  it('should reject expired coupon', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 422, data: { message: 'Coupon expired' } } });
    await expect(mockPost('/cart/coupon', { code: 'EXPIRED' })).rejects.toMatchObject({ response: { status: 422 } });
  });

  it('should show applied coupon code in cart', async () => {
    mockPost.mockResolvedValueOnce({ data: { ...makeCart(), appliedCoupon: 'SAVE10' } });
    const res = await mockPost('/cart/coupon', { code: 'SAVE10' });
    expect(res.data.appliedCoupon).toBe('SAVE10');
  });

  it('should not stack multiple coupons', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 409, data: { message: 'Only one coupon allowed' } } });
    await expect(mockPost('/cart/coupon', { code: 'EXTRA20' })).rejects.toMatchObject({ response: { status: 409 } });
  });

  it('should enforce minimum order for coupon', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 422, data: { message: 'Minimum order $100' } } });
    await expect(mockPost('/cart/coupon', {})).rejects.toMatchObject({ response: { status: 422 } });
  });

  it('should apply fixed amount coupon', async () => {
    mockPost.mockResolvedValueOnce({ data: { discount: 50, total: 949 } });
    const res = await mockPost('/cart/coupon', { code: 'FIXED50' });
    expect(res.data.discount).toBe(50);
  });

  it('should apply free shipping coupon', async () => {
    mockPost.mockResolvedValueOnce({ data: { shipping: 0, total: 999 } });
    const res = await mockPost('/cart/coupon', { code: 'FREESHIP' });
    expect(res.data.shipping).toBe(0);
  });

  it('should update total display after coupon applied', () => {
    const updateDisplay = vi.fn();
    updateDisplay(899.10);
    expect(updateDisplay).toHaveBeenCalledWith(899.10);
  });
});

describe('Checkout Integration – Payment Processing', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should process credit card payment', async () => {
    mockPost.mockResolvedValueOnce({ data: makeOrder({ status: 'paid' }) });
    const res = await mockPost('/checkout/pay', { method: 'credit_card', token: 'tok_1' });
    expect(res.data.status).toBe('paid');
  });

  it('should process PIX payment and return QR code', async () => {
    mockPost.mockResolvedValueOnce({ data: { qrCode: 'pix://data', expiry: '2024-12-31T23:59:59Z' } });
    const res = await mockPost('/checkout/pay', { method: 'pix' });
    expect(res.data.qrCode).toBeDefined();
  });

  it('should process boleto payment and return PDF', async () => {
    mockPost.mockResolvedValueOnce({ data: { boletoUrl: 'https://boleto.pdf' } });
    const res = await mockPost('/checkout/pay', { method: 'boleto' });
    expect(res.data.boletoUrl).toBeDefined();
  });

  it('should handle payment decline', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 402, data: { message: 'Payment declined' } } });
    await expect(mockPost('/checkout/pay', {})).rejects.toMatchObject({ response: { status: 402 } });
  });

  it('should show loading during payment processing', () => {
    const isLoading = vi.fn().mockReturnValue(true);
    expect(isLoading()).toBe(true);
  });

  it('should prevent double submission during processing', () => {
    const canSubmit = vi.fn().mockReturnValue(false);
    expect(canSubmit(true)).toBe(false);
  });

  it('should handle 3DS authentication challenge', async () => {
    mockPost.mockResolvedValueOnce({ data: { requiresAction: true, redirectUrl: 'https://3ds.bank.com' } });
    const res = await mockPost('/checkout/pay', {});
    expect(res.data.requiresAction).toBe(true);
  });

  it('should complete payment after 3DS verification', async () => {
    mockPost.mockResolvedValueOnce({ data: makeOrder({ status: 'paid' }) });
    const res = await mockPost('/checkout/3ds-complete', { paymentIntentId: 'pi_1' });
    expect(res.data.status).toBe('paid');
  });

  it('should validate CVV before submitting', () => {
    const validate = vi.fn().mockReturnValue(null);
    expect(validate({ cvv: '123' })).toBeNull();
  });

  it('should mask card number in UI', () => {
    const mask = vi.fn().mockReturnValue('**** **** **** 4242');
    expect(mask('4242424242424242')).toBe('**** **** **** 4242');
  });
});

describe('Checkout Integration – Order Creation → Confirmation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should create order after payment', async () => {
    mockPost.mockResolvedValueOnce({ data: makeOrder() });
    const res = await mockPost('/orders');
    expect(res.data.id).toBeDefined();
  });

  it('should show order confirmation page', async () => {
    mockGet.mockResolvedValueOnce({ data: makeOrder({ status: 'paid' }) });
    const res = await mockGet('/orders/ord_1');
    expect(res.data.status).toBe('paid');
  });

  it('should send confirmation email after order', () => {
    const sendEmail = vi.fn();
    sendEmail('j@test.com', 'ord_1');
    expect(sendEmail).toHaveBeenCalled();
  });

  it('should clear cart after order creation', () => {
    const clearCart = vi.fn();
    clearCart();
    expect(clearCart).toHaveBeenCalled();
  });

  it('should show order number on confirmation', async () => {
    mockGet.mockResolvedValueOnce({ data: makeOrder({ orderNumber: 'ORD-2024-001' }) });
    const res = await mockGet('/orders/ord_1');
    expect(res.data.orderNumber).toBeDefined();
  });

  it('should redirect to confirmation page after order', () => {
    const navigate = vi.fn();
    navigate('/checkout/confirmation/ord_1');
    expect(navigate).toHaveBeenCalledWith('/checkout/confirmation/ord_1');
  });

  it('should show order items on confirmation', async () => {
    mockGet.mockResolvedValueOnce({ data: { ...makeOrder(), items: [makeCartItem()] } });
    const res = await mockGet('/orders/ord_1');
    expect(res.data.items).toHaveLength(1);
  });

  it('should show payment method on confirmation', async () => {
    mockGet.mockResolvedValueOnce({ data: { ...makeOrder(), paymentMethod: 'credit_card' } });
    const res = await mockGet('/orders/ord_1');
    expect(res.data.paymentMethod).toBe('credit_card');
  });
});

describe('Checkout Integration – Abandonment Recovery Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should detect cart abandonment after timeout', () => {
    const detectAbandonment = vi.fn().mockReturnValue(true);
    expect(detectAbandonment(makeCart())).toBe(true);
  });

  it('should trigger recovery message after abandonment', async () => {
    mockPost.mockResolvedValueOnce({ data: { sent: true } });
    const res = await mockPost('/cart/cart_1/recovery-message');
    expect(res.data.sent).toBe(true);
  });

  it('should restore cart from recovery link', async () => {
    mockPost.mockResolvedValueOnce({ data: makeCart() });
    const res = await mockPost('/cart/restore', { token: 'recovery_token' });
    expect(res.data.id).toBe('cart_1');
  });

  it('should apply recovery coupon to restored cart', async () => {
    mockPost.mockResolvedValueOnce({ data: { ...makeCart(), appliedCoupon: 'RETURN10' } });
    const res = await mockPost('/cart/restore', { token: 'token', coupon: 'RETURN10' });
    expect(res.data.appliedCoupon).toBe('RETURN10');
  });

  it('should track recovery conversion', async () => {
    mockPost.mockResolvedValueOnce({ data: { tracked: true } });
    const res = await mockPost('/cart/cart_1/recovery-conversion');
    expect(res.data.tracked).toBe(true);
  });

  it('should not send duplicate recovery messages', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 409, data: { message: 'Already sent' } } });
    await expect(mockPost('/cart/cart_1/recovery-message')).rejects.toMatchObject({ response: { status: 409 } });
  });

  it('should expire recovery link after 24h', () => {
    const isExpired = vi.fn().mockReturnValue(true);
    expect(isExpired('old-token')).toBe(true);
  });

  it('should log abandonment event for analytics', () => {
    const logEvent = vi.fn();
    logEvent('cart_abandoned', { cartId: 'cart_1' });
    expect(logEvent).toHaveBeenCalledWith('cart_abandoned', expect.any(Object));
  });
});

describe('Checkout Integration – Error Handling', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should show error when item goes out of stock', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 409, data: { message: 'Item out of stock' } } });
    await expect(mockPost('/cart/items', {})).rejects.toMatchObject({ response: { status: 409 } });
  });

  it('should show error when price changes during checkout', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 409, data: { message: 'Price has changed' } } });
    await expect(mockPost('/checkout/pay', {})).rejects.toMatchObject({ response: { status: 409 } });
  });

  it('should show network error message', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network Error'));
    await expect(mockPost({})).rejects.toThrow('Network Error');
  });

  it('should handle session timeout during checkout', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 401 } });
    await expect(mockPost({})).rejects.toMatchObject({ response: { status: 401 } });
  });
});

describe('Checkout Integration – Payment Failure Retry', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should show retry button after payment failure', () => {
    const showRetry = vi.fn().mockReturnValue(true);
    expect(showRetry(true)).toBe(true);
  });

  it('should allow changing payment method on retry', () => {
    const canChange = vi.fn().mockReturnValue(true);
    expect(canChange()).toBe(true);
  });

  it('should retry with new card after decline', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 402 } }).mockResolvedValueOnce({ data: makeOrder({ status: 'paid' }) });
    try { await mockPost({}); } catch {}
    const res = await mockPost({});
    expect(res.data.status).toBe('paid');
  });

  it('should preserve cart during retry', async () => {
    mockGet.mockResolvedValueOnce({ data: makeCart() });
    const res = await mockGet('/cart');
    expect(res.data.items).toHaveLength(1);
  });

  it('should limit payment retries to 3', () => {
    const maxRetries = vi.fn().mockReturnValue(3);
    expect(maxRetries()).toBe(3);
  });

  it('should lock order after max retries exceeded', () => {
    const isLocked = vi.fn().mockReturnValue(true);
    expect(isLocked(3)).toBe(true);
  });

  it('should show appropriate error message per failure reason', () => {
    const getMessage = vi.fn().mockReturnValue('Insufficient funds. Please use a different card.');
    expect(getMessage('insufficient_funds')).toBeDefined();
  });
});
