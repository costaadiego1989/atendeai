import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IUseCase } from '@shared/application/IUseCase';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../domain/repositories/ITenantRepository';
import { TenantBranch } from '../../domain/entities/TenantBranch';
import { WhatsAppConfigStatus } from '../../domain/entities/WhatsAppConfig';

export interface GetWhatsAppConnectionInput {
  tenantId: string;
  branchId?: string;
}

interface WhatsAppConnectionConfig {
  provider: 'BUBBLEWHATS' | 'TWILIO' | 'D360';
  status: WhatsAppConfigStatus;
  whatsappNumber: string | null;
  senderId: string | null;
  senderSid: string | null;
  wabaId: string | null;
}

export interface GetWhatsAppConnectionOutput {
  scope: {
    type: 'TENANT' | 'BRANCH';
    branchId: string | null;
    label: string;
  };
  provider: 'TWILIO';
  mode: 'EMBEDDED_SIGNUP';
  embeddedSignupReady: boolean;
  embeddedSignup: {
    appId: string | null;
    configurationId: string | null;
    solutionId: string | null;
  };
  connection: WhatsAppConnectionConfig | null;
}

@Injectable()
export class GetWhatsAppConnectionUseCase implements IUseCase<
  GetWhatsAppConnectionInput,
  GetWhatsAppConnectionOutput
> {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    input: GetWhatsAppConnectionInput,
  ): Promise<GetWhatsAppConnectionOutput> {
    const { tenantId, branchId } = input;
    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    let scopeLabel = 'Matriz';
    let scopeType: 'TENANT' | 'BRANCH' = 'TENANT';
    let config: WhatsAppConnectionConfig | null = tenant.whatsAppConfig
      ? {
          provider: tenant.whatsAppConfig.provider,
          status: tenant.whatsAppConfig.status,
          whatsappNumber: tenant.whatsAppConfig.whatsappNumber,
          senderId: tenant.whatsAppConfig.credentials.senderId ?? null,
          senderSid: tenant.whatsAppConfig.credentials.senderSid ?? null,
          wabaId: tenant.whatsAppConfig.credentials.wabaId ?? null,
        }
      : null;

    if (branchId) {
      const branches = await this.tenantRepository.listBranches(tenantId);
      const branch = branches.find((item) => item.id.toValue() === branchId);
      if (!branch) {
        throw new NotFoundException(
          `Branch with ID ${branchId} not found for tenant ${tenantId}`,
        );
      }

      scopeLabel = branch.name;
      scopeType = 'BRANCH';
      config = this.mapBranchConnection(branch);
    }

    return {
      scope: {
        type: scopeType,
        branchId: branchId ?? null,
        label: scopeLabel,
      },
      provider: 'TWILIO',
      mode: 'EMBEDDED_SIGNUP',
      embeddedSignupReady:
        !!this.configService.get<string>('TWILIO_EMBEDDED_SIGNUP_APP_ID') &&
        !!this.configService.get<string>(
          'TWILIO_EMBEDDED_SIGNUP_CONFIGURATION_ID',
        ) &&
        !!this.configService.get<string>('TWILIO_EMBEDDED_SIGNUP_SOLUTION_ID'),
      embeddedSignup: {
        appId:
          this.configService.get<string>('TWILIO_EMBEDDED_SIGNUP_APP_ID') ||
          null,
        configurationId:
          this.configService.get<string>(
            'TWILIO_EMBEDDED_SIGNUP_CONFIGURATION_ID',
          ) || null,
        solutionId:
          this.configService.get<string>(
            'TWILIO_EMBEDDED_SIGNUP_SOLUTION_ID',
          ) || null,
      },
      connection: config,
    };
  }

  private mapBranchConnection(
    branch: TenantBranch,
  ): WhatsAppConnectionConfig | null {
    if (!branch.whatsAppConfigOverride) {
      return null;
    }

    const credentials = branch.whatsAppConfigOverride.credentials ?? {};
    const senderStatus: WhatsAppConfigStatus =
      credentials.senderStatus === 'ONLINE'
        ? 'ACTIVE'
        : credentials.senderStatus === 'ACTIVE' ||
            credentials.senderStatus === 'INACTIVE' ||
            credentials.senderStatus === 'PENDING_VERIFICATION'
          ? credentials.senderStatus
          : 'INACTIVE';

    return {
      provider: branch.whatsAppConfigOverride.provider,
      status: senderStatus,
      whatsappNumber: branch.whatsappNumber ?? null,
      senderId: credentials.senderId ?? null,
      senderSid: credentials.senderSid ?? null,
      wabaId: credentials.wabaId ?? null,
    };
  }
}
