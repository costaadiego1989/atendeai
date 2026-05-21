import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';

@Injectable()
export class GetWidgetConfigUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(tenantId: string) {
    const existing = await this.prisma.widgetConfig.findFirst({
      where: { tenantId },
    });

    if (existing) return existing;

    return this.prisma.widgetConfig.create({
      data: { tenantId },
    });
  }
}
