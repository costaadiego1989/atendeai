import { Inject, Injectable } from '@nestjs/common';
import {
  IContactRepository,
  CONTACT_REPOSITORY,
} from '../../domain/repositories/IContactRepository';
import {
  UpdateContactInput,
  UpdateContactOutput,
  IUpdateContactUseCase,
} from './interfaces/IUpdateContactUseCase';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/DomainExceptions';
import { ContactName } from '../../domain/value-objects/ContactName';
import { ContactDomainEventPublisher } from '../services/ContactDomainEventPublisher';

@Injectable()
export class UpdateContactUseCase implements IUpdateContactUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY)
    private readonly contactRepository: IContactRepository,
    private readonly contactDomainEventPublisher: ContactDomainEventPublisher,
  ) {}

  async execute(input: UpdateContactInput): Promise<UpdateContactOutput> {
    const contact = await this.contactRepository.findById(
      input.tenantId,
      input.contactId,
    );

    if (!contact) {
      throw new EntityNotFoundException('Contact', input.contactId);
    }

    contact.updateDetails({
      name: input.name ? ContactName.create(input.name) : undefined,
      document: input.document?.trim() || undefined,
      email: input.email,
      notes: input.notes,
      tags: input.tags,
    });

    await this.contactRepository.save(contact);
    await this.contactDomainEventPublisher.publishFromAggregate(contact);

    return {
      id: contact.id.toString(),
      name: contact.name.value,
      phone: contact.phone,
      document: contact.document,
      email: contact.email,
      stage: contact.stage.value,
      tags: contact.tags,
      notes: contact.notes,
    };
  }
}
