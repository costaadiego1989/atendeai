import { Inject, Injectable } from '@nestjs/common';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../domain/repositories/ITenantRepository';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/DomainExceptions';
import { TwilioManagementAcl } from '../../infrastructure/acl/TwilioManagementAcl';
import { WhatsAppConfig } from '../../domain/entities/WhatsAppConfig';
import { TenantDomainEventPublisher } from '../services/TenantDomainEventPublisher';
import { ConfigService } from '@nestjs/config';
import { TenantTwilioAccountService } from '../services/TenantTwilioAccountService';
import { TenantBillingCapacityService } from '@shared/infrastructure/billing/TenantBillingCapacityService';

export interface RegisterTwilioWhatsAppSenderInput {
  tenantId: string;
  branchId?: string;
  phoneNumber: string;
  wabaId: string;
  verificationMethod?: 'sms' | 'voice';
  profileName?: string;
  about?: string;
  address?: string;
  description?: string;
  logoUrl?: string;
}

@Injectable()
export class RegisterTwilioWhatsAppSenderUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
    private readonly twilioManagementAcl: TwilioManagementAcl,
    private readonly tenantDomainEventPublisher: TenantDomainEventPublisher,
    private readonly configService: ConfigService,
    private readonly tenantTwilioAccountService: TenantTwilioAccountService,
    private readonly billingCapacityService: TenantBillingCapacityService,
  ) {}

  async execute(input: RegisterTwilioWhatsAppSenderInput) {
    const tenant = await this.tenantRepository.findById(input.tenantId);
    if (!tenant) {
      throw new EntityNotFoundException('Tenant', input.tenantId);
    }

    const branch = input.branchId
      ? await this.resolveBranch(input.tenantId, input.branchId)
      : null;

    const normalizedPhone = this.normalizeBrazilPhone(input.phoneNumber);
    const currentWhatsappNumber = branch
      ? (branch.whatsappNumber ?? '')
      : (tenant.whatsAppConfig?.whatsappNumber ?? '');

    if (
      normalizedPhone &&
      normalizedPhone !== currentWhatsappNumber.replace(/\D/g, '')
    ) {
      await this.billingCapacityService.assertCanAdd(
        input.tenantId,
        'whatsappNumbers',
      );
    }

    const twilioAccount =
      await this.tenantTwilioAccountService.ensureTenantAccount({
        tenantId: input.tenantId,
        companyName: tenant.companyName.value,
      });
    const twilioCredentials =
      this.tenantTwilioAccountService.toCredentials(twilioAccount);
    const sender = await this.twilioManagementAcl.createSender(
      {
        senderId: `whatsapp:+${normalizedPhone}`,
        wabaId: input.wabaId,
        verificationMethod: input.verificationMethod || 'sms',
        account: twilioCredentials,
        callbackUrl: this.resolveWebhookUrl(),
        statusCallbackUrl: this.configService.get<string>(
          'TWILIO_WHATSAPP_STATUS_CALLBACK_URL',
        ),
        profile: {
          name: input.profileName || branch?.name || tenant.companyName.value,
          ...(input.about ? { about: input.about } : {}),
          ...(input.address ? { address: input.address } : {}),
          ...(input.description ? { description: input.description } : {}),
          ...(input.logoUrl ? { logoUrl: input.logoUrl } : {}),
        },
      },
      { tenantId: input.tenantId },
    );

    if (branch) {
      await this.tenantRepository.updateBranch(branch.id.toValue(), {
        tenantId: input.tenantId,
        name: branch.name,
        cnpj: branch.cnpj,
        phone: branch.phone,
        email: branch.email,
        whatsappNumber: normalizedPhone,
        instagramAccountId: branch.instagramAccountId,
        whatsAppConfigOverride: {
          provider: 'TWILIO',
          credentials: {
            accountSid: twilioAccount.accountSid,
            authToken: twilioAccount.authToken,
            senderSid: sender.sid,
            senderId: sender.senderId,
            wabaId: sender.configuration?.wabaId || input.wabaId,
            senderStatus: sender.status,
          },
          webhookSecret: null,
        },
        zipcode: branch.address?.zipcode ?? null,
        street: branch.address?.street ?? null,
        streetNumber: branch.address?.streetNumber ?? null,
        neighborhood: branch.address?.neighborhood ?? null,
        city: branch.address?.city ?? null,
        state: branch.address?.state ?? null,
        operatingHours: branch.operatingHours,
        isHeadquarters: branch.isHeadquarters,
        active: branch.active,
      });
    } else {
      const config = WhatsAppConfig.create({
        provider: 'TWILIO',
        credentials: {
          accountSid: twilioAccount.accountSid,
          authToken: twilioAccount.authToken,
          senderSid: sender.sid,
          senderId: sender.senderId,
          wabaId: sender.configuration?.wabaId || input.wabaId,
        },
        whatsappNumber: normalizedPhone,
        webhookSecret: null,
      });

      if (sender.status === 'ONLINE') {
        config.activate();
      }

      tenant.configureWhatsApp(config);
      await this.tenantRepository.save(tenant);
      await this.tenantDomainEventPublisher.publishFromAggregate(tenant);
    }

    return {
      provider: 'TWILIO' as const,
      senderSid: sender.sid,
      senderId: sender.senderId,
      status: sender.status,
      whatsappNumber: normalizedPhone,
      verificationRequired: sender.status !== 'ONLINE',
    };
  }

  private async resolveBranch(tenantId: string, branchId: string) {
    const branches = await this.tenantRepository.listBranches(tenantId);
    const branch = branches.find((item) => item.id.toValue() === branchId);
    if (!branch) {
      throw new EntityNotFoundException('TenantBranch', branchId);
    }

    return branch;
  }

  private resolveWebhookUrl(): string | undefined {
    const direct = this.configService.get<string>(
      'TWILIO_WHATSAPP_WEBHOOK_URL',
    );
    if (direct?.trim()) {
      return direct.trim();
    }

    const appPublicBaseUrl = this.configService.get<string>(
      'APP_PUBLIC_BASE_URL',
    );
    if (!appPublicBaseUrl?.trim()) {
      return undefined;
    }

    return `${appPublicBaseUrl.replace(/\/$/, '')}/api/v1/webhooks/whatsapp`;
  }

  private normalizeBrazilPhone(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 13);

    if (!digits) {
      return '';
    }

    if (digits.startsWith('55')) {
      return digits;
    }

    if (digits.length === 10 || digits.length === 11) {
      return `55${digits}`;
    }

    return digits;
  }
}
