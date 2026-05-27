import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { IDocumentChunkWriter } from '../../../application/ports/IDocumentChunkWriter';

@Injectable()
export class PrismaDocumentChunkCounter implements IDocumentChunkWriter {
  constructor(private readonly prisma: PrismaService) {}

  async countByDocument(tenantId: string, documentId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>(
      Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM tenant_schema.tenant_document_chunks
        WHERE tenant_id = ${tenantId}::uuid
          AND document_id = ${documentId}::uuid
      `,
    );

    return Number(rows[0]?.count ?? 0);
  }
}
