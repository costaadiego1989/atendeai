import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createReactAgent } = require('@langchain/langgraph/prebuilt');
import { StructuredToolInterface } from '@langchain/core/tools';

export interface DashboardTenantContext {
  tenantId: string;
  companyName: string;
  businessType: string;
  services: string;
  operatingHours: any;
  description: string;
  address: string;
  language: string;
}

@Injectable()
export class DashboardAgentFactory {
  constructor(private readonly configService: ConfigService) {}

  create(
    tenantContext: DashboardTenantContext,
    tools: StructuredToolInterface[],
    systemPrompt: string,
  ) {
    const llm = this.buildLLM();

    return createReactAgent({
      llm,
      tools,
      stateModifier: systemPrompt,
    });
  }

  private buildLLM(): ChatOpenAI {
    const model = this.configService.get<string>(
      'OPENROUTER_DASHBOARD_MODEL',
      'anthropic/claude-sonnet-4',
    );
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY')
      || this.configService.get<string>('OPENAI_API_KEY');
    const baseURL = this.configService.get<string>(
      'OPENROUTER_BASE_URL',
      'https://openrouter.ai/api/v1',
    );

    return new ChatOpenAI({
      model,
      apiKey,
      configuration: { baseURL },
      streaming: true,
      temperature: 0.3,
      maxTokens: 4096,
    });
  }
}
