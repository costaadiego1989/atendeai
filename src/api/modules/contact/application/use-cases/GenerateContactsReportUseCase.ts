import { Inject, Injectable } from '@nestjs/common';
import {
  CONTACT_REPOSITORY,
  IContactRepository,
} from '../../domain/repositories/IContactRepository';
import {
  CONTACT_TIMELINE_REPOSITORY,
  ContactTimelineEntry,
  IContactTimelineRepository,
} from '../ports/IContactTimelineRepository';
import {
  GenerateContactsReportInput,
  GenerateContactsReportOutput,
  IGenerateContactsReportUseCase,
} from './interfaces/IGenerateContactsReportUseCase';

@Injectable()
export class GenerateContactsReportUseCase implements IGenerateContactsReportUseCase {
  constructor(
    @Inject(CONTACT_REPOSITORY)
    private readonly contactRepository: IContactRepository,
    @Inject(CONTACT_TIMELINE_REPOSITORY)
    private readonly contactTimelineRepository: IContactTimelineRepository,
  ) {}

  async execute(
    input: GenerateContactsReportInput,
  ): Promise<GenerateContactsReportOutput> {
    const tagFilters = (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean);
    const contactsResult = await this.contactRepository.findAllByTenant(input.tenantId, {
      page: 1,
      limit: 5000,
      branchId: input.branchId,
    });

    const stageFilters = new Set((input.stages ?? []).map((stage) => stage.trim()).filter(Boolean));
    const contacts = contactsResult.data.filter((contact) => {
      if (stageFilters.size > 0 && !stageFilters.has(contact.stage.value)) {
        return false;
      }

      if (!tagFilters.length) {
        return true;
      }

      return tagFilters.some((tag) => contact.tags.includes(tag));
    });

    const rows: GenerateContactsReportOutput['contacts'] = [];
    const topTags = new Map<string, number>();
    const topChannels = new Map<string, number>();
    const topTimelineTypes = new Map<string, number>();
    let totalTimelineEvents = 0;
    let contactsWithoutInteraction = 0;

    for (const contact of contacts) {
      const timeline = await this.contactTimelineRepository.getTimeline(
        input.tenantId,
        contact.id.toString(),
      );
      const matchingEntries = (timeline?.entries ?? []).filter((entry) =>
        this.matchesEntry(entry, input),
      );

      const requiresTimelineFilter = this.requiresTimelineFilter(input);
      if (requiresTimelineFilter && matchingEntries.length === 0) {
        continue;
      }

      if (matchingEntries.length === 0 && !contact.lastInteraction) {
        contactsWithoutInteraction += 1;
      }

      for (const tag of contact.tags) {
        topTags.set(tag, (topTags.get(tag) ?? 0) + 1);
      }

      for (const entry of matchingEntries) {
        totalTimelineEvents += 1;
        topTimelineTypes.set(
          this.resolveTimelineGroup(entry),
          (topTimelineTypes.get(this.resolveTimelineGroup(entry)) ?? 0) + 1,
        );

        const channel = this.resolveChannel(entry);
        if (channel) {
          topChannels.set(channel, (topChannels.get(channel) ?? 0) + 1);
        }
      }

      const lastTimelineEventAt = matchingEntries.length
        ? matchingEntries[matchingEntries.length - 1].timestamp
        : undefined;
      const channels = [...new Set(matchingEntries.map((entry) => this.resolveChannel(entry)).filter(Boolean))] as string[];
      const timelineTypes = [...new Set(matchingEntries.map((entry) => this.resolveTimelineGroup(entry)))];

      rows.push({
        id: contact.id.toString(),
        name: contact.name.value,
        phone: contact.phone,
        document: contact.document,
        email: contact.email,
        stage: contact.stage.value,
        tags: [...contact.tags],
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt,
        lastInteraction: contact.lastInteraction,
        lastTimelineEventAt,
        timelineEventCount: matchingEntries.length,
        inboundMessages: matchingEntries.filter((entry) => entry.type === 'MESSAGE_INBOUND').length,
        outboundMessages: matchingEntries.filter((entry) => entry.type === 'MESSAGE_OUTBOUND').length,
        channels,
        timelineTypes,
      });
    }

    rows.sort((left, right) => {
      const leftTime = new Date(
        left.lastTimelineEventAt ?? left.lastInteraction ?? left.updatedAt,
      ).getTime();
      const rightTime = new Date(
        right.lastTimelineEventAt ?? right.lastInteraction ?? right.updatedAt,
      ).getTime();
      return rightTime - leftTime;
    });

    const contactsWithTimelineMatch = rows.filter((row) => row.timelineEventCount > 0).length;

    return {
      generatedAt: new Date(),
      summary: {
        totalContacts: rows.length,
        contactsWithTimelineMatch,
        contactsWithoutInteraction,
        pipelineContacts: rows.filter((row) =>
          ['LEAD', 'PROSPECT', 'OPPORTUNITY'].includes(row.stage),
        ).length,
        customers: rows.filter((row) => row.stage === 'CUSTOMER').length,
        inactive: rows.filter((row) => row.stage === 'INACTIVE').length,
        totalTimelineEvents,
        topTags: this.toTopEntries(topTags, 'tag'),
        topChannels: this.toTopEntries(topChannels, 'channel'),
        topTimelineTypes: this.toTopEntries(topTimelineTypes, 'type'),
      },
      contacts: rows,
    };
  }

