import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import { UniqueEntityID } from '@shared/domain/UniqueEntityID';
import { TenantId } from '@shared/domain/TenantId';
import { ITaskRepository } from '../../application/ports/ITaskRepository';
import { Task, TaskSource, TaskStatus } from '../../domain/entities/Task';

@Injectable()
export class PrismaTaskRepository implements ITaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(task: Task): Promise<void> {
    const data = {
      tenantId: task.tenantId.toString(),
      contactId: task.contactId,
      title: task.title,
      description: task.description,
      status: task.status,
      dueAt: task.dueAt,
      source: task.source,
      updatedAt: task.updatedAt,
    };

    // tenant-safe: upsert keys on app-generated UUID PK; tenantId always written in create/data, reads scoped in findById
    await this.prisma.crmTask.upsert({
      where: { id: task.id.toString() },
      create: { id: task.id.toString(), createdAt: task.createdAt, ...data },
      update: data,
    });
  }

  async findById(tenantId: string, id: string): Promise<Task | null> {
    const record = await this.prisma.crmTask.findFirst({
      where: { id, tenantId },
    });
    if (!record) {
      return null;
    }

    return Task.reconstitute(
      {
        tenantId: TenantId.create(record.tenantId),
        contactId: record.contactId,
        title: record.title,
        description: record.description,
        status: record.status as TaskStatus,
        dueAt: record.dueAt,
        source: record.source as TaskSource,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
      new UniqueEntityID(record.id),
    );
  }
}
