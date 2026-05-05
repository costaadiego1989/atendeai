import { Module } from '@nestjs/common';
import { DatabaseModule } from '@shared/infrastructure/database/DatabaseModule';
import { AuthModule } from '@modules/auth/auth.module';
import { TenantAgentRuleService } from './application/services/TenantAgentRuleService';
import { GetTenantAgentRuleService } from './application/services/GetTenantAgentRuleService';
import { UpsertTenantAgentRuleService } from './application/services/UpsertTenantAgentRuleService';
import { TenantAgentRuleController } from './presentation/controllers/TenantAgentRuleController';
import {
  ITenantAgentRuleRepository,
  TENANT_AGENT_RULE_REPOSITORY,
} from './domain/repositories/ITenantAgentRuleRepository';
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
    {
      provide: GetTenantAgentRuleService,
      useFactory: (repository: ITenantAgentRuleRepository) =>
        new GetTenantAgentRuleService(repository),
      inject: [TENANT_AGENT_RULE_REPOSITORY],
    },
    {
      provide: UpsertTenantAgentRuleService,
      useFactory: (repository: ITenantAgentRuleRepository) =>
        new UpsertTenantAgentRuleService(repository),
      inject: [TENANT_AGENT_RULE_REPOSITORY],
    },
    {
      provide: GetTenantAgentRuleUseCase,
      useFactory: (ruleService: GetTenantAgentRuleService) =>
        new GetTenantAgentRuleUseCase(ruleService),
      inject: [GetTenantAgentRuleService],
    },
    {
      provide: UpsertTenantAgentRuleUseCase,
      useFactory: (ruleService: UpsertTenantAgentRuleService) =>
        new UpsertTenantAgentRuleUseCase(ruleService),
      inject: [UpsertTenantAgentRuleService],
    },
    {
      provide: PreviewTenantAgentRuleUseCase,
      useFactory: (repository: ITenantAgentRuleRepository) =>
        new PreviewTenantAgentRuleUseCase(repository),
      inject: [TENANT_AGENT_RULE_REPOSITORY],
    },
    {
      provide: ListTenantAgentRuleHistoryUseCase,
      useFactory: (repository: ITenantAgentRuleRepository) =>
        new ListTenantAgentRuleHistoryUseCase(repository),
      inject: [TENANT_AGENT_RULE_REPOSITORY],
    },
    {
      provide: TenantAgentRuleService,
      useFactory: (
        getRuleUseCase: GetTenantAgentRuleUseCase,
        upsertRuleUseCase: UpsertTenantAgentRuleUseCase,
      ) => new TenantAgentRuleService(getRuleUseCase, upsertRuleUseCase),
      inject: [GetTenantAgentRuleUseCase, UpsertTenantAgentRuleUseCase],
    },
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
