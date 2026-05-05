import { ValueObject } from './ValueObject';
import { ValidationErrorException } from './exceptions/DomainExceptions';

interface RoleProps {
  value: string;
}

export type RoleType = 'OWNER' | 'ADMIN' | 'AGENT';

export class Role extends ValueObject<RoleProps> {
  private constructor(props: RoleProps) {
    super(props);
  }

  get value(): RoleType {
    return this.props.value as RoleType;
  }

  public static create(roleName: string): Role {
    const validRoles: RoleType[] = ['OWNER', 'ADMIN', 'AGENT'];
    const normalized = roleName.toUpperCase() as RoleType;

    if (!validRoles.includes(normalized)) {
      throw new ValidationErrorException(
        `Invalid role: ${roleName}. Must be OWNER, ADMIN, or AGENT.`,
      );
    }

    return new Role({ value: normalized });
  }
}
