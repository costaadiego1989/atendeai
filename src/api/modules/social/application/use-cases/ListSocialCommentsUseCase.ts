import { Injectable, Inject } from '@nestjs/common';
import {
  ISocialRepository,
  SOCIAL_REPOSITORY,
} from '../../domain/ports/ISocialRepository';

@Injectable()
export class ListSocialCommentsUseCase {
  constructor(
    @Inject(SOCIAL_REPOSITORY) private readonly repo: ISocialRepository,
  ) {}

  async execute(input: {
    tenantId: string;
    status?: string;
    postId?: string;
    platform?: string;
    page?: number;
    limit?: number;
  }) {
    return this.repo.listComments(input.tenantId, {
      status: input.status,
      postId: input.postId,
      platform: input.platform,
      page: input.page,
      limit: input.limit,
    });
  }
}
