import { Entity } from '@shared/domain/Entity';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { Role } from '@shared/domain/Role';
import { AuthUserEmail } from '../value-objects/AuthUserEmail';

interface AuthUserBranch {
  id: string;
  name: string;
  isHeadquarters: boolean;
  active: boolean;
}

interface AuthUserProps {
  tenantId: string;
  tenantName?: string;
  tenantCnpj?: string;
  tenantBusinessType?: string;
  tenantBranches?: AuthUserBranch[];
  email: AuthUserEmail;
  name: string;
  phone?: string;
  cpf?: string;
  passwordHash: string;
  mustChangePassword?: boolean;
  role: Role;
  planStatus?: string;
  tenantCreatedAt: Date;
}

export class AuthUser extends Entity<AuthUserProps> {
  private constructor(props: AuthUserProps, id?: UniqueEntityID) {
    super(props, id);
  }

  get tenantId(): string {
    return this.props.tenantId;
  }
  get email(): AuthUserEmail {
    return this.props.email;
  }
  get tenantName(): string | undefined {
    return this.props.tenantName;
  }
  get tenantCnpj(): string | undefined {
    return this.props.tenantCnpj;
  }
  get tenantBusinessType(): string | undefined {
    return this.props.tenantBusinessType;
  }
  get tenantBranches(): AuthUserBranch[] {
    return this.props.tenantBranches ?? [];
  }
  get name(): string {
    return this.props.name;
  }
  get phone(): string | undefined {
    return this.props.phone;
  }
  get cpf(): string | undefined {
    return this.props.cpf;
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
  get planStatus(): string | undefined {
    return this.props.planStatus;
  }
  get tenantCreatedAt(): Date {
    return this.props.tenantCreatedAt;
  }
  public static create(props: AuthUserProps, id?: UniqueEntityID): AuthUser {
    return new AuthUser(props, id);
  }
}
