import { UniqueEntityID } from '../../../../../shared/domain/UniqueEntityID';
import { createHash } from 'crypto';
import { Tenant } from '../../../domain/entities/Tenant';
import { User } from '../../../domain/entities/User';
import { Role } from '../../../domain/value-objects/Role';
import { WhatsAppConfig } from '../../../domain/entities/WhatsAppConfig';
import { InstagramConfig } from '../../../domain/entities/InstagramConfig';
import { AIConfig, ToneType } from '../../../domain/entities/AIConfig';
import { CompanyName } from '../../../domain/value-objects/CompanyName';
import { CNPJ } from '../../../domain/value-objects/CNPJ';
import { Email } from '../../../domain/value-objects/Email';
import { Phone } from '../../../domain/value-objects/Phone';
import { Plan } from '../../../domain/value-objects/Plan';
import { CPF } from '../../../../../shared/domain/CPF';
import {
  WhatsAppConfigStatus,
  WhatsAppProvider,
} from '../../../domain/entities/WhatsAppConfig';
import { InstagramConfigStatus } from '../../../domain/entities/InstagramConfig';
import {
  Tenant as PrismaTenant,
  User as PrismaUser,
  AIConfig as PrismaAI,
} from '@prisma/client';
import { Promotion } from '../../../domain/value-objects/Promotion';
import { Address } from '../../../domain/value-objects/Address';

export type PrismaAIWithSales = PrismaAI & {
  salesInstructions?: string | null;
};

export type PrismaTenantWithRelations = PrismaTenant & {
  users?: Array<PrismaUser & { cpf?: string | null }>;
  whatsappConfig?: {
    id: string;
    tenantId: string;
    provider: string;
    credentials: Record<string, unknown>;
    whatsappNumber: string;
    webhookSecret: string | null;
    status: string;
    configuredAt: Date;
  } | null;
  instagramConfig?: {
    id: string;
    tenantId: string;
    metaAccessToken: string;
    instagramAccountId: string;
    webhookSecret: string;
    status: string;
    configuredAt: Date;
  } | null;
  aiConfig?: PrismaAIWithSales | null;
  apiKey?: string;
  promotions?: Record<string, unknown>[];
  businessType?: string | null;
  ownerBirthDate?: Date | string | null;
  description?: string | null;
  services?: string | null;
  zipcode?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  catalogUrl?: string | null;
  catalogFiles?: string[] | null;
  planStatus?: string | null;
  ownerUserId?: string | null;
};

