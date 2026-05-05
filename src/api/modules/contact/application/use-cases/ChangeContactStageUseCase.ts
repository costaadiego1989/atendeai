import { Inject, Injectable } from '@nestjs/common';
import { ContactStageVO } from '../../domain/value-objects/ContactStage';
import {
  IContactRepository,
  CONTACT_REPOSITORY,
} from '../../domain/repositories/IContactRepository';
import {
  DomainException,
  EntityNotFoundException,
} from '@shared/domain/exceptions/DomainExceptions';
import {
  IChangeContactStageUseCase,
  ChangeContactStageInput,
  ChangeContactStageOutput,
} from './interfaces/IChangeContactStageUseCase';
import { ContactDomainEventPublisher } from '../services/ContactDomainEventPublisher';

@Injectable()
export class ChangeContactStageUseCase implements IChangeContactStageUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY)
    private readonly contactRepository: IContactRepository,
    private readonly contactDomainEventPublisher: ContactDomainEventPublisher,
  ) {}

  async execute(
    input: ChangeContactStageInput,
  ): Promise<ChangeContactStageOutput> {
    const contact = await this.contactRepository.findById(
      input.tenantId,
      input.contactId,
    );

    if (!contact) {
      throw new EntityNotFoundException('Contact', input.contactId);
    }

    if (contact.tenantId.toString() !== input.tenantId) {
      throw new DomainException(
        'Unauthorized access to contact',
        'UNAUTHORIZED',
      );
    }

    const previousStage = contact.stage.value;
    contact.updateStage(ContactStageVO.create(input.newStage));

    await this.contactRepository.save(contact);
    await this.contactDomainEventPublisher.publishFromAggregate(contact);

    return {
      id: contact.id.toString(),
      stage: contact.stage.value,
      previousStage,
      updatedAt: contact.updatedAt,
    };
  }
}
