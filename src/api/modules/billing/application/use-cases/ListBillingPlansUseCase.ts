import { Inject, Injectable } from '@nestjs/common';
import {
  BILLING_REPOSITORY,
  IBillingRepository,
} from '../../domain/repositories/IBillingRepository';
import {
  IListBillingPlansUseCase,
  ListBillingPlansInput,
  ListBillingPlansOutput,
} from './interfaces/IListBillingPlansUseCase';
import { applyEnterprisePlanBenefits } from '../support/BillingPlanBenefits';

@Injectable()
export class ListBillingPlansUseCase implements IListBillingPlansUseCase {
  constructor(
    @Inject(BILLING_REPOSITORY)
    private readonly billingRepository: IBillingRepository,
  ) {}

  async execute(input: ListBillingPlansInput): Promise<ListBillingPlansOutput> {
    const plans = await this.billingRepository.listPlans();

    return {
      tenantId: input.tenantId,
      plans: plans.map(applyEnterprisePlanBenefits),
    };
  }
}
