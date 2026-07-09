import { Inject, Injectable, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { DashboardAgentFactory, DashboardTenantContext } from '../../domain/dashboard-agent/DashboardAgentFactory';
import { DashboardToolRegistry } from '../../domain/dashboard-agent/DashboardToolRegistry';
import { DashboardPromptBuilder } from '../../domain/dashboard-agent/DashboardPromptBuilder';
import { createSalesMetricsTool } from '../../domain/dashboard-agent/tools/SalesMetricsTool';
import { createAttendanceStatusTool } from '../../domain/dashboard-agent/tools/AttendanceStatusTool';
import { createSchedulingTool } from '../../domain/dashboard-agent/tools/SchedulingTool';
import { createCatalogInventoryTool } from '../../domain/dashboard-agent/tools/CatalogInventoryTool';
import { createRecoveryStatusTool } from '../../domain/dashboard-agent/tools/RecoveryStatusTool';
import { createContactsCRMTool } from '../../domain/dashboard-agent/tools/ContactsCRMTool';
import {
  DASHBOARD_METRICS_PROVIDER,
  IDashboardMetricsProvider,
} from '../ports/dashboard/IDashboardMetricsProvider';
import {
  ATTENDANCE_METRICS_PROVIDER,
  IAttendanceMetricsProvider,
} from '../ports/dashboard/IAttendanceMetricsProvider';
import {
  SCHEDULING_METRICS_PROVIDER,
  ISchedulingMetricsProvider,
} from '../ports/dashboard/ISchedulingMetricsProvider';
import {
  CATALOG_METRICS_PROVIDER,
  ICatalogMetricsProvider,
} from '../ports/dashboard/ICatalogMetricsProvider';
import {
  RECOVERY_METRICS_PROVIDER,
  IRecoveryMetricsProvider,
} from '../ports/dashboard/IRecoveryMetricsProvider';
import {
  CONTACT_METRICS_PROVIDER,
  IContactMetricsProvider,
} from '../ports/dashboard/IContactMetricsProvider';

export interface StreamDashboardChatInput {
  tenantId: string;
  userId: string;
  message: string;
  threadId?: string;
}

export interface DashboardChatEvent {
  type: 'token' | 'tool_start' | 'tool_end' | 'error' | 'done';
  content?: string;
  toolName?: string;
}

@Injectable()
export class StreamDashboardChatUseCase {
  private readonly logger = new Logger(StreamDashboardChatUseCase.name);

  constructor(
    private readonly agentFactory: DashboardAgentFactory,
    private readonly toolRegistry: DashboardToolRegistry,
    private readonly promptBuilder: DashboardPromptBuilder,
    @Inject(DASHBOARD_METRICS_PROVIDER)
    private readonly dashboardMetrics: IDashboardMetricsProvider,
    @Inject(ATTENDANCE_METRICS_PROVIDER)
    private readonly attendanceMetrics: IAttendanceMetricsProvider,
    @Inject(SCHEDULING_METRICS_PROVIDER)
    private readonly schedulingMetrics: ISchedulingMetricsProvider,
    @Inject(CATALOG_METRICS_PROVIDER)
    private readonly catalogMetrics: ICatalogMetricsProvider,
    @Inject(RECOVERY_METRICS_PROVIDER)
    private readonly recoveryMetrics: IRecoveryMetricsProvider,
    @Inject(CONTACT_METRICS_PROVIDER)
    private readonly contactMetrics: IContactMetricsProvider,
  ) {}

  execute(input: StreamDashboardChatInput): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      this.processStream(input, subscriber).catch((error) => {
        this.logger.error(`Stream error for tenant ${input.tenantId}: ${error.message}`, error.stack);
        subscriber.next({
          data: JSON.stringify({ type: 'error', content: 'Erro interno ao processar sua pergunta.' }),
        } as MessageEvent);
        subscriber.next({ data: JSON.stringify({ type: 'done' }) } as MessageEvent);
        subscriber.complete();
      });
    });
  }

  private async processStream(
    input: StreamDashboardChatInput,
    subscriber: any,
  ): Promise<void> {
    const tenantContext = await this.loadTenantContext(input.tenantId);
    const toolIds = this.toolRegistry.getToolIdsForNiche(tenantContext.businessType);
    const tools = this.buildTools(toolIds);
    const systemPrompt = this.promptBuilder.build(tenantContext, toolIds);

    const agent = this.agentFactory.create(tenantContext, tools, systemPrompt);

    const stream = await agent.stream(
      { messages: [{ role: 'user', content: input.message }] },
      {
        configurable: {
          tenantId: input.tenantId,
          thread_id: input.threadId || `tenant_${input.tenantId}_user_${input.userId}_${Date.now()}`,
        },
        streamMode: 'values',
      },
    );

    let lastContent = '';

    for await (const chunk of stream) {
      const messages = chunk.messages || [];
      const lastMessage = messages[messages.length - 1];

      if (!lastMessage) continue;

      // Tool call started
      if (lastMessage.tool_calls?.length > 0) {
        for (const tc of lastMessage.tool_calls) {
          subscriber.next({
            data: JSON.stringify({ type: 'tool_start', toolName: tc.name }),
          } as MessageEvent);
        }
        continue;
      }

      // Tool result (skip, just intermediate)
      if (lastMessage._getType?.() === 'tool') {
        subscriber.next({
          data: JSON.stringify({ type: 'tool_end', toolName: lastMessage.name }),
        } as MessageEvent);
        continue;
      }

      // AI final message
      if (lastMessage.content && lastMessage.content !== lastContent) {
        const newContent = lastMessage.content.slice(lastContent.length);
        if (newContent) {
          subscriber.next({
            data: JSON.stringify({ type: 'token', content: newContent }),
          } as MessageEvent);
        }
        lastContent = lastMessage.content;
      }
    }

    subscriber.next({ data: JSON.stringify({ type: 'done' }) } as MessageEvent);
    subscriber.complete();
  }

  private async loadTenantContext(tenantId: string): Promise<DashboardTenantContext> {
    // TODO: In T-022 wiring phase, inject ITenantRepository and load real data
    // For now, return a minimal context that allows the agent to function
    return {
      tenantId,
      companyName: 'Empresa',
      businessType: 'GENERIC',
      services: '',
      operatingHours: null,
      description: '',
      address: '',
      language: 'pt-BR',
    };
  }

  private buildTools(toolIds: string[]): any[] {
    const toolMap: Record<string, () => any> = {
      sales_metrics: () => createSalesMetricsTool(this.dashboardMetrics),
      attendance_status: () => createAttendanceStatusTool(this.attendanceMetrics),
      scheduling: () => createSchedulingTool(this.schedulingMetrics),
      catalog_inventory: () => createCatalogInventoryTool(this.catalogMetrics),
      recovery_status: () => createRecoveryStatusTool(this.recoveryMetrics),
      contacts_crm: () => createContactsCRMTool(this.contactMetrics),
    };

    return toolIds
      .filter((id) => toolMap[id])
      .map((id) => toolMap[id]());
  }
}
