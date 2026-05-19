import { Injectable } from '@nestjs/common';
import { PlatformMessagingReadDao } from '../../../infrastructure/daos/PlatformMessagingReadDao';

@Injectable()
export class ListPlatformConversationsUseCase {
  constructor(private readonly dao: PlatformMessagingReadDao) {}

  async execute(input: {
    page: number;
    limit: number;
    tenantId?: string;
    channel?: string;
    status?: string;
    contactSearch?: string;
  }) {
    const safeLimit = Math.min(Math.max(input.limit, 1), 100);
    const safePage = Math.max(input.page, 1);
    const { items, total } = await this.dao.listConversations({
      ...input,
      page: safePage,
      limit: safeLimit,
    });
    return {
      items,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    };
  }
}
