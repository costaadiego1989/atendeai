import { UniqueEntityID } from '../../../../../shared/domain/UniqueEntityID';
import { User } from '../../../domain/entities/User';
import { Email } from '../../../domain/value-objects/Email';
import { Phone } from '../../../domain/value-objects/Phone';
import { Role } from '../../../domain/value-objects/Role';

interface RawUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  mustChangePassword?: boolean | null;
  role: string;
}

export class UserMapper {
  static toDomain(raw: RawUser): User {
    return User.reconstitute(
      {
        name: raw.name,
        email: Email.create(raw.email),
        phone: Phone.create(raw.phone),
        passwordHash: raw.passwordHash,
        mustChangePassword: raw.mustChangePassword ?? false,
        role: Role.create(raw.role),
      },
      new UniqueEntityID(raw.id),
    );
  }

  static toPersistence(user: User, tenantId: string) {
    return {
      id: user.id.toValue(),
      tenantId,
      name: user.name,
      email: user.email.value,
      phone: user.phone.value,
      passwordHash: user.passwordHash,
      mustChangePassword: user.mustChangePassword,
      role: user.role.value,
    };
  }
}
