import { Contact } from '@modules/contact/domain/entities/Contact';
import { TenantId } from '@shared/domain/TenantId';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { ContactName } from '@modules/contact/domain/value-objects/ContactName';
import {
  ContactStageVO,
  ContactStage,
} from '@modules/contact/domain/value-objects/ContactStage';
import { Contact as PrismaContact } from '@prisma/client';

type PrismaContactWithDocument = PrismaContact & {
  document?: string | null;
  branchId?: string | null;
};

export class ContactMapper {
  public static toDomain(raw: PrismaContactWithDocument): Contact {
    return Contact.reconstitute(
      {
        tenantId: TenantId.create(raw.tenantId),
        branchId: raw.branchId || undefined,
        name: ContactName.create(raw.name),
        phone: raw.phone,
        document: raw.document || undefined,
        email: raw.email || undefined,
        stage: ContactStageVO.create(raw.stage as ContactStage),
        tags: raw.tags as string[],
        notes: raw.notes || undefined,
        lastInteraction: raw.lastInteraction || undefined,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      },
      new UniqueEntityID(raw.id),
    );
  }

  public static toPersistence(contact: Contact) {
    return {
      id: contact.id.toString(),
      tenantId: contact.tenantId.toString(),
      branchId: contact.branchId || null,
      name: contact.name.value,
      phone: contact.phone,
      document: contact.document || null,
      email: contact.email || null,
      stage: contact.stage.value,
      tags: contact.tags,
      notes: contact.notes || null,
      lastInteraction: contact.lastInteraction || null,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
    };
  }
}
