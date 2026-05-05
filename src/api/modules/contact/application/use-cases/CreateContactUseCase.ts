import { Inject, Injectable } from '@nestjs/common';
import { Contact } from '../../domain/entities/Contact';
import { ContactName } from '../../domain/value-objects/ContactName';
import { TenantId } from '../../../../shared/domain/TenantId';
import {
  IContactRepository,
  CONTACT_REPOSITORY,
} from '../../domain/repositories/IContactRepository';
import { ValidationErrorException } from '../../../../shared/domain/exceptions/DomainExceptions';
import {
  ICreateContactUseCase,
  CreateContactInput,
  CreateContactOutput,
} from './interfaces/ICreateContactUseCase';
import { ContactDomainEventPublisher } from '../services/ContactDomainEventPublisher';

@Injectable()
export class CreateContactUseCase implements ICreateContactUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY)
    private readonly contactRepository: IContactRepository,
    private readonly contactDomainEventPublisher: ContactDomainEventPublisher,
  ) {}

  async execute(input: CreateContactInput): Promise<CreateContactOutput> {
    const tenantId = TenantId.create(input.tenantId);

    const existingContact = await this.contactRepository.findByPhone(
      tenantId.toString(),
      input.phone,
    );

    if (existingContact) {
      throw new ValidationErrorException(
        'Contact with this phone already exists for this tenant',
      );
    }

    const document = input.document?.trim();
    if (!document) {
      throw new ValidationErrorException('Document is required');
    }

    const contact = Contact.create({
      tenantId,
      branchId: input.branchId,
      name: ContactName.create(input.name),
      phone: input.phone,
      document,
      email: input.email,
      notes: input.notes,
      tags: input.tags || [],
    });

    await this.contactRepository.save(contact);
    await this.contactDomainEventPublisher.publishFromAggregate(contact);

    return {
      id: contact.id.toString(),
      tenantId: contact.tenantId.toString(),
      branchId: contact.branchId,
      name: contact.name.value,
      phone: contact.phone,
      document: contact.document,
      stage: contact.stage.value,
      tags: contact.tags,
      createdAt: contact.createdAt,
    };
  }
}
