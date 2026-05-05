import { AuthUser } from '@modules/auth/domain/entities/AuthUser';
import { AuthUserEmail } from '@modules/auth/domain/value-objects/AuthUserEmail';
import { Role } from '@shared/domain/Role';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';

interface RawAuthUser {
  id: string;
  tenantId: string;
  tenantName?: string;
  tenantCnpj?: string;
  tenantBusinessType?: string;
  tenantBranches?: Array<{
    id: string;
    name: string;
    isHeadquarters: boolean;
    active: boolean;
  }>;
  email: string;
  name: string;
  phone?: string;
  cpf?: string;
  passwordHash: string;
  mustChangePassword?: boolean;
  role: string;
  planStatus?: string;
  tenantCreatedAt: Date;
}

export class AuthUserMapper {
  public static toDomain(raw: RawAuthUser): AuthUser {
    return AuthUser.create(
      {
        tenantId: raw.tenantId,
        tenantName: raw.tenantName,
        tenantCnpj: raw.tenantCnpj,
        tenantBusinessType: raw.tenantBusinessType,
        tenantBranches: raw.tenantBranches ?? [],
        email: AuthUserEmail.create(raw.email),
        name: raw.name,
        phone: raw.phone,
        cpf: raw.cpf,
        passwordHash: raw.passwordHash,
        mustChangePassword: raw.mustChangePassword ?? false,
        role: Role.create(raw.role),
        planStatus: raw.planStatus,
        tenantCreatedAt: new Date(raw.tenantCreatedAt),
      },
      new UniqueEntityID(raw.id),
    );
  }
}
