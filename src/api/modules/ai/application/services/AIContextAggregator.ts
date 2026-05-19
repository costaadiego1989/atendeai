import { ICommercialContextProvider } from '../ports/ICommercialContextProvider';
import { ICommerceContextProvider } from '../ports/ICommerceContextProvider';
import { ISchedulingContextProvider } from '../ports/ISchedulingContextProvider';
import { ITenantPDFContextProvider } from '../ports/ITenantPDFContextProvider';
import { PromptBuilder } from '../../domain/services/PromptBuilder';
import { Tenant } from '../../../tenant/domain/entities/Tenant';
import { traceAsync } from '@shared/infrastructure/observability/DomainTrace';
import { NicheWelcomeMenuService } from './welcome-menu/NicheWelcomeMenuService';
import { OperatingHoursEntry } from './welcome-menu/MenuConditionEvaluator';
import { TenantAIContextSnapshotService } from './TenantAIContextSnapshotService';
import { SchedulingCategoryInfo } from '../ports/ITenantAIContextSnapshot';

export interface AIContext {
  systemPrompt: string;
  diagnostics: Record<string, unknown>;
}

type CacheRecord = {
  expiresAtMs: number;
  value: AIContext;
};

const MAX_CONTEXT_CACHE_ENTRIES = 200;

function normalizeUserSnippet(userMessage: string): string {
  return userMessage.trim().toLowerCase().slice(0, 768);
}

export class AIContextAggregator {
  private readonly cacheByKey = new Map<string, CacheRecord>();

  constructor(
    private readonly promptBuilder: PromptBuilder,
    private readonly commercialContextProvider: ICommercialContextProvider,
    private readonly commerceContextProvider: ICommerceContextProvider,
    private readonly schedulingContextProvider: ISchedulingContextProvider,
    private readonly nicheWelcomeMenuService: NicheWelcomeMenuService,
    private readonly tenantPDFContextProvider?: ITenantPDFContextProvider,
    private readonly aggregationCacheTtlMs: number = 0,
    private readonly snapshotService?: TenantAIContextSnapshotService,
  ) {}

  async aggregate(
    tenant: Tenant,
    conversationId: string,
    userMessage: string,
    isFirstInteraction: boolean,
  ): Promise<AIContext> {
    return traceAsync(
      'ai.AIContextAggregator.aggregate',
      {
        'tenant.id': tenant.id.toString(),
        'ai.conversation_id': conversationId,
        'ai.context.first_turn': String(isFirstInteraction),
      },
      async () => {
        const ttl = Number.isFinite(this.aggregationCacheTtlMs)
          ? this.aggregationCacheTtlMs
          : 0;

        const cacheEnabled = ttl > 0;
        const cacheKey = `${tenant.id.toString()}:${conversationId}:${normalizeUserSnippet(userMessage)}`;

        if (cacheEnabled) {
          const hit = this.cacheByKey.get(cacheKey);
          const now = Date.now();
          if (hit && hit.expiresAtMs > now) {
            return {
              systemPrompt: hit.value.systemPrompt,
              diagnostics: {
                ...hit.value.diagnostics,
                aiContextAggregatorCacheHit: true,
                aiContextAggregatorCacheExpiresAtMs: hit.expiresAtMs,
              },
            };
          }
        }

        const built = await this.buildAggregateInternal(
          tenant,
          conversationId,
          userMessage,
          isFirstInteraction,
        );

        if (cacheEnabled) {
          while (this.cacheByKey.size >= MAX_CONTEXT_CACHE_ENTRIES) {
            const oldest = this.cacheByKey.keys().next().value as
              | string
              | undefined;
            if (oldest === undefined) {
              break;
            }
            this.cacheByKey.delete(oldest);
          }
          const expiresAtMs = Date.now() + ttl;
          this.cacheByKey.set(cacheKey, {
            expiresAtMs,
            value: {
              systemPrompt: built.systemPrompt,
              diagnostics: { ...built.diagnostics },
            },
          });

          built.diagnostics.aiContextAggregatorCacheHit = false;
          built.diagnostics.aiContextAggregatorCacheTtlMs = ttl;
          built.diagnostics.aiContextAggregatorCacheExpiresAtMs = expiresAtMs;
        }

        return built;
      },
    );
  }

  private async buildAggregateInternal(
    tenant: Tenant,
    conversationId: string,
    userMessage: string,
    isFirstInteraction: boolean,
  ): Promise<AIContext> {
    let prompt = this.promptBuilder.build(tenant);
    const diagnostics: Record<string, unknown> = {
      basePromptUsage: true,
      firstInteractionGuardrail: isFirstInteraction,
      aiContextAggregatorVersion: '2026-05-context-v1',
    };

    if (isFirstInteraction) {
      let schedulingCategories: SchedulingCategoryInfo[] = [];
      let commerceCatalogItemCount = 0;

      if (this.snapshotService) {
        const snapshot = await this.snapshotService.getOrBuild(
          tenant.id.toString(),
        );
        schedulingCategories = snapshot.schedulingCategories;
        commerceCatalogItemCount = snapshot.commerceCatalogItemCount;
      }

      const welcomeMenu = this.nicheWelcomeMenuService.buildWelcomePrompt({
        companyName: tenant.companyName?.value ?? '',
        businessType: tenant.businessType ?? null,
        operatingHours:
          (tenant.operatingHours as Record<
            string,
            OperatingHoursEntry
          > | null) ?? null,
        promotions: (tenant.promotions ?? []).map((p) => ({
          title: p.title,
          description: p.description,
          value: p.value,
        })),
        catalogFiles: tenant.catalogFiles ?? [],
        catalogUrl: tenant.catalogUrl ?? null,
        services: tenant.services ?? null,
        schedulingCategories,
        commerceCatalogItemCount,
        hasRecoveryCases: false,
      });
      prompt = `${prompt}\n\n${welcomeMenu}`;
      diagnostics.nicheWelcomeMenuInjected = true;
    }

    const commercialContext =
      await this.commercialContextProvider.findRelevantOffer(
        tenant.id.toString(),
        userMessage,
      );
    if (commercialContext) {
      prompt = `${prompt}\n\n[CONTEXTO COMERCIAL]:\n${commercialContext}`;
      diagnostics.commercialContextFound = true;
    }

    const commerceContext =
      await this.commerceContextProvider.findConversationContext({
        tenantId: tenant.id.toString(),
        conversationId,
        userMessage,
        businessType: tenant.businessType,
      });
    if (commerceContext) {
      prompt = `${prompt}\n\n[CONTEXTO DE NEGOCIO]:\n${commerceContext}`;
      diagnostics.commerceContextFound = true;
    }

    const schedulingContext =
      await this.schedulingContextProvider.findRelevantAvailability(
        tenant.id.toString(),
        userMessage,
      );
    if (schedulingContext) {
      prompt = `${prompt}\n\n[CONTEXTO DE AGENDA]:\n${schedulingContext}`;
      diagnostics.schedulingContextFound = true;
    }

    const tenantPDFContext =
      await this.tenantPDFContextProvider?.findRelevantPDFContext(
        tenant.id.toString(),
        userMessage,
      );
    if (tenantPDFContext) {
      prompt = `${prompt}\n\n[CONTEXTO DE DOCUMENTOS DA EMPRESA]:\n${tenantPDFContext}`;
      diagnostics.tenantPDFContextFound = true;
    }

    return {
      systemPrompt: prompt,
      diagnostics,
    };
  }
}
