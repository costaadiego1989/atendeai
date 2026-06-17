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
  ): Promise<{
    contactId: string;
    name: string;
    phone: string;
    document?: string;
    email?: string;
    branchId?: string | null;
    prospectingOptOut: boolean;
  } | null>;

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

  markProspectingOptOut(tenantId: string, contactId: string): Promise<void>;

  addTag(tenantId: string, contactId: string, tag: string): Promise<void>;

  removeTag(tenantId: string, contactId: string, tag: string): Promise<void>;

  updateContactFields(
    tenantId: string,
    contactId: string,
    fields: {
      name?: string;
      document?: string;
      email?: string;
      notes?: string;
      stage?: 'LEAD' | 'PROSPECT' | 'OPPORTUNITY' | 'CUSTOMER' | 'INACTIVE';
    },
  ): Promise<void>;
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
  ): Promise<{
    contactId: string;
    name: string;
    phone: string;
    document?: string;
    email?: string;
    branchId?: string | null;
    prospectingOptOut: boolean;
  } | null> {
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
      prospectingOptOut: contact.prospectingOptOut,
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

  async markProspectingOptOut(
    tenantId: string,
    contactId: string,
  ): Promise<void> {
    const contact = await this.contactRepository.findById(tenantId, contactId);
    if (!contact) return;
    contact.markProspectingOptOut();
    await this.contactRepository.save(contact);
  }

  async addTag(
    tenantId: string,
    contactId: string,
    tag: string,
  ): Promise<void> {
    const contact = await this.contactRepository.findById(tenantId, contactId);
    if (!contact) {
      throw new Error(`Contact ${contactId} not found`);
    }
    contact.addTag(tag);
    await this.contactRepository.save(contact);
  }

  async removeTag(
    tenantId: string,
    contactId: string,
    tag: string,
  ): Promise<void> {
    const contact = await this.contactRepository.findById(tenantId, contactId);
    if (!contact) {
      throw new Error(`Contact ${contactId} not found`);
    }
    contact.removeTag(tag);
    await this.contactRepository.save(contact);
  }

  async updateContactFields(
    tenantId: string,
    contactId: string,
    fields: {
      name?: string;
      document?: string;
      email?: string;
      notes?: string;
      stage?: 'LEAD' | 'PROSPECT' | 'OPPORTUNITY' | 'CUSTOMER' | 'INACTIVE';
    },
  ): Promise<void> {
    const contact = await this.contactRepository.findById(tenantId, contactId);
    if (!contact) {
      throw new Error(`Contact ${contactId} not found`);
    }

    contact.updateDetails({
      name: fields.name ? ContactName.create(fields.name) : undefined,
      document: fields.document,
      email: fields.email,
      notes: fields.notes,
    });

    if (fields.stage) {
      contact.updateStage(ContactStageVO.create(fields.stage));
    }

    await this.contactRepository.save(contact);
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
