import { Inject, Injectable } from '@nestjs/common';
import {
  ISchedulingFacade,
  SCHEDULING_FACADE,
} from '@modules/scheduling/application/facades/SchedulingFacade';
import { ISchedulingContextProvider } from '../../application/ports/ISchedulingContextProvider';
import {
  CategoryAvailabilityRecord,
  SchedulingCategoryRecord,
  SchedulingProfessionalRecord,
} from '@modules/scheduling/domain/ports/ISchedulingStore';

@Injectable()
export class SchedulingContextProvider implements ISchedulingContextProvider {
  constructor(
    @Inject(SCHEDULING_FACADE)
    private readonly schedulingFacade: ISchedulingFacade,
  ) { }

  async findRelevantAvailability(
    tenantId: string,
    userMessage: string,
  ): Promise<string | null> {
    const categories = await this.schedulingFacade.listCategories(tenantId);
    const matchingCategory = this.findMatchingCategory(categories, userMessage);

    if (!matchingCategory) {
      if (!this.hasSchedulingIntent(userMessage) || categories.length === 0) {
        return null;
      }

      const professionals = await this.schedulingFacade.listProfessionals(tenantId);
      return this.buildGeneralSchedulingOverview(categories, professionals);
    }

    const startDate = this.resolveReferenceDate(userMessage);
    const rangeDays = this.resolveRangeDays(userMessage);
    const daySummaries: string[] = [];
    let hasOpenSlots = false;
    let hasAnySchedulingRecords = false;

    for (let offset = 0; offset < rangeDays; offset++) {
      const currentDate = new Date(startDate);
      currentDate.setUTCDate(startDate.getUTCDate() + offset);

      const date = currentDate.toISOString().slice(0, 10);
      const availability = await this.schedulingFacade.getCategoryAvailability({
        tenantId,
        categoryId: matchingCategory.id,
        date,
      });

      if (availability.length === 0) {
        continue;
      }

      hasAnySchedulingRecords = true;

      const summary = this.buildDaySummary(date, matchingCategory, availability);
      daySummaries.push(summary.text);
      hasOpenSlots = hasOpenSlots || summary.hasOpenSlots;
    }

    if (!hasAnySchedulingRecords) {
      return [
        'Scheduling context:',
        `- Category: ${matchingCategory.name}`,
        `- Window: ${this.getWindowLabel(rangeDays)}`,
        this.buildPricingLine(matchingCategory),
        '- Availability: no scheduling records found in the selected window',
        ...this.buildConversationRules(false),
      ].join('\n');
    }

    const pricingLine = this.buildPricingLine(matchingCategory);
    const response = [
      'Scheduling context:',
      `- Category: ${matchingCategory.name}`,
      `- Window: ${this.getWindowLabel(rangeDays)}`,
      pricingLine,
      hasOpenSlots
        ? '- Open slots found in the requested window'
        : '- Open slots: none in the requested window',
      ...daySummaries,
      ...this.buildConversationRules(hasOpenSlots),
    ];

    return response.join('\n');
  }

  private findMatchingCategory(
    categories: SchedulingCategoryRecord[],
    userMessage: string,
  ): SchedulingCategoryRecord | null {
    const normalizedMessage = this.normalize(userMessage);

    return (
      categories.find((category) =>
        normalizedMessage.includes(this.normalize(category.name)),
      ) || null
    );
  }

  private hasSchedulingIntent(userMessage: string): boolean {
    const normalizedMessage = this.normalize(userMessage);
    return [
      'agenda',
      'agendar',
      'horario',
      'horarios',
      'consulta',
      'serviço',
      'profissional',
      'marcar',
      'reserva',
    ].some((term) => normalizedMessage.includes(term));
  }

  private buildGeneralSchedulingOverview(
    categories: SchedulingCategoryRecord[],
    professionals: SchedulingProfessionalRecord[],
  ): string {
    const categoryLines = categories.slice(0, 8).map((category) => {
      const price =
        category.basePrice != null ? ` | base price BRL ${category.basePrice.toFixed(2)}` : '';
      const duration = category.durationMinutes ? ` | duration ${category.durationMinutes} min` : '';
      return `- Service: ${category.name} | categoryId=${category.id}${duration}${price}`;
    });
    const professionalLines = professionals.slice(0, 8).map((professional) => (
      `- Professional: ${professional.name} | professionalId=${professional.id}${professional.role ? ` | role=${professional.role}` : ''}`
    ));

    return [
      'Scheduling context:',
      '- The customer is asking about appointments, services, professionals or opening slots.',
      '- First ask which service/category the customer wants if it is not clear.',
      '- Services available:',
      ...categoryLines,
      professionals.length > 0 ? '- Professionals available:' : '- Professionals available: none configured',
      ...professionalLines,
      ...this.buildConversationRules(false),
    ].join('\n');
  }

