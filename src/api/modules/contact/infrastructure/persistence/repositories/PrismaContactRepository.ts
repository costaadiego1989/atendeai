import { Injectable } from '@nestjs/common';
import { IContactRepository } from '@modules/contact/domain/repositories/IContactRepository';
import { Contact } from '@modules/contact/domain/entities/Contact';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { ContactMapper } from '../mappers/ContactMapper';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaContactRepository implements IContactRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(contact: Contact): Promise<void> {
    const data = ContactMapper.toPersistence(contact);
    await this.prisma.contact.upsert({
      where: { id: data.id },
        create: {
          id: data.id,
          tenantId: data.tenantId,
          name: data.name,
        phone: data.phone,
        email: data.email,
        stage: data.stage,
        tags: data.tags,
        notes: data.notes,
        lastInteraction: data.lastInteraction,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      },
        update: {
          tenantId: data.tenantId,
          name: data.name,
        phone: data.phone,
        email: data.email,
        stage: data.stage,
        tags: data.tags,
        notes: data.notes,
        lastInteraction: data.lastInteraction,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        },
      });
    await this.prisma.$executeRaw(Prisma.sql`
        UPDATE contact_schema.contacts
        SET branch_id = ${data.branchId}::uuid
        WHERE id = ${data.id}::uuid
      `);
    await this.prisma.$executeRaw(Prisma.sql`
        UPDATE contact_schema.contacts
        SET document = ${data.document}
        WHERE id = ${data.id}::uuid
      `);
  }

  async findById(tenantId: string, id: string): Promise<Contact | null> {
    const raw = await this.prisma.contact.findUnique({
      where: {
        tenantId_id: {
          tenantId,
          id,
        },
      },
    });
    if (!raw) return null;

    const [documentById, branchById] = await Promise.all([
      this.findDocumentsByContactIds([raw.id]),
      this.findBranchIdsByContactIds([raw.id]),
    ]);
    return ContactMapper.toDomain({
      ...raw,
      branchId: branchById.get(raw.id) ?? null,
      document: documentById.get(raw.id) ?? null,
    });
  }

  async findByPhone(tenantId: string, phone: string): Promise<Contact | null> {
    const raw = await this.prisma.contact.findFirst({
      where: { tenantId, phone },
    });
    if (!raw) return null;

    const [documentById, branchById] = await Promise.all([
      this.findDocumentsByContactIds([raw.id]),
      this.findBranchIdsByContactIds([raw.id]),
    ]);
    return ContactMapper.toDomain({
      ...raw,
      branchId: branchById.get(raw.id) ?? null,
      document: documentById.get(raw.id) ?? null,
    });
  }

  async findAllByTenant(
    tenantId: string,
    filters: {
      page?: number;
      limit?: number;
      stage?: string;
      tag?: string;
      branchId?: string;
    } = {},
  ): Promise<{ data: Contact[]; total: number }> {
    const { page = 1, limit = 20, stage, tag, branchId } = filters;

    const offset = (page - 1) * limit;
    const stageClause = stage
      ? Prisma.sql`AND c.stage = ${stage}`
      : Prisma.empty;
    const tagClause = tag
      ? Prisma.sql`AND c.tags::jsonb @> ${JSON.stringify([tag])}::jsonb`
      : Prisma.empty;
    const branchClause = branchId
      ? Prisma.sql`AND c.branch_id = ${branchId}::uuid`
      : Prisma.empty;

    const excludeUsersClause = Prisma.sql`
      AND c.phone NOT IN (
        SELECT u.phone
        FROM tenant_schema.users u
        WHERE u.tenant_id = ${tenantId}::uuid
      )
    `;

    const rows = await this.prisma.$queryRaw<Array<Prisma.ContactGetPayload<{}> & { document: string | null; branchId?: string | null }>>`
      SELECT c.*, c.document, c.branch_id AS "branchId"
      FROM contact_schema.contacts c
      WHERE c.tenant_id = ${tenantId}::uuid
      ${excludeUsersClause}
      ${stageClause}
      ${tagClause}
      ${branchClause}
      ORDER BY c.created_at DESC
      OFFSET ${offset}
      LIMIT ${limit}
    `;

    const totalRows = await this.prisma.$queryRaw<Array<{ total: bigint | number }>>`
      SELECT COUNT(*) AS total
      FROM contact_schema.contacts c
      WHERE c.tenant_id = ${tenantId}::uuid
      ${excludeUsersClause}
      ${stageClause}
      ${tagClause}
      ${branchClause}
    `;

    const documentById = await this.findDocumentsByContactIds(rows.map((item) => item.id));

    return {
      data: rows.map((item) =>
        ContactMapper.toDomain({
          ...item,
          document: documentById.get(item.id) ?? null,
        }),
      ),
      total: Number(totalRows[0]?.total ?? 0),
    };
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const conversations = await tx.conversation.findMany({
        where: {
          tenantId,
          contactId: id,
        },
        select: { id: true },
      });

      if (conversations.length > 0) {
        await tx.message.deleteMany({
          where: {
            conversationId: {
              in: conversations.map((conversation) => conversation.id),
            },
          },
        });
      }

      await tx.conversation.deleteMany({
        where: {
          tenantId,
          contactId: id,
        },
      });

      await tx.contact.delete({
        where: {
          tenantId_id: {
            tenantId,
            id,
          },
        },
      });
    });
  }

  private async findDocumentsByContactIds(
    contactIds: string[],
  ): Promise<Map<string, string | null>> {
    if (!contactIds.length) {
      return new Map();
    }

    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; document: string | null }>
    >(Prisma.sql`
        SELECT id, document
        FROM contact_schema.contacts
        WHERE id IN (${Prisma.join(
          contactIds.map((contactId) => Prisma.sql`${contactId}::uuid`),
        )})
      `);

    return new Map(rows.map((row) => [row.id, row.document ?? null]));
  }

  private async findBranchIdsByContactIds(
    contactIds: string[],
  ): Promise<Map<string, string | null>> {
    if (!contactIds.length) {
      return new Map();
    }

    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; branch_id: string | null }>
    >(Prisma.sql`
        SELECT id, branch_id
        FROM contact_schema.contacts
        WHERE id IN (${Prisma.join(
          contactIds.map((contactId) => Prisma.sql`${contactId}::uuid`),
        )})
      `);

    return new Map(rows.map((row) => [row.id, row.branch_id ?? null]));
  }
}
