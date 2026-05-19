import { AggregateRoot } from '../../../../shared/domain/AggregateRoot';
import { UniqueEntityID } from '../../../../shared/domain/UniqueEntityID';
import { TenantId } from '../../../../shared/domain/TenantId';
import { PlanType, Quotas } from '../value-objects/Quotas';
import { ValidationErrorException } from '../../../../shared/domain/exceptions/DomainExceptions';

export type BillingCycleType = 'MONTHLY' | 'YEARLY';

interface SubscriptionProps {
  tenantId: TenantId;
  plan: PlanType;
  status: string;
  quotas: Quotas;
  billingCycleStart: Date;
  billingCycleEnd: Date;
  billingCycleType: BillingCycleType;
  scheduledPlan?: PlanType;
  asaasCustomerId?: string;
  asaasSubscriptionId?: string;
  lastQuotaAlertAt?: Date;
  baseMonthlyPrice: number;
  addonsMonthlyPrice: number;
  totalMonthlyPrice: number;
  pricingVersion?: string;
  pricingSnapshot: any;
  config: any;
  createdAt: Date;
}

export class Subscription extends AggregateRoot<SubscriptionProps> {
  private constructor(props: SubscriptionProps, id?: UniqueEntityID) {
    super(props, id);
  }

  get tenantId(): TenantId {
    return this.props.tenantId;
  }
  get plan(): PlanType {
    return this.props.plan;
  }
  get status(): string {
    return this.props.status;
  }
  get quotas(): Quotas {
    return this.props.quotas;
  }
  get billingCycleStart(): Date {
    return this.props.billingCycleStart;
  }
  get billingCycleEnd(): Date {
    return this.props.billingCycleEnd;
  }
  get billingCycleType(): BillingCycleType {
    return this.props.billingCycleType;
  }
  get scheduledPlan(): PlanType | undefined {
    return this.props.scheduledPlan;
  }
  get asaasCustomerId(): string | undefined {
    return this.props.asaasCustomerId;
  }
  get asaasSubscriptionId(): string | undefined {
    return this.props.asaasSubscriptionId;
  }
  get lastQuotaAlertAt(): Date | undefined {
    return this.props.lastQuotaAlertAt;
  }
  get baseMonthlyPrice(): number {
    return this.props.baseMonthlyPrice;
  }
  get addonsMonthlyPrice(): number {
    return this.props.addonsMonthlyPrice;
  }
  get totalMonthlyPrice(): number {
    return this.props.totalMonthlyPrice;
  }
  get pricingVersion(): string | undefined {
    return this.props.pricingVersion;
  }
  get pricingSnapshot(): any {
    return this.props.pricingSnapshot;
  }
  get config(): any {
    return this.props.config;
  }

  public isActive(): boolean {
    return (
      this.props.status === 'ACTIVE' && new Date() <= this.props.billingCycleEnd
    );
  }

  /**
   * God Mode: Admins bypass commercial gates for testing.
   */
  public isModuleEnabled(moduleCode: string, userRole?: string): boolean {
    if (userRole === 'ADMIN') return true;

    const modules = this.props.config?.modules || {};
    return !!modules[moduleCode?.toLowerCase()] || !!modules[moduleCode];
  }

  public activate(): void {
    this.props.status = 'ACTIVE';
  }

  public markAsOverdue(): void {
    this.props.status = 'OVERDUE';
  }

  public markAsProvisioningFailed(): void {
    this.props.status = 'PROVISIONING_FAILED';
  }

  public cancel(): void {
    this.props.status = 'CANCELED';
  }

  public updateStatus(status: string): void {
    this.props.status = status;
  }

  public isInCurrentCycle(referenceDate: Date): boolean {
    return (
      referenceDate >= this.props.billingCycleStart &&
      referenceDate <= this.props.billingCycleEnd
    );
  }

  public updateAsaasInfo(customerId: string, subscriptionId: string): void {
    this.props.asaasCustomerId = customerId;
    this.props.asaasSubscriptionId = subscriptionId;
  }

  public clearAsaasSubscription(): void {
    this.props.asaasSubscriptionId = undefined;
  }

  public updateAsaasCustomer(customerId: string): void {
    this.props.asaasCustomerId = customerId;
  }

