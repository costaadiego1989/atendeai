import { Inject, Injectable } from '@nestjs/common';
import {
  CONTACT_FACADE,
  IContactFacade,
} from '@modules/contact/application/facades/ContactFacade';
import { IStepHandler } from '../../../application/ports/IStepHandler';
import {
  StepExecutionContext,
  StepExecutionResult,
} from '../../../application/ports/IStepExecutor';
import { StepType } from '../../../domain/value-objects/StepType';

@Injectable()
export class AddTagStepHandler implements IStepHandler {
  readonly type = StepType.ADD_TAG;

  constructor(
    @Inject(CONTACT_FACADE)
    private readonly contactFacade: IContactFacade,
  ) {}

  async execute(
    config: Record<string, unknown>,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult> {
    if (!context.contactId) {
      return { success: false, error: 'add_tag requires a contactId' };
    }
    const tag = (config['tag'] as string)?.trim();
    if (!tag) {
      return { success: false, error: 'add_tag requires a tag' };
    }

    await this.contactFacade.addTag(context.tenantId, context.contactId, tag);
    return { success: true, output: { tagAdded: tag } };
  }
}