  private requiresTimelineFilter(input: GenerateContactsReportInput): boolean {
    return Boolean(
      (input.timelineTypes && input.timelineTypes.length > 0) ||
        (input.channels && input.channels.length > 0) ||
        input.dateFrom ||
        input.dateTo,
    );
  }

  private matchesEntry(
    entry: ContactTimelineEntry,
    input: GenerateContactsReportInput,
  ): boolean {
    const timelineGroup = this.resolveTimelineGroup(entry);
    if (input.timelineTypes?.length && (timelineGroup === 'CRM' || !input.timelineTypes.includes(timelineGroup))) {
      return false;
    }

    if (input.channels?.length && !input.channels.includes(this.resolveChannel(entry))) {
      return false;
    }

    if (input.dateFrom) {
      const start = new Date(`${input.dateFrom}T00:00:00.000Z`);
      if (entry.timestamp < start) {
        return false;
      }
    }

    if (input.dateTo) {
      const end = new Date(`${input.dateTo}T23:59:59.999Z`);
      if (entry.timestamp > end) {
        return false;
      }
    }

    return true;
  }

  private resolveTimelineGroup(
    entry: ContactTimelineEntry,
  ): 'MESSAGING' | 'RECOVERY' | 'PAYMENT' | 'SCHEDULING' | 'CRM' {
    if (
      [
        'CONVERSATION_STARTED',
        'MESSAGE_INBOUND',
        'MESSAGE_OUTBOUND',
        'HANDOFF_HUMAN',
        'FOLLOW_UP_SCHEDULED',
        'FOLLOW_UP_CANCELLED',
        'FOLLOW_UP_TRIGGERED',
        'FOLLOW_UP_SKIPPED',
      ].includes(entry.type)
    ) {
      return 'MESSAGING';
    }

    if (['RECOVERY_CASE_CREATED', 'RECOVERY_STATUS'].includes(entry.type)) {
      return 'RECOVERY';
    }

    if (
      ['PAYMENT_CONFIRMED', 'PAYMENT_OVERDUE', 'PAYMENT_REFUNDED'].includes(entry.type)
    ) {
      return 'PAYMENT';
    }

    if (entry.type === 'SCHEDULING_RESERVED') {
      return 'SCHEDULING';
    }

    return 'CRM';
  }

  private resolveChannel(entry: ContactTimelineEntry): 'WHATSAPP' | 'INSTAGRAM' | 'CRM' {
    const detailsChannel = entry.details['channel'];
    if (detailsChannel === 'WHATSAPP' || detailsChannel === 'INSTAGRAM') {
      return detailsChannel;
    }

    return 'CRM';
  }

  private toTopEntries<T extends 'tag' | 'channel' | 'type'>(
    source: Map<string, number>,
    labelKey: T,
  ): Array<Record<T, string> & { total: number }> {
    return [...source.entries()]
      .map(([label, total]) => ({ [labelKey]: label, total }) as Record<T, string> & { total: number })
      .sort((left, right) => right.total - left.total)
      .slice(0, 5);
  }
}
