import { Inject, Injectable } from '@nestjs/common';
import {
  CONTACT_FACADE,
  IContactFacade,
} from '@modules/contact/application/facades/ContactFacade';
import {
  CONTACT_REPOSITORY,
  IContactRepository,
} from '@modules/contact/domain/repositories/IContactRepository';
import {
  IProspectExecutionRepository,
  PROSPECT_EXECUTION_REPOSITORY,
} from '../../domain/repositories/IProspectExecutionRepository';
import {
  HandleMetaQualityEventInput,
  HandleMetaQualityEventOutput,
  IHandleMetaQualityEventUseCase,
} from './interfaces/IHandleMetaQualityEventUseCase';

@Injectable()
export class HandleMetaQualityEventUseCase implements IHandleMetaQualityEventUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY)
    private readonly contactRepository: IContactRepository,
    @Inject(CONTACT_FACADE)
    private readonly contactFacade: IContactFacade,
    @Inject(PROSPECT_EXECUTION_REPOSITORY)
    private readonly executionRepository: IProspectExecutionRepository,
  ) {}

  async execute(
    input: HandleMetaQualityEventInput,
  ): Promise<HandleMetaQualityEventOutput> {
    const normalizedPhone = input.phone.replace(/\D/g, '');
    const contacts =
      await this.contactRepository.findAllByPhoneAcrossAllTenants(
        normalizedPhone,
      );

    if (contacts.length === 0) return { processed: 0 };

    let processed = 0;

    for (const { tenantId, contactId } of contacts) {
      await this.contactFacade.markProspectingOptOut(tenantId, contactId);

      const activeExecutions =
        await this.executionRepository.findActiveByContact(tenantId, contactId);

      for (const execution of activeExecutions) {
        execution.markAsOptedOut();
        await this.executionRepository.save(execution);
      }

      processed++;
    }

    return { processed };
  }
}
