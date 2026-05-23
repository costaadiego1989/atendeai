import { Injectable, Inject } from '@nestjs/common';
import {
  IWidgetConfigRepository,
  WIDGET_CONFIG_REPOSITORY,
} from '@modules/messaging/domain/repositories/IWidgetConfigRepository';

@Injectable()
export class GetWidgetConfigUseCase {
  constructor(
    @Inject(WIDGET_CONFIG_REPOSITORY)
    private readonly repo: IWidgetConfigRepository,
  ) {}

  async execute(tenantId: string) {
    return this.repo.findOrCreate(tenantId);
  }
}
