import { Inject, Injectable } from '@nestjs/common';
import {
  CONTACT_TIMELINE_REPOSITORY,
  IContactTimelineRepository,
} from '../ports/IContactTimelineRepository';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/DomainExceptions';
import {
  GetContactTimelineInput,
  IGetContactTimelineUseCase,
} from './interfaces/IGetContactTimelineUseCase';

@Injectable()
export class GetContactTimelineUseCase implements IGetContactTimelineUseCase {
  constructor(
    @Inject(CONTACT_TIMELINE_REPOSITORY)
    private readonly contactTimelineRepository: IContactTimelineRepository,
  ) {}

  async execute(input: GetContactTimelineInput) {
    const timeline = await this.contactTimelineRepository.getTimeline(
      input.tenantId,
      input.contactId,
    );

    if (!timeline) {
      throw new EntityNotFoundException('Contact', input.contactId);
    }

    return timeline;
  }
}
