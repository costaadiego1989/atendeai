import { Injectable, Inject } from '@nestjs/common';
import {
  IIdentifyContactUseCase,
  IDENTIFY_CONTACT_USE_CASE,
} from '../use-cases/interfaces/IIdentifyContactUseCase';
import {
  CONTACT_REPOSITORY,
  IContactRepository,
} from '../../domain/repositories/IContactRepository';
import { Contact } from '../../domain/entities/Contact';
import { ContactName } from '../../domain/value-objects/ContactName';
import { ContactStageVO } from '../../domain/value-objects/ContactStage';
import { TenantId } from '@shared/domain/TenantId';

export interface IContactFacade {
  identifyContact(
    tenantId: string,
    phone: string,
    name: string,
  ): Promise<{ contactId: string; stage: string }>;

  getContactById(
    tenantId: string,
    contactId: string,
  ): Promise<{ contactId: string; name: string; phone: string; document?: string; email?: string; branchId?: string | null } | null>;

  ensureContact(input: {
    tenantId: string;
    name: string;
    phone: string;
    branchId?: string;
    document?: string;
    email?: string;
    notes?: string;
    tags?: string[];
    stage?: 'LEAD' | 'PROSPECT' | 'OPPORTUNITY' | 'CUSTOMER' | 'INACTIVE';
  }): Promise<{ contactId: string; created: boolean }>;

  upsertProspectContact(input: {
    tenantId: string;
    branchId?: string;
    name: string;
    phone: string;
    document?: string;
    email?: string;
    notes?: string;
    tags?: string[];
  }): Promise<{ contactId: string; created: boolean }>;

  findContactIdsForReengagementAudience(
    tenantId: string,
    limit: number,
  ): Promise<string[]>;
}

export const CONTACT_FACADE = 'CONTACT_FACADE';

@Injectable()
export class ContactFacade implements IContactFacade {
  constructor(
    @Inject(IDENTIFY_CONTACT_USE_CASE)
    private readonly identifyContactUseCase: IIdentifyContactUseCase,
    @Inject(CONTACT_REPOSITORY)
    private readonly contactRepository: IContactRepository,
  ) {}

  async identifyContact(
    tenantId: string,
    phone: string,
    name: string,
  ): Promise<{ contactId: string; stage: string }> {
    const result = await this.identifyContactUseCase.execute({
      tenantId,
      phone,
      name,
    });
    return {
      contactId: result.id,
      stage: result.stage,
    };
  }

  async getContactById(
    tenantId: string,
    contactId: string,
  ): Promise<{ contactId: string; name: string; phone: string; document?: string; email?: string; branchId?: string | null } | null> {
    const contact = await this.contactRepository.findById(tenantId, contactId);
    if (!contact) {
      return null;
    }

    return {
      contactId: contact.id.toString(),
      name: contact.name.value,
      phone: contact.phone,
      document: contact.document,
      email: contact.email,
      branchId: contact.branchId ?? null,
    };
  }

  async upsertProspectContact(input: {
    tenantId: string;
    branchId?: string;
    name: string;
    phone: string;
    document?: string;
    email?: string;
    notes?: string;
    tags?: string[];
  }): Promise<{ contactId: string; created: boolean }> {
    return this.ensureContact({
      ...input,
      stage: 'PROSPECT',
      tags: [...new Set([...(input.tags ?? []), 'temperature:cold'])],
    });
  }

  async ensureContact(input: {
    tenantId: string;
    name: string;
    phone: string;
    branchId?: string;
    document?: string;
    email?: string;
    notes?: string;
    tags?: string[];
    stage?: 'LEAD' | 'PROSPECT' | 'OPPORTUNITY' | 'CUSTOMER' | 'INACTIVE';
  }): Promise<{ contactId: string; created: boolean }> {
    const existing = await this.contactRepository.findByPhone(
      input.tenantId,
      input.phone,
    );

    if (existing) {
      return {
        contactId: existing.id.toString(),
        created: false,
      };
    }

    const contact = Contact.create({
      tenantId: TenantId.create(input.tenantId),
      branchId: input.branchId ?? undefined,
      name: ContactName.create(input.name),
      phone: input.phone,
      document: input.document,
      email: input.email,
      notes: input.notes,
      stage: input.stage ? ContactStageVO.create(input.stage) : undefined,
      tags: input.tags || [],
    });

    await this.contactRepository.save(contact);

    return {
      contactId: contact.id.toString(),
      created: true,
    };
  }

  async findContactIdsForReengagementAudience(
    tenantId: string,
    limit: number,
  ): Promise<string[]> {
    const contacts = await this.contactRepository.findAllByTenant(tenantId, {
      page: 1,
      limit: 100,
    });

    return contacts.data
      .filter(
        (row) =>
          !!row.lastInteraction &&
          !row.stage.isCustomer() &&
          row.stage.value !== 'INACTIVE',
      )
      .map((row) => row.id.toString())
      .slice(0, limit);
  }
}
