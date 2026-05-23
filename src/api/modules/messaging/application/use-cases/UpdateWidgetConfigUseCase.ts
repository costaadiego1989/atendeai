import { Injectable, Inject } from '@nestjs/common';
import {
  IWidgetConfigRepository,
  WIDGET_CONFIG_REPOSITORY,
} from '@modules/messaging/domain/repositories/IWidgetConfigRepository';

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
  quickReplies?: string[];
}

@Injectable()
export class UpdateWidgetConfigUseCase {
  constructor(
    @Inject(WIDGET_CONFIG_REPOSITORY)
    private readonly repo: IWidgetConfigRepository,
  ) {}

  async execute(tenantId: string, input: UpdateWidgetConfigInput) {
    const data = {
      ...input,
      color: input.color ?? undefined,
      position: input.position ?? undefined,
    };
    return this.repo.upsertByTenantId(tenantId, data);
  }
}
