import {
  buildCommercePaymentReference,
  parseCommercePaymentReference,
} from '../application/services/CommercePaymentReference';

describe('CommercePaymentReference', () => {
  const tenantId = 'tenant-123';
  const orderId = 'order-456';

  describe('buildCommercePaymentReference', () => {
    it('should create a valid reference string', () => {
      const result = buildCommercePaymentReference({ tenantId, orderId });

      expect(result).toBe('commerce|tenant-123|order-456');
    });

    it('should include both tenantId and orderId separated by pipes', () => {
      const result = buildCommercePaymentReference({
        tenantId: 'abc',
        orderId: 'def',
      });

      expect(result).toBe('commerce|abc|def');
    });
  });

  describe('parseCommercePaymentReference', () => {
    it('should extract tenantId and orderId from a valid reference', () => {
      const result = parseCommercePaymentReference('commerce|tenant-123|order-456');

      expect(result).toEqual({ tenantId: 'tenant-123', orderId: 'order-456' });
    });

    it('should return null for null or undefined input', () => {
      expect(parseCommercePaymentReference(null)).toBeNull();
      expect(parseCommercePaymentReference(undefined)).toBeNull();
    });

    it('should return null for invalid format', () => {
      expect(parseCommercePaymentReference('invalid')).toBeNull();
      expect(parseCommercePaymentReference('commerce|only-one')).toBeNull();
      expect(parseCommercePaymentReference('other|tenant|order')).toBeNull();
      expect(parseCommercePaymentReference('')).toBeNull();
    });

    it('should round-trip correctly (build then parse)', () => {
      const reference = buildCommercePaymentReference({ tenantId, orderId });
      const parsed = parseCommercePaymentReference(reference);

      expect(parsed).toEqual({ tenantId, orderId });
    });
  });
});
