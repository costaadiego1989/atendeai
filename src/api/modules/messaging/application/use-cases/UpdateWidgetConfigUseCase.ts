import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';

export interface UpdateWidgetConfigInput {
  name?: string;
  enabled?: boolean;
  greeting?: string | null;
  color?: string | null;
  backgroundColor?: string | null;
  position?: string;
  avatarUrl?: string | null;
  collectName: boolean;
  collectPhone: boolean;
  collectEmail: boolean;
  collectCpf?: boolean;
  proactiveDelay?: number | null;
  proactiveMsg?: string | null;
}

@Injectable()
export class UpdateWidgetConfigUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(tenantId: string, input: UpdateWidgetConfigInput) {
    // color and position are non-nullable in schema — strip null values
    const data: Omit<UpdateWidgetConfigInput, 'color' | 'position'> & {
      color?: string;
      position?: string;
    } = {
      ...input,
      color: input.color ?? undefined,
      position: input.position ?? undefined,
    };

    const existing = await this.prisma.widgetConfig.findFirst({
      where: { tenantId },
    });

    if (existing) {
      return this.prisma.widgetConfig.update({
        where: { id: existing.id },
        data,
      });
    }

    return this.prisma.widgetConfig.create({
      data: { tenantId, ...data },
    });
  }
}
