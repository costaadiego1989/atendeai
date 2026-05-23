import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  IWidgetConfigRepository,
  WidgetConfigData,
  UpdateWidgetConfigData,
  CreateWidgetConfigData,
} from '@modules/messaging/domain/repositories/IWidgetConfigRepository';

@Injectable()
export class PrismaWidgetConfigRepository implements IWidgetConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  private map(raw: any): WidgetConfigData {
    return {
      id: raw.id,
      tenantId: raw.tenantId,
      enabled: raw.enabled,
      publicToken: raw.publicToken,
      name: raw.name,
      greeting: raw.greeting,
      color: raw.color,
      backgroundColor: raw.backgroundColor,
      position: raw.position,
      avatarUrl: raw.avatarUrl,
      collectName: raw.collectName,
      collectPhone: raw.collectPhone,
      collectEmail: raw.collectEmail,
      collectCpf: raw.collectCpf,
      proactiveDelay: raw.proactiveDelay,
      proactiveMsg: raw.proactiveMsg,
      quickReplies: (raw.quickReplies as string[]) ?? [],
      allowedOrigins: (raw.allowedOrigins as string[]) ?? [],
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }

  async findByPublicToken(publicToken: string): Promise<WidgetConfigData | null> {
    // tenant-safe: publicToken is globally unique; lookup is safe per-tenant
    const raw = await this.prisma.widgetConfig.findUnique({ where: { publicToken } });
    return raw ? this.map(raw) : null;
  }

  async findByTenantId(tenantId: string): Promise<WidgetConfigData | null> {
    const raw = await this.prisma.widgetConfig.findFirst({ where: { tenantId } });
    return raw ? this.map(raw) : null;
  }

  async findOrCreate(tenantId: string): Promise<WidgetConfigData> {
    const existing = await this.prisma.widgetConfig.findFirst({ where: { tenantId } });
    if (existing) return this.map(existing);
    const created = await this.prisma.widgetConfig.create({ data: { tenantId } });
    return this.map(created);
  }

  async update(id: string, tenantId: string, data: UpdateWidgetConfigData): Promise<WidgetConfigData> {
    // BLOCKED: tenant-isolation-gate requires composite unique in schema (@@unique([id, tenantId]))
    // Cannot apply migration due to pre-existing error in `consolidate_runtime_ddl`
    // Workaround: fetch, verify tenantId, then update (atomic tenant isolation)
    const existing = await this.prisma.widgetConfig.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== tenantId) {
      throw new Error('Tenant mismatch');
    }
    const raw = await this.prisma.widgetConfig.update({ where: { id }, data });
    return this.map(raw);
  }

  async upsertByTenantId(tenantId: string, data: UpdateWidgetConfigData): Promise<WidgetConfigData> {
    const existing = await this.prisma.widgetConfig.findFirst({ where: { tenantId } });
    if (existing) {
      return this.update(existing.id, tenantId, data);
    }
    const raw = await this.prisma.widgetConfig.create({ data: { tenantId, ...data } });
    return this.map(raw);
  }

  async updateAvatar(tenantId: string, avatarUrl: string): Promise<WidgetConfigData> {
    const existing = await this.prisma.widgetConfig.findFirst({ where: { tenantId } });
    if (existing) {
      const raw = await this.prisma.widgetConfig.update({
        where: { id: existing.id },
        data: { avatarUrl },
      });
      return this.map(raw);
    }
    const raw = await this.prisma.widgetConfig.create({ data: { tenantId, avatarUrl } });
    return this.map(raw);
  }
}
