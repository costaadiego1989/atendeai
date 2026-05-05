import { AggregateRoot } from '../../../../shared/domain/AggregateRoot.js';
import { UniqueEntityID } from '../../../../shared/domain/UniqueEntityID.js';
import { ValidationErrorException } from '../../../../shared/domain/exceptions/DomainExceptions.js';
import { CPF } from '../../../../shared/domain/CPF.js';
import { Email } from '../value-objects/Email.js';
import { Phone } from '../value-objects/Phone.js';
import { Role } from '../value-objects/Role.js';
import { UserCreated } from '../events/UserEvents.js';

interface UserProps {
  name: string;
  email: Email;
  cpf?: CPF | null;
  phone: Phone;
  passwordHash: string;
  mustChangePassword?: boolean;
  role: Role;
}

export class User extends AggregateRoot<UserProps> {
  private constructor(
    props: UserProps,
    id?: UniqueEntityID,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(props, id, createdAt, updatedAt);
  }

  get name(): string {
    return this.props.name;
  }

  get email(): Email {
    return this.props.email;
  }

  get cpf(): CPF | null {
    return this.props.cpf ?? null;
  }

  get phone(): Phone {
    return this.props.phone;
  }

  get passwordHash(): string {
    return this.props.passwordHash;
  }

  get mustChangePassword(): boolean {
    return this.props.mustChangePassword ?? false;
  }

  get role(): Role {
    return this.props.role;
  }

  public static reconstitute(
    props: UserProps,
    id: UniqueEntityID,
    createdAt?: Date,
    updatedAt?: Date,
  ): User {
    return new User(props, id, createdAt, updatedAt);
  }

  public static create(props: UserProps, id?: UniqueEntityID): User {
    if (!props.name || props.name.trim().length < 3) {
      throw new ValidationErrorException(
        'User name must have at least 3 characters',
      );
    }
    const user = new User(props, id);

    if (!id) {
      user.addDomainEvent(
        new UserCreated(
          user.id,
          user.name,
          user.email.value,
          user.phone.value,
          user.role.value,
        ),
      );
    }

    return user;
  }

  public updateName(name: string): void {
    if (!name || name.trim().length < 3) {
      throw new ValidationErrorException(
        'User name must have at least 3 characters',
      );
    }
    this.props.name = name;
    this.updatedAt = new Date();
  }

  public updatePhone(phone: string): void {
    this.props.phone = Phone.create(phone);
    this.updatedAt = new Date();
  }

  public changeRole(role: Role): void {
    this.props.role = role;
    this.updatedAt = new Date();
  }

  public updatePasswordHash(passwordHash: string): void {
    this.props.passwordHash = passwordHash;
    this.updatedAt = new Date();
  }

  public requirePasswordChange(): void {
    this.props.mustChangePassword = true;
    this.updatedAt = new Date();
  }

  public clearPasswordChangeRequirement(): void {
    this.props.mustChangePassword = false;
    this.updatedAt = new Date();
  }

  public updateEmail(email: string): void {
    this.props.email = Email.create(email);
    this.updatedAt = new Date();
  }

  public updateCpf(cpf: string): void {
    this.props.cpf = CPF.create(cpf);
    this.updatedAt = new Date();
  }
}
