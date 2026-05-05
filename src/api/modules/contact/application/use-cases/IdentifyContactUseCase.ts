import { Inject, Injectable } from '@nestjs/common';
import { Contact } from '../../domain/entities/Contact';
import { ContactName } from '../../domain/value-objects/ContactName';
import { TenantId } from '../../../../shared/domain/TenantId';
import {
  IContactRepository,
  CONTACT_REPOSITORY,
} from '../../domain/repositories/IContactRepository';
import {
  IIdentifyContactUseCase,
  IdentifyContactInput,
  IdentifyContactOutput,
} from './interfaces/IIdentifyContactUseCase';
import { ContactDomainEventPublisher } from '../services/ContactDomainEventPublisher';

@Injectable()
export class IdentifyContactUseCase implements IIdentifyContactUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY)
    private readonly contactRepository: IContactRepository,
    private readonly contactDomainEventPublisher: ContactDomainEventPublisher,
  ) {}

  async execute(input: IdentifyContactInput): Promise<IdentifyContactOutput> {
    const tenantId = TenantId.create(input.tenantId);

    let contact = await this.contactRepository.findByPhone(
      tenantId.toString(),
      input.phone,
    );

    if (contact) {
      contact.recordInteraction();
    } else {
      contact = Contact.create({
        tenantId,
        name: ContactName.create(input.name),
        phone: input.phone,
      });
    }

    await this.contactRepository.save(contact);
    await this.contactDomainEventPublisher.publishFromAggregate(contact);

    return {
      id: contact.id.toString(),
      tenantId: contact.tenantId.toString(),
      name: contact.name.value,
      phone: contact.phone,
      stage: contact.stage.value,
      lastInteraction: contact.lastInteraction,
    };
  }
}
