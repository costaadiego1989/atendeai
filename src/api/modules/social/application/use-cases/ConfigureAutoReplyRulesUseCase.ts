import { Injectable, Inject } from '@nestjs/common';
import { ISocialRepository, SOCIAL_REPOSITORY } from '../../domain/ports/ISocialRepository';
import { SocialAutoReplyRule } from '../../domain/entities/SocialAutoReplyRule';

@Injectable()
export class ConfigureAutoReplyRulesUseCase {
  constructor(
    @Inject(SOCIAL_REPOSITORY) private readonly repo: ISocialRepository,
  ) {}

  async create(input: {
    tenantId: string;
    name: string;
    platform: string;
    priority?: number;
    conditions?: any;
    actions?: any;
    limits?: any;
  }): Promise<{ id: string }> {
    const rule = SocialAutoReplyRule.create({
      tenantId: input.tenantId,
      name: input.name,
      platform: input.platform,
      priority: input.priority,
      conditions: input.conditions,
      actions: input.actions,
      limits: input.limits,
    });

    await this.repo.saveRule(rule);
    await this.repo.logAudit(input.tenantId, {
      event: 'RULE_CREATED',
      entityId: rule.id.toValue(),
      entityType: 'RULE',
      platform: input.platform,
      metadata: { name: input.name },
    });

    return { id: rule.id.toValue() };
  }

  async update(input: {
    tenantId: string;
    ruleId: string;
    name?: string;
    priority?: number;
    platform?: string;
    conditions?: any;
    actions?: any;
    limits?: any;
  }): Promise<{ success: boolean; error?: string }> {
    const rule = await this.repo.findRuleById(input.tenantId, input.ruleId);
    if (!rule) return { success: false, error: 'Regra não encontrada' };

    rule.update({
      name: input.name,
      priority: input.priority,
      platform: input.platform,
      conditions: input.conditions,
      actions: input.actions,
      limits: input.limits,
    });

    await this.repo.saveRule(rule);
    await this.repo.logAudit(input.tenantId, {
      event: 'RULE_UPDATED',
      entityId: input.ruleId,
      entityType: 'RULE',
      metadata: { name: rule.name },
    });

    return { success: true };
  }

  async toggle(tenantId: string, ruleId: string): Promise<{ isActive: boolean; error?: string }> {
    const rule = await this.repo.findRuleById(tenantId, ruleId);
    if (!rule) return { isActive: false, error: 'Regra não encontrada' };

    rule.toggle();
    await this.repo.saveRule(rule);
    await this.repo.logAudit(tenantId, {
      event: rule.isActive ? 'RULE_ACTIVATED' : 'RULE_DEACTIVATED',
      entityId: ruleId,
      entityType: 'RULE',
    });

    return { isActive: rule.isActive };
  }

  async delete(tenantId: string, ruleId: string): Promise<{ success: boolean }> {
    await this.repo.deleteRule(tenantId, ruleId);
    await this.repo.logAudit(tenantId, {
      event: 'RULE_DELETED',
      entityId: ruleId,
      entityType: 'RULE',
    });
    return { success: true };
  }

  async list(tenantId: string) {
    return this.repo.listAllRules(tenantId);
  }
}
