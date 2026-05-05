import { ValueObject } from '../../../../shared/domain/ValueObject.js';

interface AddressProps {
  zipcode: string;
  street: string;
  streetNumber: string;
  neighborhood: string;
  city: string;
  state: string;
}

export class Address extends ValueObject<AddressProps> {
  private constructor(props: AddressProps) {
    super(props);
  }

  public static create(props: AddressProps): Address | null {
    if (
      !props.zipcode &&
      !props.street &&
      !props.streetNumber &&
      !props.neighborhood &&
      !props.city &&
      !props.state
    ) {
      return null;
    }

    return new Address(props);
  }

  get zipcode(): string {
    return this.props.zipcode;
  }

  get street(): string {
    return this.props.street;
  }

  get streetNumber(): string {
    return this.props.streetNumber;
  }

  get neighborhood(): string {
    return this.props.neighborhood;
  }

  get city(): string {
    return this.props.city;
  }

  get state(): string {
    return this.props.state;
  }

  public toValue(): AddressProps {
    return {
      zipcode: this.props.zipcode,
      street: this.props.street,
      streetNumber: this.props.streetNumber,
      neighborhood: this.props.neighborhood,
      city: this.props.city,
      state: this.props.state,
    };
  }
}
