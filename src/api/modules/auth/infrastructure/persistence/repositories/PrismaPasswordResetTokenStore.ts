import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  IPasswordResetTokenStore,
  PasswordResetTokenRecord,
} from '@modules/auth/application/ports/IPasswordResetTokenStore';

interface RawPasswordResetTokenRecord {
  id: string;
  user_id: string;
  email: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

@Injectable()
export class PrismaPasswordResetTokenStore implements IPasswordResetTokenStore {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    userId: string;
    email: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO shared_schema.password_reset_tokens (
          user_id,
          email,
          token_hash,
          expires_at
        ) VALUES (
          ${input.userId}::uuid,
          ${input.email},
          ${input.tokenHash},
          ${input.expiresAt.toISOString()}::timestamptz
        )
      `);
  }

  async findValidByHash(
    tokenHash: string,
  ): Promise<PasswordResetTokenRecord | null> {
    const rows = (await this.prisma.$queryRaw(Prisma.sql`
        SELECT
          id,
          user_id,
          email,
          token_hash,
          expires_at,
          used_at,
          created_at
        FROM shared_schema.password_reset_tokens
        WHERE token_hash = ${tokenHash}
          AND used_at IS NULL
          AND expires_at > NOW()
        LIMIT 1
      `)) as RawPasswordResetTokenRecord[];

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      userId: row.user_id,
      email: row.email,
      tokenHash: row.token_hash,
      expiresAt: new Date(row.expires_at),
      usedAt: row.used_at ?? undefined,
      createdAt: new Date(row.created_at),
    };
  }

  async markUsed(id: string): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
        UPDATE shared_schema.password_reset_tokens
        SET used_at = NOW()
        WHERE id = ${id}::uuid
      `);
  }

  async invalidateForUser(userId: string): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
        UPDATE shared_schema.password_reset_tokens
        SET used_at = NOW()
        WHERE user_id = ${userId}::uuid
          AND used_at IS NULL
      `);
  }
}