  private resolveReferenceDate(userMessage: string): Date {
    const normalizedMessage = this.normalize(userMessage);
    const today = new Date();
    const utcReference = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate(),
      ),
    );

    if (
      normalizedMessage.includes('amanha') ||
      normalizedMessage.includes('amanhã')
    ) {
      utcReference.setUTCDate(utcReference.getUTCDate() + 1);
    }

    return utcReference;
  }

  private resolveRangeDays(userMessage: string): number {
    const normalizedMessage = this.normalize(userMessage);

    if (
      normalizedMessage.includes('mes') ||
      normalizedMessage.includes('mês') ||
      normalizedMessage.includes('mensal')
    ) {
      return 30;
    }

    if (
      normalizedMessage.includes('semana') ||
      normalizedMessage.includes('semanal')
    ) {
      return 7;
    }

    return 7;
  }

  private buildDaySummary(
    date: string,
    category: SchedulingCategoryRecord,
    availability: CategoryAvailabilityRecord[],
  ): { text: string; hasOpenSlots: boolean } {
    const availableLines = availability.flatMap((entry) => {
      const availableSlots = entry.slots.filter(
        (slot) => slot.status === 'AVAILABLE',
      );

      if (availableSlots.length === 0) {
        return [];
      }

      const formattedSlots = availableSlots.map((slot) => {
        const price =
          slot.customPrice != null ? slot.customPrice : category.basePrice;
        const pricingSuffix =
          price != null ? ` (price BRL ${price.toFixed(2)})` : '';

        return [
          `${slot.startsAt}-${slot.endsAt}${pricingSuffix}`,
          `professionalId=${entry.professionalId}`,
          `date=${date}`,
          `slotId=${slot.id}`,
          `categoryId=${category.id}`,
        ].join(' | ');
      });

      return [
        `  - Professional: ${entry.professionalName}`,
        `  - Open slots: ${formattedSlots.join(', ')}`,
      ];
    });

    const counters = availability.reduce(
      (accumulator, entry) => {
        for (const slot of entry.slots) {
          if (slot.status === 'AVAILABLE') {
            accumulator.available += 1;
          } else if (slot.status === 'RESERVED') {
            accumulator.reserved += 1;
          } else if (slot.status === 'BLOCKED') {
            accumulator.blocked += 1;
          }
        }

        return accumulator;
      },
      { available: 0, reserved: 0, blocked: 0 },
    );

    const baseLines = [
      `- Date: ${date}`,
      `  - Summary: ${counters.available} open, ${counters.reserved} reserved, ${counters.blocked} blocked`,
    ];

    if (availableLines.length === 0) {
      return {
        text: [...baseLines, '  - Open slots: none'].join('\n'),
        hasOpenSlots: false,
      };
    }

    return {
      text: [...baseLines, ...availableLines].join('\n'),
      hasOpenSlots: true,
    };
  }

  private buildPricingLine(category: SchedulingCategoryRecord): string {
    const unitLabel = this.getUnitLabel(category);

    if (category.basePrice != null) {
      return `- Base price: BRL ${category.basePrice.toFixed(2)} (${unitLabel})`;
    }

    return `- Base price: not configured (${unitLabel})`;
  }

  private buildConversationRules(allowSlotAction: boolean): string[] {
    const baseRules = [
      '- Scheduling flow: first confirm service/category, then professional, then exact date/time, then customer data if missing, then payment/confirmation.',
      '- Show at most 3 available options at a time and ask the customer to pick one.',
    ];

    if (!allowSlotAction) {
      return [
        ...baseRules,
        '- Do not emit internal scheduling action placeholders until a real available slot with professionalId, date, slotId and categoryId is shown in this context.',
      ];
    }

    return [
      ...baseRules,
      '- If the customer clearly chooses a listed slot, emit exactly one internal action placeholder and no other payment placeholder:',
      '  [SCHEDULE_SLOT: professionalId=<professionalId>, date=<YYYY-MM-DD>, slotId=<slotId>, categoryId=<categoryId>, payment=<required|free>]',
      '- Use payment=required when a base price or slot price is shown; use payment=free only when there is no price configured or the business explicitly offers free booking.',
      '- Never invent professionalId, slotId, categoryId or date. Use only IDs shown in this scheduling context.',
    ];
  }

  private getUnitLabel(category: SchedulingCategoryRecord): string {
    if (category.unit === 'PER_SESSION') {
      return 'per session';
    }

    if (category.unit === 'PER_CONSULTATION') {
      return 'per consultation';
    }

    const durationSuffix = category.durationMinutes
      ? ` / ${category.durationMinutes} min`
      : '';

    return `per minute${durationSuffix}`;
  }

  private getWindowLabel(rangeDays: number): string {
    if (rangeDays >= 30) {
      return 'next 30 days';
    }

    if (rangeDays >= 7) {
      return 'next 7 days';
    }

    return `next ${rangeDays} days`;
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
}
