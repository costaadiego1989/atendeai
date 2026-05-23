import { Module } from '@nestjs/common';
import { DatabaseModule } from '@shared/infrastructure/database/DatabaseModule';
import { AuthModule } from '@modules/auth/auth.module';
import { TenantAgentRuleService } from './application/services/TenantAgentRuleService';
import { GetTenantAgentRuleService } from './application/services/GetTenantAgentRuleService';
import { UpsertTenantAgentRuleService } from './application/services/UpsertTenantAgentRuleService';
import { TenantAgentRuleController } from './presentation/controllers/TenantAgentRuleController';
import { TENANT_AGENT_RULE_REPOSITORY } from './domain/repositories/ITenantAgentRuleRepository';
import { PrismaTenantAgentRuleRepository } from './infrastructure/persistence/repositories/PrismaTenantAgentRuleRepository';
import { GetTenantAgentRuleUseCase } from './application/use-cases/GetTenantAgentRuleUseCase';
import { UpsertTenantAgentRuleUseCase } from './application/use-cases/UpsertTenantAgentRuleUseCase';
import { PreviewTenantAgentRuleUseCase } from './application/use-cases/PreviewTenantAgentRuleUseCase';
import { ListTenantAgentRuleHistoryUseCase } from './application/use-cases/ListTenantAgentRuleHistoryUseCase';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [TenantAgentRuleController],
  providers: [
    {
      provide: TENANT_AGENT_RULE_REPOSITORY,
      useClass: PrismaTenantAgentRuleRepository,
    },
    GetTenantAgentRuleService,
    UpsertTenantAgentRuleService,
    GetTenantAgentRuleUseCase,
    UpsertTenantAgentRuleUseCase,
    PreviewTenantAgentRuleUseCase,
    ListTenantAgentRuleHistoryUseCase,
    TenantAgentRuleService,
  ],
  exports: [
    TenantAgentRuleService,
    GetTenantAgentRuleUseCase,
    UpsertTenantAgentRuleUseCase,
    PreviewTenantAgentRuleUseCase,
    ListTenantAgentRuleHistoryUseCase,
    TENANT_AGENT_RULE_REPOSITORY,
  ],
})
export class AgentRulesModule {}
