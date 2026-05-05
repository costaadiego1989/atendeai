import { Inject, Injectable } from '@nestjs/common';
import {
  COMMERCE_REPOSITORY,
  CommercePendingOptionRecord,
  CommerceSessionRecord,
  ICommerceRepository,
} from '@modules/commerce/domain/ports/ICommerceRepository';
import { SearchCommerceCatalogUseCase } from '@modules/commerce/application/use-cases/SearchCommerceCatalogUseCase';
import {
  FindCommerceConversationContextInput,
  ICommerceContextProvider,
} from '../../application/ports/ICommerceContextProvider';

type CatalogOption = Awaited<
  ReturnType<SearchCommerceCatalogUseCase['execute']>
>[number];

import {
  SALES_REPOSITORY,
  ISalesRepository,
} from '@modules/sales/domain/repositories/ISalesRepository';

@Injectable()
export class CommerceContextProvider implements ICommerceContextProvider {
  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly commerceRepository: ICommerceRepository,
    @Inject(SALES_REPOSITORY)
    private readonly salesRepository: ISalesRepository,
    private readonly searchCommerceCatalogUseCase: SearchCommerceCatalogUseCase,
  ) { }

  async findConversationContext(
    input: FindCommerceConversationContextInput,
  ): Promise<string | null> {
    const transactionalBusiness = this.isTransactionalBusiness(input.businessType);
    const activeSession =
      await this.commerceRepository.findActiveSessionByConversation(
        input.tenantId,
        input.conversationId,
      );
    const shippingPolicy = transactionalBusiness
      ? await this.commerceRepository.findShippingPolicyByTenantId(input.tenantId)
      : null;

    const shouldSearchCatalog =
      transactionalBusiness &&
      !this.looksLikeOptionSelection(input.userMessage) &&
      input.userMessage.trim().length >= 2;

    const catalogMatches = shouldSearchCatalog
      ? await this.searchCommerceCatalogUseCase.execute({
        tenantId: input.tenantId,
        query: input.userMessage,
        limit: 5,
      })
      : [];

    if (!transactionalBusiness && !activeSession && catalogMatches.length === 0) {
      return null;
    }

    const blocks = [this.buildFlowInstructions()];

    if (shippingPolicy) {
      blocks.push(
        [
          'Shipping policy context:',
          `- Shipping mode: ${shippingPolicy.mode}`,
          shippingPolicy.fixedAmount != null
            ? `- Fixed freight amount: ${this.formatMoney(shippingPolicy.fixedAmount)}`
            : null,
          shippingPolicy.pricePerKm != null
            ? `- Freight per km: ${this.formatMoney(shippingPolicy.pricePerKm)}`
            : null,
          shippingPolicy.minimumAmount != null
            ? `- Minimum freight amount: ${this.formatMoney(shippingPolicy.minimumAmount)}`
            : null,
          shippingPolicy.maxRadiusKm != null
            ? `- Maximum delivery radius: ${shippingPolicy.maxRadiusKm} km`
            : null,
          shippingPolicy.servicedNeighborhoods.length
            ? `- Serviced neighborhoods: ${shippingPolicy.servicedNeighborhoods.join(', ')}`
            : null,
          shippingPolicy.deliverySchedule.some(
            (slot) => slot.enabled && slot.startTime && slot.endTime,
          )
            ? `- Delivery schedule: ${shippingPolicy.deliverySchedule
              .filter((slot) => slot.enabled && slot.startTime && slot.endTime)
              .map(
                (slot) =>
                  `${this.formatWeekday(slot.weekday)} ${slot.startTime}-${slot.endTime}`,
              )
              .join(', ')}`
            : null,
          shippingPolicy.notes ? `- Operational notes: ${shippingPolicy.notes}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      );
    }

    if (activeSession) {
      blocks.push(this.buildSessionContext(activeSession));
    }

    if (transactionalBusiness) {
      const promotionContext = await this.buildPromotionContext(input.tenantId);
      if (promotionContext) {
        blocks.push(promotionContext);
      }
    }

    const optionsFromSession =
      activeSession?.pendingOptions?.length && this.looksLikeOptionSelection(input.userMessage)
        ? activeSession.pendingOptions
        : [];

    if (optionsFromSession.length > 0) {
      blocks.push(this.buildCatalogMatchesContext(optionsFromSession));
    } else if (catalogMatches.length > 0) {
      blocks.push(this.buildCatalogMatchesContext(catalogMatches));
    }

    return blocks.join('\n\n');
  }

  private buildFlowInstructions(): string {
    return [
      'Commerce flow context:',
      '- This business sells by conversational cart.',
      '- If there is more than one relevant product, present numbered options from 1 to 10 and ask the customer to reply only with the option number.',
      '- After the product is chosen, confirm quantity before moving forward.',
      '- Before freight or checkout, always ask if the customer wants to add more items.',
      '- Only move to pickup or delivery after the customer says the cart is complete.',
      '- If the shopping session already contains subtotal, freight or total, use those values instead of inventing prices.',
      '- For delivery, freight may be FIXED or PER_KM and should be added to the final total when present in the session context.',
      '- Customers can apply coupons by messaging "CUPOM [CODE]". If they try, confirm if it was applied based on the session context.',
      '- If checkout is ready and the total amount is already known, you may include the payment placeholder in this format: [PAYMENT_LINK: Pedido Conversacional, 99.90].',
    ].join('\n');
  }

  private buildSessionContext(session: CommerceSessionRecord): string {
    const itemLines =
      session.items.length > 0
        ? session.items.map((item, index) => {
          const unitPrice =
            item.unitPrice != null ? this.formatMoney(item.unitPrice) : 'n/a';
          return `  ${index + 1}. ${item.name} x${item.quantity} - ${unitPrice} cada - linha ${this.formatMoney(item.lineTotal)}`;
        })
        : ['  - Cart is empty'];

    return [
      'Shopping session context:',
      `- Session status: ${session.status}`,
      `- Current step: ${session.currentStep}`,
      session.fulfillmentType ? `- Fulfillment type: ${session.fulfillmentType}` : null,
      session.shippingMode ? `- Shipping mode: ${session.shippingMode}` : null,
      session.deliveryAddress ? `- Delivery address: ${session.deliveryAddress}` : null,
      session.notes ? `- Customer note: ${session.notes}` : null,
      session.selectedItemName
        ? `- Selected item awaiting confirmation: ${session.selectedItemName}`
        : null,
      session.distanceKm != null ? `- Distance km: ${session.distanceKm}` : null,
      '- Current cart items:',
      ...itemLines,
      `- Subtotal: ${this.formatMoney(session.subtotalAmount)}`,
      session.couponCode ? `- Applied coupon: ${session.couponCode}` : null,
      session.discountAmount ? `- Saved discount: ${this.formatMoney(session.discountAmount)}` : null,
      session.freightAmount != null ? `- Freight: ${this.formatMoney(session.freightAmount)}` : null,
      `- Total: ${this.formatMoney(session.totalAmount)}`,
      session.paymentLinkUrl ? `- Payment link already generated: ${session.paymentLinkUrl}` : null,
      `- Next step: ${this.resolveNextStep(session)}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildCatalogMatchesContext(
    matches: Array<CatalogOption | CommercePendingOptionRecord>,
  ): string {
    return [
      'Commerce catalog matches:',
      ...matches.map((option: CatalogOption | CommercePendingOptionRecord) => {
        const price = option.price != null ? this.formatMoney(option.price) : 'preço sob consulta';
        const availability =
          option.availableQuantity != null
            ? `${option.availableQuantity} unidades`
            : option.categoryName || 'catalogo';

        let descriptionStr = `- ${option.optionNumber}. ${option.name} | ${price} | ${availability}`;

        const variations: string[] = [];
        
        if (option.attributes && Object.keys(option.attributes).length > 0) {
          variations.push(`Atributos: ${JSON.stringify(option.attributes)}`);
        }
        
        if (option.variants && option.variants.length > 0) {
          const variantsDesc = option.variants.map((v: Record<string, unknown>) => v.name || Object.values(v).join(', ')).join(' | ');
          variations.push(`Variantes: ${variantsDesc}`);
        }

        if (option.optionGroups && option.optionGroups.length > 0) {
          const groupsDesc = option.optionGroups.map((g: Record<string, unknown>) => `${g.name} (${Array.isArray(g.options) ? g.options.map((o: Record<string, unknown>) => o.name).join(', ') : ''})`).join(' | ');
          variations.push(`Opções: ${groupsDesc}`);
        }

        if (variations.length > 0) {
          descriptionStr += ` | Detalhes: ${variations.join('; ')}`;
        }

        return descriptionStr;
      }),
      '- If the customer is still exploring, guide the next step with one short question after listing the options.',
    ].join('\n');
  }

  private resolveNextStep(session: CommerceSessionRecord): string {
    switch (session.currentStep) {
      case 'SELECTING_ITEM':
        return 'Ask the customer to reply only with the number of the desired option.';
      case 'AWAITING_QUANTITY':
        return 'Ask for the quantity of the selected item before adding it to the cart.';
      case 'ASKING_MORE_ITEMS':
        return 'Ask whether the customer wants to add more items before pickup or delivery.';
      case 'AWAITING_FULFILLMENT':
        return 'Ask whether the customer wants pickup or delivery before checkout.';
      case 'AWAITING_DELIVERY_ADDRESS':
        return 'Ask for the delivery address to continue the order.';
      case 'AWAITING_FREIGHT_REVIEW':
        return 'Explain that delivery needs freight confirmation before checkout can continue.';
      case 'AWAITING_ORDER_NOTE':
        return 'Ask whether the customer wants to leave a delivery or pickup note, such as concierge instructions, before payment.';
      case 'READY_FOR_CHECKOUT':
        return 'Confirm the total and ask if the customer wants the payment link now.';
      case 'AWAITING_PAYMENT':
        return 'The order is waiting for payment. Reinforce the total and share the existing payment link if needed.';
      case 'PAID':
        return 'Confirm payment and explain the next operational update.';
      default:
        return 'Guide the customer to the next concrete purchase step.';
    }
  }

  private looksLikeOptionSelection(userMessage: string): boolean {
    return /^\s*\d{1,2}\s*$/.test(userMessage);
  }

  private isTransactionalBusiness(businessType?: string | null): boolean {
    if (!businessType) {
      return false;
    }

    const normalized = this.normalize(businessType);
    return [
      'ecommerce',
      'supermarket',
      'market',
      'grocery',
      'bakery',
      'cafeteria',
      'e-commerce',
      'supermercado',
      'mercado',
      'mercearia',
      'padaria',
      'cafeteria',
    ].includes(normalized);
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private formatMoney(value: number): string {
    return `BRL ${Number(value).toFixed(2)}`;
  }

  private formatWeekday(value: string): string {
    switch (value) {
      case 'MONDAY':
        return 'Monday';
      case 'TUESDAY':
        return 'Tuesday';
      case 'WEDNESDAY':
        return 'Wednesday';
      case 'THURSDAY':
        return 'Thursday';
      case 'FRIDAY':
        return 'Friday';
      case 'SATURDAY':
        return 'Saturday';
      case 'SUNDAY':
        return 'Sunday';
      default:
        return value;
    }
  }

  private async buildPromotionContext(tenantId: string): Promise<string | null> {
    const coupons = await this.salesRepository.listCoupons(tenantId, true);
    const promotions = await this.salesRepository.listPromotions(tenantId, true);

    if (coupons.length === 0 && promotions.length === 0) return null;

    const lines = ['Active promotions and coupons:'];
    
    if (coupons.length > 0) {
      lines.push('- Available coupons (Customer must type "CUPOM [CODE]" to apply):');
      coupons.forEach(c => {
        const disc = c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : this.formatMoney(c.discountValue);
        const min = c.minimumOrder ? ` (min. order ${this.formatMoney(c.minimumOrder)})` : '';
        lines.push(`  - ${c.code}: ${disc} discount${min}`);
      });
    }

    if (promotions.length > 0) {
      lines.push('- Store promotions:');
      promotions.forEach(p => {
        const disc = p.discountType === 'PERCENTAGE' ? `${p.discountValue}%` : this.formatMoney(p.discountValue);
        lines.push(`  - ${p.title}: ${disc} off - ${p.description}`);
      });
    }

    return lines.join('\n');
  }
}