  public changePlan(
    plan: PlanType,
    options?: {
      quotas?: Quotas;
      baseMonthlyPrice?: number;
      addonsMonthlyPrice?: number;
      totalMonthlyPrice?: number;
      pricingVersion?: string;
      pricingSnapshot?: any;
      config?: any;
      billingCycleType?: BillingCycleType;
    },
  ): void {
    this.props.plan = plan;
    this.props.quotas = options?.quotas ?? Quotas.create(plan);
    this.props.baseMonthlyPrice =
      options?.baseMonthlyPrice ?? this.props.baseMonthlyPrice;
    this.props.addonsMonthlyPrice =
      options?.addonsMonthlyPrice ?? this.props.addonsMonthlyPrice;
    this.props.totalMonthlyPrice =
      options?.totalMonthlyPrice ??
      this.props.baseMonthlyPrice + this.props.addonsMonthlyPrice;
    this.props.pricingVersion =
      options?.pricingVersion ?? this.props.pricingVersion;
    this.props.pricingSnapshot =
      options?.pricingSnapshot ?? this.props.pricingSnapshot;
    this.props.config = options?.config ?? this.props.config;
    if (options?.billingCycleType) {
      this.props.billingCycleType = options.billingCycleType;
    }
  }

  public schedulePlanChange(plan: PlanType): void {
    this.props.scheduledPlan = plan;
  }

  public clearScheduledPlan(): void {
    this.props.scheduledPlan = undefined;
  }

  public recordQuotaAlert(date: Date = new Date()): void {
    this.props.lastQuotaAlertAt = date;
  }

  public adjustQuotas(deltas: {
    messages?: number;
    aiTokens?: number;
    contacts?: number;
  }): void {
    const q = this.props.quotas;
    const next = Quotas.reconstitute(
      q.messages + (deltas.messages ?? 0),
      q.aiTokens + (deltas.aiTokens ?? 0),
      q.contacts + (deltas.contacts ?? 0),
    );
    if (next.messages < 0 || next.aiTokens < 0 || next.contacts < 0) {
      throw new ValidationErrorException('Quotas cannot be negative');
    }
    this.props.quotas = next;
  }

  public renewCycleFrom(referenceDate: Date): void {
    const cycleStart = new Date(referenceDate);
    const cycleEnd = new Date(referenceDate);

    if (this.props.billingCycleType === 'YEARLY') {
      cycleEnd.setFullYear(cycleEnd.getFullYear() + 1);
    } else {
      cycleEnd.setMonth(cycleEnd.getMonth() + 1);
    }

    this.props.billingCycleStart = cycleStart;
    this.props.billingCycleEnd = cycleEnd;
    this.props.status = 'ACTIVE';
  }

  public updatePricing(options: {
    baseMonthlyPrice: number;
    addonsMonthlyPrice: number;
    totalMonthlyPrice?: number;
    pricingVersion?: string;
    pricingSnapshot?: any;
  }): void {
    this.props.baseMonthlyPrice = options.baseMonthlyPrice;
    this.props.addonsMonthlyPrice = options.addonsMonthlyPrice;
    this.props.totalMonthlyPrice =
      options.totalMonthlyPrice ??
      options.baseMonthlyPrice + options.addonsMonthlyPrice;
    this.props.pricingVersion = options.pricingVersion;
    this.props.pricingSnapshot =
      options.pricingSnapshot ?? this.props.pricingSnapshot;
  }

  public static reconstitute(
    props: SubscriptionProps,
    id: UniqueEntityID,
  ): Subscription {
    return new Subscription(props, id);
  }

  public static create(
    tenantId: TenantId,
    plan: PlanType = 'TRIAL',
    options?: {
      quotas?: Quotas;
      baseMonthlyPrice?: number;
      addonsMonthlyPrice?: number;
      totalMonthlyPrice?: number;
      pricingVersion?: string;
      pricingSnapshot?: any;
      config?: any;
      billingCycleType?: BillingCycleType;
    },
  ): Subscription {
    const now = new Date();
    const billingCycleType: BillingCycleType = options?.billingCycleType ?? 'MONTHLY';
    const cycleEnd = new Date(now);

    if (plan === 'TRIAL') {
      cycleEnd.setDate(now.getDate() + 7);
    } else if (billingCycleType === 'YEARLY') {
      cycleEnd.setFullYear(now.getFullYear() + 1);
    } else {
      cycleEnd.setMonth(now.getMonth() + 1);
    }

    const status =
      plan === 'ESSENCIAL' || plan === 'TRIAL' ? 'ACTIVE' : 'PENDING';

    return new Subscription({
      tenantId,
      plan,
      status,
      quotas: options?.quotas ?? Quotas.create(plan),
      billingCycleStart: now,
      billingCycleEnd: cycleEnd,
      billingCycleType,
      baseMonthlyPrice: options?.baseMonthlyPrice ?? 0,
      addonsMonthlyPrice: options?.addonsMonthlyPrice ?? 0,
      totalMonthlyPrice:
        options?.totalMonthlyPrice ??
        (options?.baseMonthlyPrice ?? 0) + (options?.addonsMonthlyPrice ?? 0),
      pricingVersion: options?.pricingVersion,
      pricingSnapshot: options?.pricingSnapshot ?? {},
      config: options?.config ?? {},
      createdAt: now,
    });
  }
}
