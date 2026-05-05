import { IUseCase } from '@shared/application/IUseCase';
import { ContactStage } from '../../../domain/value-objects/ContactStage';

export interface ChangeContactStageInput {
  tenantId: string;
  contactId: string;
  newStage: ContactStage;
}

export interface ChangeContactStageOutput {
  id: string;
  stage: string;
  previousStage: string;
  updatedAt: Date;
}

export interface IChangeContactStageUseCase extends IUseCase<
  ChangeContactStageInput,
  ChangeContactStageOutput
> {}
export const IChangeContactStageUseCase = Symbol('IChangeContactStageUseCase');
