import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';

export interface ListVoiceCallsInput {
  tenantId: string;
  page?: number;
  limit?: number;
  status?: string;
}

@Injectable()
export class ListVoiceCallsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: ListVoiceCallsInput) {
    const page = Math.max(1, input.page ?? 1);
    const limit = Math.min(100, Math.max(1, input.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId: input.tenantId };
    if (input.status) {
      where.status = input.status;
    }

    const [rows, total] = await Promise.all([
      this.prisma.voiceCall.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          contactId: true,
          direction: true,
          status: true,
          duration: true,
          outcome: true,
          createdAt: true,
        },
      }),
      this.prisma.voiceCall.count({ where }),
    ]);

    const items = rows.map((r) => ({
      ...r,
      result: r.outcome ?? null,
      outcome: undefined,
    }));
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }
}
