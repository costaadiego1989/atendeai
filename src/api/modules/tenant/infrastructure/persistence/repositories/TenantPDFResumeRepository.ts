import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';

export interface TenantPDFResumeRecord {
  id: string;
  tenantId: string;
  fileName: string;
  fileUrl: string | null;
  checksum: string | null;
  summaries: string[];
  status: string;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertTenantPDFResumeRecordInput {
  tenantId: string;
  fileName: string;
  fileUrl: string | null;
  checksum: string | null;
  summaries: string[];
  status: string;
  error: string | null;
}

@Injectable()
export class TenantPDFResumeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(input: UpsertTenantPDFResumeRecordInput): Promise<TenantPDFResumeRecord> {
    const checksumFilter = input.checksum
      ? Prisma.sql`checksum = ${input.checksum}`
      : Prisma.sql`file_url = ${input.fileUrl}`;

    const existing = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id
      FROM tenant_schema.tenant_pdf_resumes
      WHERE tenant_id = ${input.tenantId}::uuid
        AND ${checksumFilter}
      LIMIT 1
    `);

    if (existing[0]?.id) {
      const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
        UPDATE tenant_schema.tenant_pdf_resumes
        SET file_name = ${input.fileName},
            file_url = ${input.fileUrl},
            checksum = ${input.checksum},
            summaries = ${JSON.stringify(input.summaries)}::jsonb,
            status = ${input.status},
            error = ${input.error},
            updated_at = NOW()
        WHERE id = ${existing[0].id}::uuid
        RETURNING *
      `);
      return this.map(rows[0]);
    }

    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      INSERT INTO tenant_schema.tenant_pdf_resumes (
        tenant_id, file_name, file_url, checksum, summaries, status, error
      )
      VALUES (
        ${input.tenantId}::uuid,
        ${input.fileName},
        ${input.fileUrl},
        ${input.checksum},
        ${JSON.stringify(input.summaries)}::jsonb,
        ${input.status},
        ${input.error}
      )
      RETURNING *
    `);

    return this.map(rows[0]);
  }

  async listByTenant(tenantId: string): Promise<TenantPDFResumeRecord[]> {
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT *
      FROM tenant_schema.tenant_pdf_resumes
      WHERE tenant_id = ${tenantId}::uuid
      ORDER BY updated_at DESC
    `);

    return rows.map((row) => this.map(row));
  }

  async listReadySummaries(tenantId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ summaries: unknown }>>(Prisma.sql`
      SELECT summaries
      FROM tenant_schema.tenant_pdf_resumes
      WHERE tenant_id = ${tenantId}::uuid
        AND status = 'READY'
      ORDER BY updated_at DESC
      LIMIT 10
    `);

    return rows.flatMap((row) => this.normalizeSummaries(row.summaries));
  }

  private map(row: any): TenantPDFResumeRecord {
    return {
      id: String(row.id),
      tenantId: String(row.tenant_id),
      fileName: row.file_name,
      fileUrl: row.file_url ?? null,
      checksum: row.checksum ?? null,
      summaries: this.normalizeSummaries(row.summaries),
      status: row.status,
      error: row.error ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private normalizeSummaries(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map(String).filter(Boolean);
    }

    return [];
  }
}
