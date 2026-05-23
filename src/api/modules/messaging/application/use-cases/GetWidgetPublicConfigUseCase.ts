import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IWidgetConfigRepository,
  WIDGET_CONFIG_REPOSITORY,
} from '@modules/messaging/domain/repositories/IWidgetConfigRepository';

export interface GetWidgetPublicConfigOutput {
  id: string;
  tenantId: string;
  name: string;
  greeting: string | null;
  color: string;
  position: string;
  avatarUrl: string | null;
  collectName: boolean;
  collectPhone: boolean;
  collectEmail: boolean;
  collectCpf: boolean;
  proactiveDelay: number | null;
  proactiveMsg: string | null;
  quickReplies: string[];
}

@Injectable()
export class GetWidgetPublicConfigUseCase {
  constructor(
    @Inject(WIDGET_CONFIG_REPOSITORY)
    private readonly repo: IWidgetConfigRepository,
  ) {}

  async execute(publicToken: string): Promise<GetWidgetPublicConfigOutput> {
    const config = await this.repo.findByPublicToken(publicToken);
    if (!config || !config.enabled) {
      throw new NotFoundException('Widget not found or disabled');
    }
    return {
      id: config.id,
      tenantId: config.tenantId,
      name: config.name,
      greeting: config.greeting,
      color: config.color,
      position: config.position,
      avatarUrl: config.avatarUrl,
      collectName: config.collectName,
      collectPhone: config.collectPhone,
      collectEmail: config.collectEmail,
      collectCpf: config.collectCpf,
      proactiveDelay: config.proactiveDelay,
      proactiveMsg: config.proactiveMsg,
      quickReplies: config.quickReplies,
    };
  }
}
