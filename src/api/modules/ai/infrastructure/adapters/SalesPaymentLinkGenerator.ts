import { Inject, Injectable } from '@nestjs/common';
import {
  ICreatePaymentLinkUseCase,
  ICreatePaymentLinkUseCase as ICreatePaymentLinkUseCaseToken,
} from '@modules/sales/application/use-cases/interfaces/ICreatePaymentLinkUseCase';
import {
  GeneratePaymentLinkInput,
  GeneratePaymentLinkOutput,
  IPaymentLinkGenerator,
} from '../../application/ports/IPaymentLinkGenerator';

@Injectable()
export class SalesPaymentLinkGenerator implements IPaymentLinkGenerator {
  constructor(
    @Inject(ICreatePaymentLinkUseCaseToken)
    private readonly createPaymentLinkUseCase: ICreatePaymentLinkUseCase,
  ) {}

  async generate(
    input: GeneratePaymentLinkInput,
  ): Promise<GeneratePaymentLinkOutput> {
    return this.createPaymentLinkUseCase.execute({
      tenantId: input.tenantId,
      name: input.name,
      value: input.value,
      billingType: 'UNDEFINED',
    });
  }
}
