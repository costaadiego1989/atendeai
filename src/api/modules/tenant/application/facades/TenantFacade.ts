import { Inject, Injectable } from '@nestjs/common';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../domain/repositories/ITenantRepository';
import {
  InstagramConfig,
  ITenantFacade,
  MessagingChannel,
  MessagingChannelConfig,
  WhatsAppConfig,
} from './ITenantFacade';

@Injectable()
export class TenantFacade implements ITenantFacade {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
  ) {}

  async tenantExists(tenantId: string): Promise<boolean> {
    const tenant = await this.tenantRepository.findById(tenantId);
    return tenant !== null;
  }

  async getTenantName(tenantId: string): Promise<string | null> {
    const tenant = await this.tenantRepository.findById(tenantId);
    return tenant?.companyName.value ?? null;
  }

  async getWhatsAppConfig(tenantId: string): Promise<WhatsAppConfig | null> {
    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant || !tenant.whatsAppConfig) return null;

    return {
      provider: tenant.whatsAppConfig.provider,
      credentials: tenant.whatsAppConfig.credentials,
      webhookSecret: tenant.whatsAppConfig.webhookSecret,
      whatsappNumber: tenant.whatsAppConfig.whatsappNumber,
      status: tenant.whatsAppConfig.status,
      branchId: null,
    };
  }

  async getInstagramConfig(tenantId: string): Promise<InstagramConfig | null> {
    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant || !tenant.instagramConfig) return null;

    return {
      provider: 'META_GRAPH',
      credentials: {
        accessToken: tenant.instagramConfig.metaAccessToken,
      },
      instagramAccountId: tenant.instagramConfig.instagramAccountId,
      webhookSecret: tenant.instagramConfig.webhookSecret,
      status: tenant.instagramConfig.status,
    };
  }

  async getWhatsAppConfigByNumber(
    phoneNumber?: string | null,
    bubbleWhatsId?: string | null,
  ): Promise<{
    tenantId: string;
    branchId?: string | null;
    config: WhatsAppConfig;
  } | null> {
    let tenant = null;
    let branch = null;
    let branchId: string | null = null;

    if (phoneNumber?.trim()) {
      tenant = await this.tenantRepository.findByWhatsAppNumber(phoneNumber);
    }

    if (phoneNumber?.trim()) {
      const branchMatch =
        await this.tenantRepository.findBranchByWhatsAppNumber?.(phoneNumber);
      if (!tenant && branchMatch) {
        tenant = await this.tenantRepository.findById(branchMatch.tenantId);
      }

      if (
        branchMatch &&
        tenant &&
        branchMatch.tenantId === tenant.id.toString()
      ) {
        branch = branchMatch.branch;
        branchId = branchMatch.branch.id.toValue();
      }
    }

    if (!tenant && bubbleWhatsId?.trim()) {
      const repository = this.tenantRepository as ITenantRepository & {
        findByBubbleWhatsId?: (id: string) => Promise<any>;
      };

      if (typeof repository.findByBubbleWhatsId === 'function') {
        tenant = await repository.findByBubbleWhatsId(bubbleWhatsId);
      }
    }

    if (!tenant || !tenant.whatsAppConfig) return null;

    const branchOverride = branch?.whatsAppConfigOverride ?? null;
    const provider = branchOverride?.provider ?? tenant.whatsAppConfig.provider;
    const credentials =
      branchOverride?.credentials &&
      Object.keys(branchOverride.credentials).length > 0
        ? branchOverride.credentials
        : tenant.whatsAppConfig.credentials;
    const webhookSecret =
      branchOverride?.webhookSecret ?? tenant.whatsAppConfig.webhookSecret;

    const status =
      branchOverride?.provider === 'META_CLOUD' &&
      branchOverride.credentials?.status
        ? branchOverride.credentials.status
        : tenant.whatsAppConfig.status;

    return {
      tenantId: tenant.id.toString(),
      branchId,
      config: {
        provider,
        credentials:
          provider === 'TWILIO' && branch?.whatsappNumber
            ? {
                ...credentials,
                senderId: `whatsapp:+${branch.whatsappNumber.replace(/\D/g, '')}`,
              }
            : credentials,
        webhookSecret,
        whatsappNumber:
          branch?.whatsappNumber || tenant.whatsAppConfig.whatsappNumber,
        status,
        branchId,
      },
    };
  }

  async getChannelConfig(
    tenantId: string,
    channel: MessagingChannel,
    branchId?: string | null,
  ): Promise<MessagingChannelConfig | null> {
    const branch = branchId
      ? ((await this.tenantRepository.listBranches(tenantId)).find(
          (entry) => entry.id.toValue() === branchId,
        ) ?? null)
      : null;

    if (channel === 'WHATSAPP') {
      const config = await this.getWhatsAppConfig(tenantId);
      if (!config) {
        return null;
      }

      const branchOverride = branch?.whatsAppConfigOverride ?? null;
      const provider = branchOverride?.provider ?? config.provider;
      const credentials =
        branchOverride?.credentials &&
        Object.keys(branchOverride.credentials).length > 0
          ? branchOverride.credentials
          : config.credentials;
      const webhookSecret =
        branchOverride?.webhookSecret ?? config.webhookSecret;

      const channelStatus =
        branchOverride?.provider === 'META_CLOUD' &&
        branchOverride.credentials?.status
          ? branchOverride.credentials.status
          : config.status;

      return {
        channel: 'WHATSAPP',
        provider,
        credentials:
          provider === 'TWILIO' && branch?.whatsappNumber
            ? {
                ...credentials,
                senderId: `whatsapp:+${branch.whatsappNumber.replace(/\D/g, '')}`,
              }
            : credentials,
        webhookSecret,
        externalAccountId: branch?.whatsappNumber || config.whatsappNumber,
        status: channelStatus,
        branchId: branch?.id.toValue() ?? null,
      };
    }

    const config = await this.getInstagramConfig(tenantId);
    if (!config) {
      return null;
    }

    return {
      channel: 'INSTAGRAM',
      provider: config.provider,
      credentials: config.credentials,
      webhookSecret: config.webhookSecret,
      externalAccountId:
        branch?.instagramAccountId || config.instagramAccountId,
      status: config.status,
      branchId: branch?.id.toValue() ?? null,
    };
  }
}
