import { IUseCase } from '@shared/application/IUseCase';

export interface GenerateContactsReportInput {
  tenantId: string;
  branchId?: string;
  stages?: string[];
  tags?: string[];
  timelineTypes?: Array<'MESSAGING' | 'RECOVERY' | 'PAYMENT' | 'SCHEDULING'>;
  channels?: Array<'WHATSAPP' | 'INSTAGRAM' | 'CRM'>;
  dateFrom?: string;
  dateTo?: string;
}

export interface GenerateContactsReportOutput {
  generatedAt: Date;
  summary: {
    totalContacts: number;
    contactsWithTimelineMatch: number;
    contactsWithoutInteraction: number;
    pipelineContacts: number;
    customers: number;
    inactive: number;
    totalTimelineEvents: number;
    topTags: Array<{ tag: string; total: number }>;
    topChannels: Array<{ channel: string; total: number }>;
    topTimelineTypes: Array<{ type: string; total: number }>;
  };
  contacts: Array<{
    id: string;
    name: string;
    phone: string;
    document?: string;
    email?: string;
    stage: string;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
    lastInteraction?: Date;
    lastTimelineEventAt?: Date;
    timelineEventCount: number;
    inboundMessages: number;
    outboundMessages: number;
    channels: string[];
    timelineTypes: string[];
  }>;
}

export const IGenerateContactsReportUseCase = Symbol(
  'IGenerateContactsReportUseCase',
);
export interface IGenerateContactsReportUseCase extends IUseCase<
  GenerateContactsReportInput,
  GenerateContactsReportOutput
> {}
