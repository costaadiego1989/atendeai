import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { User } from '../../../domain/entities/User';
import { PrismaService } from '../../../../../shared/infrastructure/database/PrismaService';
import { UserMapper } from '../mappers/UserMapper';

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async saveWithTenant(user: User, tenantId: string): Promise<void> {
    const data = UserMapper.toPersistence(user, tenantId);
    await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO tenant_schema.users (
          id,
          tenant_id,
          name,
          email,
          cpf,
          phone,
          password_hash,
          must_change_password,
          role,
          created_at
        )
        VALUES (
          ${data.id}::uuid,
          ${tenantId}::uuid,
          ${data.name},
          ${data.email},
          NULL,
          ${data.phone},
          ${data.passwordHash},
          ${data.mustChangePassword ?? false},
          ${data.role},
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          password_hash = EXCLUDED.password_hash,
          must_change_password = EXCLUDED.must_change_password,
          role = EXCLUDED.role
      `);
  }

  async save(user: User): Promise<void> {
    const existing = await this.prisma.$queryRaw<
      Array<{ tenant_id: string }>
    >(Prisma.sql`
        SELECT tenant_id
        FROM tenant_schema.users
        WHERE id = ${user.id.toValue()}::uuid
        LIMIT 1
      `);

    if (!existing[0]) {
      throw new Error(
        'Cannot save a new user without a tenant ID using the generic save method.',
      );
    }

    const data = UserMapper.toPersistence(user, existing[0].tenant_id);
    await this.prisma.$executeRaw(Prisma.sql`
        UPDATE tenant_schema.users
        SET
          name = ${data.name},
          email = ${data.email},
          phone = ${data.phone},
          password_hash = ${data.passwordHash},
          must_change_password = ${data.mustChangePassword ?? false},
          role = ${data.role}
        WHERE id = ${data.id}::uuid
      `);
  }

  async findById(id: string): Promise<User | null> {
    const [raw] = await this.prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT
          id,
          name,
          email,
          phone,
          password_hash AS "passwordHash",
          must_change_password AS "mustChangePassword",
          role
        FROM tenant_schema.users
        WHERE id = ${id}::uuid
        LIMIT 1
      `);
    return raw ? UserMapper.toDomain(raw) : null;
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<User | null> {
    const [raw] = await this.prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT
          id,
          name,
          email,
          phone,
          password_hash AS "passwordHash",
          must_change_password AS "mustChangePassword",
          role
        FROM tenant_schema.users
        WHERE id = ${id}::uuid
          AND tenant_id = ${tenantId}::uuid
        LIMIT 1
      `);
    return raw ? UserMapper.toDomain(raw) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [raw] = await this.prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT
          id,
          name,
          email,
          phone,
          password_hash AS "passwordHash",
          must_change_password AS "mustChangePassword",
          role
        FROM tenant_schema.users
        WHERE email = ${email}
        LIMIT 1
      `);
    return raw ? UserMapper.toDomain(raw) : null;
  }

  async findOwnerPrincipalByTenantId(tenantId: string): Promise<{
    id: string;
    name: string;
    email: string;
    phone: string;
  } | null> {
    const [raw] = await this.prisma.$queryRaw<
      Array<{ id: string; name: string; email: string; phone: string }>
    >(Prisma.sql`
        SELECT id, name, email, phone
        FROM tenant_schema.users
        WHERE tenant_id = ${tenantId}::uuid
          AND role = 'OWNER'
        LIMIT 1
      `);
    return raw ?? null;
  }

  async findAllByTenant(tenantId: string): Promise<User[]> {
    const rawUsers = await this.prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT
          id,
          name,
          email,
          phone,
          password_hash AS "passwordHash",
          must_change_password AS "mustChangePassword",
          role,
          last_login_at AS "lastLoginAt"
        FROM tenant_schema.users
        WHERE tenant_id = ${tenantId}::uuid
        ORDER BY created_at ASC
      `);
    return rawUsers.map((raw) => {
      const user = UserMapper.toDomain(raw);
      (user as any).lastLoginAt = raw.lastLoginAt ?? null;
      return user;
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
        DELETE FROM tenant_schema.users
        WHERE id = ${id}::uuid
      `);
  }
}
