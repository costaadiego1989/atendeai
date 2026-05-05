import { Promotion } from '../domain/value-objects/Promotion';

describe('Promotion Value Object', () => {
  it('should create a valid promotion', () => {
    const props = {
      title: 'Summer Sale',
      description: 'Get 20% off on all items this summer!',
      value: '20% OFF',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };
    const promotion = Promotion.create(props);
    expect(promotion.title).toBe(props.title);
    expect(promotion.description).toBe(props.description);
    expect(promotion.value).toBe(props.value);
    expect(promotion.id).toBeDefined();
  });

  it('should generate a UUID if id is not provided', () => {
    const promotion = Promotion.create({
      title: 'Short title',
      description: 'A very long description for the promotion',
      value: 'Free',
    });
    expect(promotion.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('should keep the provided id', () => {
    const id = 'fixed-id';
    const promotion = Promotion.create({
      id,
      title: 'Fixed ID Promo',
      description: 'A very long description for the promotion',
      value: '10',
    });
    expect(promotion.id).toBe(id);
  });

  it('should throw an error if title is too short', () => {
    expect(() => Promotion.create({
      title: 'ab',
      description: 'Valid description that is long enough',
      value: '5',
    })).toThrow('Promotion title must be at least 3 characters long');
  });

  it('should throw an error if description is too short', () => {
    expect(() => Promotion.create({
      title: 'Valid Title',
      description: 'Short',
      value: '5',
    })).toThrow('Promotion description must be at least 10 characters long');
  });

  it('should throw an error if expiresAt is invalid', () => {
    expect(() => Promotion.create({
      title: 'Valid Title',
      description: 'Valid description that is long enough',
      value: '5',
      expiresAt: 'invalid-date',
    })).toThrow('Promotion expiresAt must be a valid date');
  });
});
