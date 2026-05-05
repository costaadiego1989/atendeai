import { User } from '../domain/entities/User';
import { Email } from '../domain/value-objects/Email';
import { Phone } from '../domain/value-objects/Phone';
import { Role } from '../domain/value-objects/Role';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { ValidationErrorException } from '@shared/domain/exceptions/DomainExceptions';

describe('User Entity', () => {
  function makeUser(props: any = {}, id?: UniqueEntityID) {
    return User.create(
      {
        name: 'John Doe',
        email: Email.create('john@example.com'),
        phone: Phone.create('11999998888'),
        passwordHash: 'hash123',
        role: Role.create('AGENT'),
        ...props,
      },
      id,
    );
  }

  it('should create a valid user and generate UserCreated event', () => {
    const user = makeUser();

    expect(user.name).toBe('John Doe');
    expect(user.email.value).toBe('john@example.com');
    expect(user.phone.value).toBe('+5511999998888');
    expect(user.role.value).toBe('AGENT');
    expect(user.mustChangePassword).toBe(false);
    expect(user.domainEvents).toHaveLength(1);
    expect(user.domainEvents[0].constructor.name).toBe('UserCreated');
  });

  it('should throw an error if name is too short', () => {
    expect(() => makeUser({ name: 'Jo' })).toThrow(ValidationErrorException);
  });

  it('should reconstitute a user without generating events', () => {
    const id = new UniqueEntityID('user-1');
    const user = User.reconstitute(
      {
        name: 'Jane Doe',
        email: Email.create('jane@example.com'),
        phone: Phone.create('11988887777'),
        passwordHash: 'hash456',
        role: Role.create('ADMIN'),
        mustChangePassword: true,
      },
      id,
    );

    expect(user.id.equals(id)).toBe(true);
    expect(user.name).toBe('Jane Doe');
    expect(user.mustChangePassword).toBe(true);
    expect(user.domainEvents).toHaveLength(0);
  });

  it('should update name with validation', () => {
    const user = makeUser();
    user.updateName('New Name');
    expect(user.name).toBe('New Name');
    expect(() => user.updateName('Ab')).toThrow(ValidationErrorException);
  });

  it('should update email', () => {
    const user = makeUser();
    user.updateEmail('new@example.com');
    expect(user.email.value).toBe('new@example.com');
  });

  it('should update phone', () => {
    const user = makeUser();
    user.updatePhone('11977776666');
    expect(user.phone.value).toBe('+5511977776666');
  });

  it('should update CPF', () => {
    const user = makeUser();
    const cpfValue = '529.982.247-25';
    user.updateCpf(cpfValue);
    expect(user.cpf?.value).toBe(cpfValue);
  });

  it('should change role', () => {
    const user = makeUser();
    user.changeRole(Role.create('OWNER'));
    expect(user.role.value).toBe('OWNER');
  });

  it('should update password hash', () => {
    const user = makeUser();
    user.updatePasswordHash('new-hash');
    expect(user.passwordHash).toBe('new-hash');
  });

  it('should handle password change requirement', () => {
    const user = makeUser();
    expect(user.mustChangePassword).toBe(false);

    user.requirePasswordChange();
    expect(user.mustChangePassword).toBe(true);

    user.clearPasswordChangeRequirement();
    expect(user.mustChangePassword).toBe(false);
  });
});
