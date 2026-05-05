import { UniqueEntityID } from './UniqueEntityID';

export class TenantId {
  private readonly value: UniqueEntityID;

  private constructor(id: UniqueEntityID) {
    this.value = id;
  }

  public static create(id?: string): TenantId {
    return new TenantId(new UniqueEntityID(id));
  }

  public toString(): string {
    return this.value.toValue();
  }

  public toValue(): string {
    return this.value.toValue();
  }

  public equals(other?: TenantId): boolean {
    if (other === null || other === undefined) return false;
    return this.value.equals(other.value);
  }
}
