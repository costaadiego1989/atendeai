import { Inject, Injectable } from '@nestjs/common';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../domain/repositories/ITenantRepository';
import { EntityNotFoundException, ValidationErrorException } from '../../../../shared/domain/exceptions/DomainExceptions';
import { TwilioManagementAcl } from '../../infrastructure/acl/TwilioManagementAcl';
import { WhatsAppConfig } from '../../domain/entities/WhatsAppConfig';
import { TenantDomainEventPublisher } from '../services/TenantDomainEventPublisher';

@Injectable()
export class RefreshTwilioWhatsAppSenderStatusUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
    private readonly twilioManagementAcl: TwilioManagementAcl,
    private readonly tenantDomainEventPublisher: TenantDomainEventPublisher,
  ) {}

  async execute(tenantId: string, branchId?: string) {
    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new EntityNotFoundException('Tenant', tenantId);
    }

    if (branchId) {
      const branch = await this.resolveBranch(tenantId, branchId);
      const override = branch.whatsAppConfigOverride;
      if (!override || override.provider !== 'TWILIO') {
        throw new ValidationErrorException('Branch WhatsApp provider is not Twilio');
      }

      const senderSid = override.credentials.senderSid;
      if (!senderSid) {
        throw new ValidationErrorException('Twilio sender SID is not configured');
      }

      const sender = await this.twilioManagementAcl.getSender(
        senderSid,
        this.resolveTwilioAccount(override.credentials),
        { tenantId },
      );

      await this.tenantRepository.updateBranch(branch.id.toValue(), {
        tenantId,
        name: branch.name,
        cnpj: branch.cnpj,
        phone: branch.phone,
        email: branch.email,
        whatsappNumber: branch.whatsappNumber,
        instagramAccountId: branch.instagramAccountId,
        whatsAppConfigOverride: {
          provider: 'TWILIO',
          credentials: {
            ...override.credentials,
            senderSid: sender.sid,
            senderId: sender.senderId,
            wabaId: sender.configuration?.wabaId || override.credentials.wabaId,
            senderStatus: sender.status === 'ONLINE' ? 'ACTIVE' : sender.status,
          },
          webhookSecret: override.webhookSecret ?? null,
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

      return {
        provider: 'TWILIO' as const,
        senderSid: sender.sid,
        senderId: sender.senderId,
        status: sender.status === 'ONLINE' ? 'ACTIVE' : sender.status,
        verificationRequired: sender.status !== 'ONLINE',
      };
    }

    if (!tenant.whatsAppConfig) {
      throw new EntityNotFoundException('Tenant', tenantId);
    }

    if (tenant.whatsAppConfig.provider !== 'TWILIO') {
      throw new ValidationErrorException('Tenant WhatsApp provider is not Twilio');
    }

    const senderSid = tenant.whatsAppConfig.credentials.senderSid;
    if (!senderSid) {
      throw new ValidationErrorException('Twilio sender SID is not configured');
    }

    const sender = await this.twilioManagementAcl.getSender(
      senderSid,
      this.resolveTwilioAccount(tenant.whatsAppConfig.credentials),
      { tenantId },
    );
    const config = WhatsAppConfig.create({
      provider: 'TWILIO',
      credentials: {
        ...tenant.whatsAppConfig.credentials,
        senderSid: sender.sid,
        senderId: sender.senderId,
        wabaId:
          sender.configuration?.wabaId || tenant.whatsAppConfig.credentials.wabaId,
      },
      whatsappNumber: tenant.whatsAppConfig.whatsappNumber,
      webhookSecret: null,
    });

    if (sender.status === 'ONLINE') {
      config.activate();
    }

    tenant.configureWhatsApp(config);
    await this.tenantRepository.save(tenant);
    await this.tenantDomainEventPublisher.publishFromAggregate(tenant);

    return {
      provider: 'TWILIO' as const,
      senderSid: sender.sid,
      senderId: sender.senderId,
      status: sender.status,
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

  private resolveTwilioAccount(credentials: Record<string, string>) {
    return credentials.accountSid && credentials.authToken
      ? {
          accountSid: credentials.accountSid,
          authToken: credentials.authToken,
        }
      : undefined;
  }
}
