import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { IAuthUserRepository } from '@modules/auth/domain/repositories/IAuthUserRepository';
import { AuthUser } from '@modules/auth/domain/entities/AuthUser';
import { AuthUserMapper } from '../mappers/AuthUserMapper';

@Injectable()
export class PrismaAuthUserRepository implements IAuthUserRepository {
  constructor(private readonly prisma: PrismaService) { }

  async findByEmail(email: string): Promise<AuthUser | null> {
    const [user] = await this.prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT
          u.id,
          u.tenant_id AS "tenantId",
          t.company_name AS "tenantName",
          t.cnpj AS "tenantCnpj",
          t.business_type AS "tenantBusinessType",
          u.email,
          u.name,
          u.phone,
          u.cpf,
          u.password_hash AS "passwordHash",
          u.must_change_password AS "mustChangePassword",
          u.role,
          t.plan_status AS "planStatus",
          t.created_at AS "tenantCreatedAt"
        FROM tenant_schema.users u
        INNER JOIN tenant_schema.tenants t ON t.id = u.tenant_id
        WHERE u.email = ${email}
        LIMIT 1
      `);

    if (!user) {
      return null;
    }

    user.tenantBranches = await this.findTenantBranches(user.tenantId);
    return AuthUserMapper.toDomain(user);
  }

  async findById(id: string): Promise<AuthUser | null> {
    const [user] = await this.prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT
          u.id,
          u.tenant_id AS "tenantId",
          t.company_name AS "tenantName",
          t.cnpj AS "tenantCnpj",
          t.business_type AS "tenantBusinessType",
          u.email,
          u.name,
          u.phone,
          u.cpf,
          u.password_hash AS "passwordHash",
          u.must_change_password AS "mustChangePassword",
          u.role,
          t.plan_status AS "planStatus",
          t.created_at AS "tenantCreatedAt"
        FROM tenant_schema.users u
        INNER JOIN tenant_schema.tenants t ON t.id = u.tenant_id
        WHERE u.id = ${id}::uuid
        LIMIT 1
      `);

    if (!user) {
      return null;
    }

    user.tenantBranches = await this.findTenantBranches(user.tenantId);
    return AuthUserMapper.toDomain(user);
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
        UPDATE tenant_schema.users
        SET
          password_hash = ${passwordHash},
          must_change_password = FALSE
        WHERE id = ${userId}::uuid
      `);
  }

  private async findTenantBranches(tenantId: string): Promise<
    Array<{
      id: string;
      name: string;
      isHeadquarters: boolean;
      active: boolean;
    }>
  > {
    return this.prisma.$queryRaw(Prisma.sql`
        SELECT
          id,
          name,
          is_headquarters AS "isHeadquarters",
          active
        FROM tenant_schema.tenant_branches
        WHERE tenant_id = ${tenantId}::uuid
        ORDER BY is_headquarters DESC, created_at ASC
      `);
  }
}
