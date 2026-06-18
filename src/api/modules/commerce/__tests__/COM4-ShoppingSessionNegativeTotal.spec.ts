/**
 * COM4: ShoppingSession total can go negative
 *
 * Tests that computeCheckoutTotals() and recalculateTotals() throw when
 * discount > subtotal + freight, and floor the total to 0 otherwise.
 */
import { ShoppingSession } from '../domain/entities/ShoppingSession';
import { DiscountExceedsTotalException } from '../domain/errors/DiscountExceedsTotalException';
import { Money } from '../domain/value-objects/Money';

function makeSession(
  subtotal: number,
  freight: number,
  discount: number,
): ShoppingSession {
  return ShoppingSession.reconstruct({
    id: 'session-1',
    tenantId: 'tenant-1',
    branchId: null,
    conversationId: 'conv-1',
    contactId: null,
    status: 'BUILDING_CART',
    items: [
      {
        id: 'item-1',
        sessionId: 'session-1',
        tenantId: 'tenant-1',
        source: 'CATALOG',
        inventoryItemId: null,
        catalogItemId: 'cat-1',
        name: 'Product',
        quantity: 1,
        unitPrice: subtotal,
        lineTotal: subtotal,
        currency: 'BRL',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    subtotalAmount: subtotal,
    freightAmount: freight,
    discountAmount: discount,
    totalAmount: subtotal + freight - discount,
    fulfillmentType: 'PICKUP',
    deliveryAddress: null,
    couponCode: discount > 0 ? 'PROMO' : null,
    currency: 'BRL',
  });
}

describe('COM4: ShoppingSession total cannot go negative', () => {
  it('should return correct totals when discount < subtotal + freight', () => {
    const session = makeSession(100, 10, 20);
    const { total } = session.computeCheckoutTotals();
    expect(total.amount).toBe(90);
  });

  it('should floor total to 0 when discount equals subtotal + freight', () => {
    const session = makeSession(100, 0, 100);
    const { total } = session.computeCheckoutTotals();
    expect(total.amount).toBe(0);
  });

  it('should throw DiscountExceedsTotalException when discount > subtotal + freight', () => {
    const session = makeSession(100, 0, 150);
    expect(() => session.computeCheckoutTotals()).toThrow(
      DiscountExceedsTotalException,
    );
  });

  it('should throw DiscountExceedsTotalException in recalculateTotals when discount override exceeds gross', () => {
    const session = makeSession(100, 10, 0);
    // Override discount to more than subtotal + freight
    expect(() =>
      session.recalculateTotals(Money.create(200, 'BRL')),
    ).toThrow(DiscountExceedsTotalException);
  });
});
