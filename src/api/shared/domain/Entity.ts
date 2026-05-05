import { UniqueEntityID } from './UniqueEntityID';

export abstract class Entity<T> {
  protected readonly _id: UniqueEntityID;
  protected readonly _createdAt: Date;
  protected _updatedAt: Date;
  protected readonly props: T;

  protected constructor(
    props: T,
    id?: UniqueEntityID,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    this._id = id ?? new UniqueEntityID();
    this.props = props;
    this._createdAt = createdAt ?? new Date();
    this._updatedAt = updatedAt ?? new Date();
  }

  get id(): UniqueEntityID {
    return this._id;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  protected set updatedAt(value: Date) {
    this._updatedAt = value;
  }

  public equals(entity?: Entity<T>): boolean {
    if (entity === null || entity === undefined) return false;
    if (this === entity) return true;
    return this._id.equals(entity._id);
  }
}