export class TenantMapper {
  private static compactJson<T extends Record<string, unknown>>(input: T): T {
    return Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    ) as T;
  }

  private static resolveLegacyPromotionId(promotion: Record<string, unknown>): string {
    const hash = createHash('sha1');
    hash.update(
      [
        String(promotion.title ?? ''),
        String(promotion.description ?? ''),
        String(promotion.value ?? ''),
        String(promotion.expiresAt ?? ''),
        String(promotion.assignedUserId ?? ''),
      ].join('|'),
    );
    return hash.digest('hex');
  }

  private static toPromotion(rawPromotion: unknown): Promotion | null {
    if (!rawPromotion || typeof rawPromotion !== 'object') {
      return null;
    }

    const promotion = rawPromotion as Record<string, unknown>;

    try {
      const title =
        typeof promotion.title === 'string' ? promotion.title.trim() : '';
      const description =
        typeof promotion.description === 'string'
          ? promotion.description.trim()
          : '';
      const value =
        typeof promotion.value === 'string' ? promotion.value.trim() : '';

      if (!title || !description || !value) {
        return null;
      }

      const expiresAt =
        typeof promotion.expiresAt === 'string' &&
        promotion.expiresAt.trim().length > 0
          ? promotion.expiresAt.trim()
          : undefined;

      return Promotion.create({
        id:
          typeof promotion.id === 'string' && promotion.id.trim().length > 0
            ? promotion.id
            : TenantMapper.resolveLegacyPromotionId(promotion),
        title,
        description,
        value,
        imageUrl:
          typeof promotion.imageUrl === 'string' &&
          promotion.imageUrl.trim().length > 0
            ? promotion.imageUrl.trim()
            : undefined,
        expiresAt,
        assignedUserId:
          typeof promotion.assignedUserId === 'string' &&
          promotion.assignedUserId.trim().length > 0
            ? promotion.assignedUserId.trim()
            : undefined,
        assignedUserName:
          typeof promotion.assignedUserName === 'string' &&
          promotion.assignedUserName.trim().length > 0
            ? promotion.assignedUserName.trim()
            : undefined,
      });
    } catch {
      return null;
    }
  }

  static toDomain(raw: PrismaTenantWithRelations): Tenant {
    const users = raw.users || [];
    if (users.length === 0) {
      throw new Error(`Tenant ${raw.id} has no users in database`);
    }

    const userEntities = users.map((user) =>
      User.reconstitute(
        {
          name: user.name,
          email: Email.create(user.email),
          cpf: user.cpf ? CPF.create(user.cpf) : null,
          phone: Phone.create(user.phone),
          passwordHash: user.passwordHash,
          role: Role.create(user.role),
        },
        new UniqueEntityID(user.id),
        user.createdAt,
        user.createdAt,
      ),
    );

    let whatsAppConfig: WhatsAppConfig | null = null;
    if (raw.whatsappConfig) {
      whatsAppConfig = WhatsAppConfig.reconstitute(
        {
          provider: raw.whatsappConfig.provider as WhatsAppProvider,
          credentials:
            (raw.whatsappConfig.credentials as Record<string, string>) || {},
          whatsappNumber: raw.whatsappConfig.whatsappNumber,
          webhookSecret: raw.whatsappConfig.webhookSecret ?? null,
          status: raw.whatsappConfig.status as WhatsAppConfigStatus,
          configuredAt: raw.whatsappConfig.configuredAt,
        },
        new UniqueEntityID(raw.whatsappConfig.id),
        raw.whatsappConfig.configuredAt,
        raw.whatsappConfig.configuredAt,
      );
    }

    let instagramConfig: InstagramConfig | null = null;
    if (raw.instagramConfig) {
      instagramConfig = InstagramConfig.reconstitute(
        {
          metaAccessToken: raw.instagramConfig.metaAccessToken,
          instagramAccountId: raw.instagramConfig.instagramAccountId,
          webhookSecret: raw.instagramConfig.webhookSecret,
          status: raw.instagramConfig.status as InstagramConfigStatus,
          configuredAt: raw.instagramConfig.configuredAt,
        },
        new UniqueEntityID(raw.instagramConfig.id),
        raw.instagramConfig.configuredAt,
        raw.instagramConfig.configuredAt,
      );
    }

    let aiConfig: AIConfig | null = null;
    if (raw.aiConfig) {
      aiConfig = AIConfig.reconstitute(
        {
          systemPrompt: raw.aiConfig.systemPrompt,
          tone: raw.aiConfig.tone as ToneType,
          language: raw.aiConfig.language,
          maxTokensPerResponse: raw.aiConfig.maxTokensPerResponse,
          confidenceThreshold: Number(raw.aiConfig.confidenceThreshold),
          escalationMessage: raw.aiConfig.escalationMessage,
          businessRules: raw.aiConfig.businessRules as string[],
          salesInstructions: raw.aiConfig.salesInstructions || null,
          updatedAt: raw.aiConfig.updatedAt,
        },
        new UniqueEntityID(raw.aiConfig.id),
        raw.aiConfig.updatedAt,
        raw.aiConfig.updatedAt,
      );
    }

    return Tenant.reconstitute(
      {
        companyName: CompanyName.create(raw.companyName),
        cnpj: CNPJ.create(raw.cnpj),
        plan: Plan.create(raw.plan),
        planStatus: raw.planStatus || 'ACTIVE',
        ownerUserId:
          raw.ownerUserId ||
          userEntities.find((user) => user.role.value === 'OWNER')?.id.toValue() ||
          null,
        users: userEntities,
        whatsAppConfig,
        instagramConfig,
        aiConfig,
        businessType: raw.businessType || (raw as any).business_type || null,
        ownerBirthDate: raw.ownerBirthDate
          ? new Date(raw.ownerBirthDate).toISOString().slice(0, 10)
          : null,
        description: raw.description || null,
        services: raw.services || null,
        address: Address.create({
          zipcode: raw.zipcode || '',
          street: raw.street || '',
          streetNumber: raw.streetNumber || '',
          neighborhood: raw.neighborhood || '',
          city: raw.city || '',
          state: raw.state || '',
        }),
        catalogUrl: raw.catalogUrl || null,
        catalogFiles: (raw as any).catalogFiles || (raw as any).catalog_files || [],
        operatingHours: (raw as any).operatingHours || null,
        promotions: ((raw.promotions as unknown[]) || [])
          .map((promotion) => TenantMapper.toPromotion(promotion))
          .filter((promotion): promotion is Promotion => promotion !== null),
        apiKey: raw.apiKey || '',
      },
      new UniqueEntityID(raw.id),
      raw.createdAt,
      raw.updatedAt,
    );
  }

  static toPersistence(tenant: Tenant) {
    return {
      tenant: {
        id: tenant.id.toValue(),
        companyName: tenant.companyName.value,
        cnpj: tenant.cnpj.value,
        plan: tenant.plan.value,
        planStatus: tenant.planStatus,
        ownerUserId: tenant.ownerUserId,
        businessType: tenant.businessType,
        ownerBirthDate: tenant.ownerBirthDate,
        description: tenant.description,
        services: tenant.services,
        zipcode: tenant.address?.zipcode || null,
        street: tenant.address?.street || null,
        streetNumber: tenant.address?.streetNumber || null,
        neighborhood: tenant.address?.neighborhood || null,
        city: tenant.address?.city || null,
        state: tenant.address?.state || null,
        catalogUrl: tenant.catalogUrl,
        catalogFiles: tenant.catalogFiles,
        apiKey: tenant.apiKey || undefined,
        operatingHours: tenant.operatingHours as any,
        promotions: tenant.promotions.map((p) =>
          TenantMapper.compactJson({
            id: p.id,
            title: p.title,
            description: p.description,
            value: p.value,
            imageUrl: p.imageUrl,
            expiresAt: p.expiresAt,
            assignedUserId: p.assignedUserId,
            assignedUserName: p.assignedUserName,
          }),
        ),
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
      },
      users: tenant.users.map((u) => ({
        id: u.id.toValue(),
        tenantId: tenant.id.toValue(),
        name: u.name,
        email: u.email.value,
        cpf: u.cpf?.value ?? null,
        phone: u.phone.value,
        passwordHash: u.passwordHash,
        role: u.role.value,
        createdAt: tenant.createdAt,
      })),
      whatsappConfig: tenant.whatsAppConfig
        ? {
            id: tenant.whatsAppConfig.id.toValue(),
            tenantId: tenant.id.toValue(),
            provider: tenant.whatsAppConfig.provider,
            credentials: tenant.whatsAppConfig.credentials,
            whatsappNumber: tenant.whatsAppConfig.whatsappNumber,
            webhookSecret: tenant.whatsAppConfig.webhookSecret,
            status: tenant.whatsAppConfig.status,
            configuredAt: tenant.whatsAppConfig.configuredAt,
          }
        : null,
      instagramConfig: tenant.instagramConfig
        ? {
            id: tenant.instagramConfig.id.toValue(),
            tenantId: tenant.id.toValue(),
            metaAccessToken: tenant.instagramConfig.metaAccessToken,
            instagramAccountId: tenant.instagramConfig.instagramAccountId,
            webhookSecret: tenant.instagramConfig.webhookSecret,
            status: tenant.instagramConfig.status,
            configuredAt: tenant.instagramConfig.configuredAt,
          }
        : null,
      aiConfig: tenant.aiConfig
        ? {
            id: tenant.aiConfig.id.toValue(),
            tenantId: tenant.id.toValue(),
            systemPrompt: tenant.aiConfig.systemPrompt,
            tone: tenant.aiConfig.tone,
            language: tenant.aiConfig.language,
            maxTokensPerResponse: tenant.aiConfig.maxTokensPerResponse,
            confidenceThreshold: tenant.aiConfig.confidenceThreshold,
            escalationMessage: tenant.aiConfig.escalationMessage,
            businessRules: tenant.aiConfig.businessRules,
            salesInstructions: tenant.aiConfig.salesInstructions,
            updatedAt: tenant.aiConfig.updatedAt,
          }
        : null,
    };
  }
}
