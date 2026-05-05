import { randomUUID } from 'crypto';

export class UniqueEntityID {
  private readonly value: string;

  constructor(id?: string) {
    this.value = id ?? randomUUID();
  }

  public toString(): string {
    return this.value;
  }

  public toValue(): string {
    return this.value;
  }

  public equals(id?: UniqueEntityID): boolean {
    if (id === null || id === undefined) return false;
    return this.value === id.toValue();
  }
}
