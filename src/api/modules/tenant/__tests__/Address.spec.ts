import { Address } from '../domain/value-objects/Address';

describe('Address Value Object', () => {
  it('should create a valid address', () => {
    const props = {
      zipcode: '01001-000',
      street: 'Praça da Sé',
      streetNumber: 's/n',
      neighborhood: 'Sé',
      city: 'São Paulo',
      state: 'SP',
    };
    const address = Address.create(props);
    expect(address).not.toBeNull();
    expect(address?.zipcode).toBe(props.zipcode);
    expect(address?.toValue()).toEqual(props);
  });

  it('should return null if all fields are empty', () => {
    const props = {
      zipcode: '',
      street: '',
      streetNumber: '',
      neighborhood: '',
      city: '',
      state: '',
    };
    const address = Address.create(props);
    expect(address).toBeNull();
  });

  it('should create an address even if only one field is provided', () => {
    const props = {
      zipcode: '01000-000',
      street: '',
      streetNumber: '',
      neighborhood: '',
      city: '',
      state: '',
    };
    const address = Address.create(props);
    expect(address).not.toBeNull();
    expect(address?.zipcode).toBe('01000-000');
  });
});
