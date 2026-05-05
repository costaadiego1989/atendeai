import { ContactTimelineResult } from '../../ports/IContactTimelineRepository';

export interface GetContactTimelineInput {
  tenantId: string;
  contactId: string;
}

export interface IGetContactTimelineUseCase {
  execute(input: GetContactTimelineInput): Promise<ContactTimelineResult>;
}

export const IGetContactTimelineUseCase = Symbol('IGetContactTimelineUseCase');
