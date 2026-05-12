import { Inject, Injectable } from '@nestjs/common';
import {
  IContactFacade,
  CONTACT_FACADE,
} from '../../../../contact/application/facades/ContactFacade';
import { InboundMessageContext } from './InboundMessageContext';

@Injectable()
export class IdentifyContactStep {
  constructor(
    @Inject(CONTACT_FACADE)
    private readonly contactFacade: IContactFacade,
  ) {}

  async execute(ctx: InboundMessageContext): Promise<InboundMessageContext> {
    const { contactId } = await this.contactFacade.identifyContact(
      ctx.input.tenantId,
      ctx.input.fromPhone,
      ctx.input.fromPhone,
    );

    const contact = await this.contactFacade.getContactById(
      ctx.input.tenantId,
      contactId,
    );

    const branchId = ctx.input.branchId ?? contact?.branchId ?? null;

    return { ...ctx, contactId, branchId };
  }
}
