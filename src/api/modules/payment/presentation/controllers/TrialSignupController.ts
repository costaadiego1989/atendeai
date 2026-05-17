import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { InitiateTrialSubscriptionUseCase } from '../../application/use-cases/InitiateTrialSubscriptionUseCase';
import { ICreateTenantUseCase } from '../../../tenant/application/use-cases/interfaces/ICreateTenantUseCase';
import { TrialSignupDTO } from '../dtos/TrialSignupDTO';

@Controller('public/payments')
export class TrialSignupController {
  constructor(
    private readonly initiateTrialSubscriptionUseCase: InitiateTrialSubscriptionUseCase,
    @Inject(ICreateTenantUseCase)
    private readonly createTenantUseCase: ICreateTenantUseCase,
  ) {}

  @Post('trial/signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() dto: TrialSignupDTO) {
    const tenantResult = await this.createTenantUseCase.execute({
      companyName: dto.companyName,
      cnpj: dto.cnpj,
      ownerName: dto.name,
      ownerCpf: dto.cpf,
      ownerEmail: dto.email,
      ownerPhone: dto.phone,
      ownerPassword: dto.password,
      plan: dto.plan,
      businessType: dto.nicheCode,
      isTrial: true,
    });

    const result = await this.initiateTrialSubscriptionUseCase.execute({
      tenantId: tenantResult.id,
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      companyName: dto.companyName,
      plan: dto.plan,
      cnpj: dto.cnpj,
    });

    return {
      tenantId: tenantResult.id,
      ...result,
    };
  }
}
