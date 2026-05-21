import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  IAutomationRepository,
  IAutomationExecutionRepository,
} from '../../application/ports/IAutomationRepository';
import {
  AutomationEntity,
  AutomationExecution,
} from '../../domain/entities/Automation';

@Injectable()
export class PrismaAutomationRepository implements IAutomationRepository {
  private readonly logger = new Logger(PrismaAutomationRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findById(
    tenantId: string,
    id: string,
  ): Promise<AutomationEntity | null> {
    const record = await this.prisma.automation.findFirst({
      where: { id, tenantId },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    return record ? this.toEntity(record) : null;
  }

  async findAllByTenant(
    tenantId: string,
    onlyActive?: boolean,
  ): Promise<AutomationEntity[]> {
    const where: any = { tenantId };
    if (onlyActive) where.isActive = true;

    const records = await this.prisma.automation.findMany({
      where,
      include: { steps: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toEntity(r));
  }

  async findByTriggerType(
    tenantId: string,
    triggerType: string,
  ): Promise<AutomationEntity[]> {
    const records = await this.prisma.automation.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });

    // Filter by trigger type in JSON
    return records
      .filter((r) => {
        const trigger = r.trigger as any;
        return trigger?.type === triggerType;
      })
      .map((r) => this.toEntity(r));
  }

  async create(
    data: Omit<AutomationEntity, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AutomationEntity> {
    const record = await this.prisma.automation.create({
      data: {
        tenantId: data.tenantId,
        name: data.name,
        description: data.description,
        isActive: data.isActive,
        trigger: data.trigger as any,
        conditions: data.conditions as any,
        steps: {
          create: data.steps.map((s) => ({
            order: s.order,
            type: s.type,
            config: s.config as any,
            nextStepId: s.nextStepId,
          })),
        },
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    return this.toEntity(record);
  }

  async update(
    tenantId: string,
    id: string,
    data: Partial<AutomationEntity>,
  ): Promise<AutomationEntity> {
    // If steps are being updated, delete old ones and recreate
    if (data.steps) {
      await this.prisma.automationStep.deleteMany({
        where: { automationId: id },
      });
      await this.prisma.automationStep.createMany({
        data: data.steps.map((s) => ({
          automationId: id,
          order: s.order,
          type: s.type,
          config: s.config as any,
          nextStepId: s.nextStepId,
        })),
      });
    }

    const record = await this.prisma.automation.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.trigger !== undefined && { trigger: data.trigger as any }),
        ...(data.conditions !== undefined && {
          conditions: data.conditions as any,
        }),
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    return this.toEntity(record);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.prisma.automation.delete({ where: { id } });
  }

  async toggleActive(
    tenantId: string,
    id: string,
    isActive: boolean,
  ): Promise<void> {
    await this.prisma.automation.update({
      where: { id },
      data: { isActive },
    });
  }

  private toEntity(record: any): AutomationEntity {
    return {
      id: record.id,
      tenantId: record.tenantId,
      name: record.name,
      description: record.description,
      isActive: record.isActive,
      trigger: record.trigger as any,
      conditions: (record.conditions as any) || [],
      steps: (record.steps || []).map((s: any) => ({
        id: s.id,
        automationId: s.automationId,
        order: s.order,
        type: s.type,
        config: s.config as any,
        nextStepId: s.nextStepId,
      })),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}

@Injectable()
export class PrismaAutomationExecutionRepository implements IAutomationExecutionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Omit<AutomationExecution, 'id' | 'startedAt'>,
  ): Promise<AutomationExecution> {
    const record = await this.prisma.automationExecution.create({
      data: {
        automationId: data.automationId,
        tenantId: data.tenantId,
        contactId: data.contactId,
        status: data.status,
        currentStep: data.currentStep,
        context: data.context as any,
      },
    });
    return this.toExecution(record);
  }

  async findById(id: string): Promise<AutomationExecution | null> {
    const record = await this.prisma.automationExecution.findUnique({
      where: { id },
    });
    return record ? this.toExecution(record) : null;
  }

  async updateStatus(
    id: string,
    status: string,
    error?: string,
  ): Promise<void> {
    await this.prisma.automationExecution.update({
      where: { id },
      data: {
        status,
        error,
        ...(status === 'COMPLETED' ||
        status === 'FAILED' ||
        status === 'CANCELLED'
          ? { completedAt: new Date() }
          : {}),
      },
    });
  }

  async updateStep(
    id: string,
    currentStep: number,
    context?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.automationExecution.update({
      where: { id },
      data: {
        currentStep,
        ...(context ? { context: context as any } : {}),
      },
    });
  }

  async findByAutomation(
    tenantId: string,
    automationId: string,
    limit = 20,
  ): Promise<AutomationExecution[]> {
    const records = await this.prisma.automationExecution.findMany({
      where: { tenantId, automationId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
    return records.map((r) => this.toExecution(r));
  }

  async findRunning(tenantId: string): Promise<AutomationExecution[]> {
    const records = await this.prisma.automationExecution.findMany({
      where: { tenantId, status: 'RUNNING' },
    });
    return records.map((r) => this.toExecution(r));
  }

  async cancel(id: string): Promise<void> {
    await this.prisma.automationExecution.update({
      where: { id },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });
  }

  private toExecution(record: any): AutomationExecution {
    return {
      id: record.id,
      automationId: record.automationId,
      tenantId: record.tenantId,
      contactId: record.contactId,
      status: record.status,
      currentStep: record.currentStep,
      context: (record.context as any) || {},
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      error: record.error,
    };
  }
}
