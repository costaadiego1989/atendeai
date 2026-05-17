import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { PaymentService } from '../services/PaymentService';
import {
  TENANT_REPOSITORY,
  ITenantRepository,
} from '@modules/tenant/domain/repositories/ITenantRepository';
import {
  ITenantFinancialAccountRepository,
  TENANT_FINANCIAL_ACCOUNT_REPOSITORY,
} from '../../domain/repositories/ITenantFinancialAccountRepository';

interface BootstrapTenantFinancialAccountInput {
  tenantId: string;
  companyType?: string;
  addressNumber?: string;
  complement?: string;
  birthDate?: string;
}

@Injectable()
export class BootstrapTenantFinancialAccountUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
    @Inject(TENANT_FINANCIAL_ACCOUNT_REPOSITORY)
    private readonly tenantFinancialAccountRepository: ITenantFinancialAccountRepository,
    private readonly paymentService: PaymentService,
  ) {}

  async execute(input: BootstrapTenantFinancialAccountInput) {
    const tenant = await this.tenantRepository.findById(input.tenantId);
    if (!tenant || !tenant.owner) {
      throw new ConflictException('Tenant owner data not found');
    }

    const normalizedBirthDate = input.birthDate?.trim() || null;
    if (normalizedBirthDate && tenant.ownerBirthDate !== normalizedBirthDate) {
      tenant.updateBusinessData({
        ownerBirthDate: normalizedBirthDate,
      });
      await this.tenantRepository.save(tenant);
    }

    const existing = await this.tenantFinancialAccountRepository.findByTenantId(
      input.tenantId,
    );
    if (existing) {
      return existing;
    }

    if (
      !tenant.address?.zipcode ||
      !tenant.address.street ||
      !tenant.address.neighborhood
    ) {
      throw new BadRequestException(
        'Complete o endereço da empresa antes de habilitar recebimentos',
      );
    }

    const subaccountPayload = {
      name: tenant.companyName.value,
      email: tenant.owner.email.value,
      cpfCnpj: tenant.cnpj.value,
      incomeValue: 5000,
      phone: tenant.owner.phone.value,
      mobilePhone: tenant.owner.phone.value,
      personType: 'LEGAL' as const,
      companyType: input.companyType || 'LIMITED',
      postalCode: tenant.address.zipcode.replace(/\D/g, ''),
      address: tenant.address.street,
      addressNumber: input.addressNumber?.trim() || 'S/N',
      province: tenant.address.neighborhood,
      city: tenant.address.city || undefined,
      state: tenant.address.state || undefined,
      complement: input.complement,
      birthDate: normalizedBirthDate || tenant.ownerBirthDate || null,
    };

    const account = await this.createOrRecoverSubaccount(
      subaccountPayload,
      tenant.cnpj.value,
      tenant.owner.email.value,
    );

    return this.tenantFinancialAccountRepository.save({
      id: account.id,
      tenantId: input.tenantId,
      provider: 'ASAAS',
      asaasAccountId: account.id,
      walletId: account.walletId,
      status: account.status || 'PENDING',
    });
  }

  private async createOrRecoverSubaccount(
    payload: {
      name: string;
      email: string;
      cpfCnpj: string;
      incomeValue: number;
      phone: string;
      mobilePhone: string;
      personType: 'LEGAL';
      companyType: string;
      postalCode: string;
      address: string;
      addressNumber: string;
      province: string;
      city?: string;
      state?: string;
      complement?: string;
      birthDate?: string | null;
    },
    cpfCnpj: string,
    email: string,
  ) {
    try {
      return await this.paymentService.createSubaccount(payload);
    } catch (error: any) {
      const message = String(error?.message || '');
      const duplicatedCnpj =
        message.includes('CNPJ') && message.includes('ja esta em uso');

      if (!duplicatedCnpj) {
        throw error;
      }

      const existingAccounts = await this.paymentService.listSubaccounts();
      const normalizedCpfCnpj = cpfCnpj.replace(/\D/g, '');
      const normalizedEmail = email.trim().toLowerCase();

      const recovered = existingAccounts.find((account) => {
        const accountCpfCnpj = account.cpfCnpj?.replace(/\D/g, '');
        const accountEmail = account.email?.trim().toLowerCase();
        return (
          accountCpfCnpj === normalizedCpfCnpj ||
          accountEmail === normalizedEmail
        );
      });

      if (!recovered?.walletId) {
        throw error;
      }

      return recovered;
    }
  }
}
