import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  Res,
  BadRequestException,
  Put,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { GetSalesMetricsUseCase } from '../../application/use-cases/GetSalesMetricsUseCase';
import { ICreatePaymentLinkUseCase } from '../../application/use-cases/interfaces/ICreatePaymentLinkUseCase';
import { Inject } from '@nestjs/common';
import { Roles } from '@shared/infrastructure/auth/decorators/roles.decorator';
import { ListPaymentLinksUseCase } from '../../application/use-cases/ListPaymentLinksUseCase';
import { PausePaymentLinkUseCase } from '../../application/use-cases/PausePaymentLinkUseCase';
import { ResumePaymentLinkUseCase } from '../../application/use-cases/ResumePaymentLinkUseCase';
import { DeletePaymentLinkUseCase } from '../../application/use-cases/DeletePaymentLinkUseCase';
import { SuggestPaymentLinkWithAIUseCase } from '../../application/use-cases/SuggestPaymentLinkWithAIUseCase';
import { CreateSplitPaymentChargeUseCase } from '../../application/use-cases/CreateSplitPaymentChargeUseCase';
import { GenerateSalesPaymentLinksReportUseCase } from '../../application/use-cases/GenerateSalesPaymentLinksReportUseCase';
import { SalesPaymentLinksReportCsvBuilder } from '../../application/services/SalesPaymentLinksReportCsvBuilder';
import {
  CreateSalesPaymentLinkDTO,
  CreateSalesSplitChargeDTO,
  SuggestSalesPaymentLinkWithAIDTO,
} from '../dtos/SalesDTOs';
import { CreatePromotionUseCase } from '../../application/use-cases/CreatePromotionUseCase';
import { UpdatePromotionUseCase } from '../../application/use-cases/UpdatePromotionUseCase';
import { DeletePromotionUseCase } from '../../application/use-cases/DeletePromotionUseCase';
import { ListPromotionsUseCase } from '../../application/use-cases/ListPromotionsUseCase';
import { CreateCouponUseCase } from '../../application/use-cases/CreateCouponUseCase';
import { UpdateCouponUseCase } from '../../application/use-cases/UpdateCouponUseCase';
import { DeleteCouponUseCase } from '../../application/use-cases/DeleteCouponUseCase';
import { ListCouponsUseCase } from '../../application/use-cases/ListCouponsUseCase';
import { RedeemCouponUseCase } from '../../application/use-cases/RedeemCouponUseCase';
import {
  CreatePromotionDTO,
  UpdatePromotionDTO,
  CreateCouponDTO,
  UpdateCouponDTO,
  RedeemCouponDTO,
} from '../dtos/PromotionCouponDTOs';

@Controller('sales')
@UseGuards(JwtCookieGuard, RolesGuard)
export class SalesController {
  constructor(
    private readonly getSalesMetricsUseCase: GetSalesMetricsUseCase,
    private readonly listPaymentLinksUseCase: ListPaymentLinksUseCase,
    private readonly pausePaymentLinkUseCase: PausePaymentLinkUseCase,
    private readonly resumePaymentLinkUseCase: ResumePaymentLinkUseCase,
    private readonly deletePaymentLinkUseCase: DeletePaymentLinkUseCase,
    private readonly generateSalesPaymentLinksReportUseCase: GenerateSalesPaymentLinksReportUseCase,
    private readonly salesPaymentLinksReportCsvBuilder: SalesPaymentLinksReportCsvBuilder,
    private readonly suggestPaymentLinkWithAIUseCase: SuggestPaymentLinkWithAIUseCase,
    private readonly createSplitPaymentChargeUseCase: CreateSplitPaymentChargeUseCase,
    private readonly createPromotionUseCase: CreatePromotionUseCase,
    private readonly updatePromotionUseCase: UpdatePromotionUseCase,
    private readonly deletePromotionUseCase: DeletePromotionUseCase,
    private readonly listPromotionsUseCase: ListPromotionsUseCase,
    private readonly createCouponUseCase: CreateCouponUseCase,
    private readonly updateCouponUseCase: UpdateCouponUseCase,
    private readonly deleteCouponUseCase: DeleteCouponUseCase,
    private readonly listCouponsUseCase: ListCouponsUseCase,
    private readonly redeemCouponUseCase: RedeemCouponUseCase,
    @Inject(ICreatePaymentLinkUseCase)
    private readonly createPaymentLinkUseCase: ICreatePaymentLinkUseCase,
  ) {}

  @Get('metrics')
  @Roles('OWNER', 'ADMIN')
  async getMetrics(
    @Req() req: any,
    @Query('startDate') startDateString: string,
    @Query('endDate') endDateString: string,
  ) {
    const tenantId = req.user.tenantId;

    const startDate = startDateString
      ? new Date(startDateString)
      : new Date(new Date().setDate(new Date().getDate() - 30));
    const endDate = endDateString ? new Date(endDateString) : new Date();

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid sales metrics date range');
    }

    return this.getSalesMetricsUseCase.execute({
      tenantId,
      startDate,
      endDate,
    });
  }

  @Post('charges')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async createSplitCharge(
    @Req() req: any,
    @Body() body: CreateSalesSplitChargeDTO,
    @Query('branchId') branchId?: string,
  ) {
    return this.createSplitPaymentChargeUseCase.execute({
      tenantId: req.user.tenantId,
      branchId,
      contactId: body.contactId,
      conversationId: body.conversationId,
      customerDocument: body.customerDocument,
      name: body.name,
      value: body.value,
      description: body.description,
      label: body.label,
      billingType: body.billingType ?? 'PIX',
      dueDate: body.dueDate
        ? new Date(`${body.dueDate}T23:59:59.000Z`)
        : undefined,
      sendViaWhatsApp: Boolean(body.sendViaWhatsApp),
      recurrence: body.recurring
        ? {
            frequency: body.recurrenceFrequency,
            startDate: body.recurrenceStartDate
              ? new Date(`${body.recurrenceStartDate}T00:00:00.000Z`)
              : undefined,
            endDate: body.recurrenceEndDate
              ? new Date(`${body.recurrenceEndDate}T23:59:59.000Z`)
              : undefined,
          }
        : undefined,
    });
  }

  @Post('links')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async generatePaymentLink(
    @Req() req: any,
    @Body() body: CreateSalesPaymentLinkDTO,
    @Query('branchId') branchId?: string,
  ) {
    const tenantId = req.user.tenantId;

    return this.createPaymentLinkUseCase.execute({
      tenantId,
      branchId,
      name: body.name,
      value: body.value,
      description: body.description,
      label: body.label,
      billingType: body.billingType || 'PIX',
      expiresAt: body.expiresAt
        ? new Date(`${body.expiresAt}T23:59:59.000Z`)
        : undefined,
      source: body.source ?? 'MANUAL',
      catalogItemId: body.catalogItemId ?? null,
      catalogItemSku: body.catalogItemSku ?? null,
      catalogItemName: body.catalogItemName ?? null,
      recurrence: body.recurring
        ? {
            frequency: body.recurrenceFrequency,
            startDate: body.recurrenceStartDate
              ? new Date(`${body.recurrenceStartDate}T00:00:00.000Z`)
              : undefined,
            endDate: body.recurrenceEndDate
              ? new Date(`${body.recurrenceEndDate}T23:59:59.000Z`)
              : undefined,
          }
        : undefined,
    });
  }

  @Post('links/ai-suggestions')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async suggestPaymentLinkWithAI(
    @Req() req: any,
    @Body() body: SuggestSalesPaymentLinkWithAIDTO,
    @Query('branchId') branchId?: string,
  ) {
    return this.suggestPaymentLinkWithAIUseCase.execute({
      tenantId: req.user.tenantId,
      prompt: body.prompt,
      branchId,
    });
  }

  @Get('links')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async listPaymentLinks(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('status')
    status?:
      | 'ALL'
      | 'ACTIVE'
      | 'PAUSED'
      | 'DELETED'
      | 'PAID'
      | 'OVERDUE'
      | 'REFUNDED'
      | 'EXPIRED',
    @Query('source') source?: 'ALL' | 'MANUAL' | 'AI',
    @Query('branchId') branchId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.listPaymentLinksUseCase.execute({
      tenantId: req.user.tenantId,
      branchId,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      search,
      status,
      source,
      dateFrom: this.parseOptionalDate(dateFrom),
      dateTo: this.parseOptionalDate(dateTo),
    });
  }

  @Get('links/report.csv')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async downloadPaymentLinksReport(
    @Req() req: any,
    @Res() res: Response,
    @Query('search') search?: string,
    @Query('status')
    status?:
      | 'ALL'
      | 'ACTIVE'
      | 'PAUSED'
      | 'DELETED'
      | 'PAID'
      | 'OVERDUE'
      | 'REFUNDED'
      | 'EXPIRED',
    @Query('source') source?: 'ALL' | 'MANUAL' | 'AI',
    @Query('branchId') branchId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const parsedDateFrom = this.parseOptionalDate(dateFrom);
    const parsedDateTo = this.parseOptionalDate(dateTo);
    const result = await this.generateSalesPaymentLinksReportUseCase.execute({
      tenantId: req.user.tenantId,
      branchId,
      search,
      status,
      source,
      dateFrom: parsedDateFrom,
      dateTo: parsedDateTo,
    });
    const csv = this.salesPaymentLinksReportCsvBuilder.build(result.items, {
      dateFrom: parsedDateFrom,
      dateTo: parsedDateTo,
    });
    const fileStamp = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="sales-Cobranças-${fileStamp}.csv"`,
    );
    return res.send(csv);
  }

  @Patch('links/:id/pause')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async pausePaymentLink(@Req() req: any, @Param('id') id: string) {
    return this.pausePaymentLinkUseCase.execute({
      tenantId: req.user.tenantId,
      paymentLinkId: id,
    });
  }

  @Patch('links/:id/resume')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async resumePaymentLink(@Req() req: any, @Param('id') id: string) {
    return this.resumePaymentLinkUseCase.execute({
      tenantId: req.user.tenantId,
      paymentLinkId: id,
    });
  }

  @Delete('links/:id')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async deletePaymentLink(@Req() req: any, @Param('id') id: string) {
    return this.deletePaymentLinkUseCase.execute({
      tenantId: req.user.tenantId,
      paymentLinkId: id,
    });
  }

  @Post('promotions')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async createPromotion(@Req() req: any, @Body() body: CreatePromotionDTO) {
    return this.createPromotionUseCase.execute({
      ...body,
      tenantId: req.user.tenantId,
    });
  }

  @Get('promotions')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async listPromotions(
    @Req() req: any,
    @Query('onlyActive') onlyActive?: string,
  ) {
    return this.listPromotionsUseCase.execute({
      tenantId: req.user.tenantId,
      onlyActive: onlyActive === 'true',
    });
  }

  @Put('promotions/:id')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async updatePromotion(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdatePromotionDTO,
  ) {
    return this.updatePromotionUseCase.execute({
      ...body,
      tenantId: req.user.tenantId,
      promotionId: id,
    });
  }

  @Delete('promotions/:id')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async deletePromotion(@Req() req: any, @Param('id') id: string) {
    return this.deletePromotionUseCase.execute({
      tenantId: req.user.tenantId,
      promotionId: id,
    });
  }

  @Post('coupons')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async createCoupon(@Req() req: any, @Body() body: CreateCouponDTO) {
    return this.createCouponUseCase.execute({
      ...body,
      tenantId: req.user.tenantId,
    });
  }

  @Get('coupons')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async listCoupons(@Req() req: any, @Query('onlyActive') onlyActive?: string) {
    return this.listCouponsUseCase.execute({
      tenantId: req.user.tenantId,
      onlyActive: onlyActive === 'true',
    });
  }

  @Put('coupons/:id')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async updateCoupon(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateCouponDTO,
  ) {
    return this.updateCouponUseCase.execute({
      ...body,
      tenantId: req.user.tenantId,
      couponId: id,
    });
  }

  @Delete('coupons/:id')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async deleteCoupon(@Req() req: any, @Param('id') id: string) {
    return this.deleteCouponUseCase.execute({
      tenantId: req.user.tenantId,
      couponId: id,
    });
  }

  @Post('coupons/redeem')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async redeemCouponByCode(@Req() req: any, @Body() body: RedeemCouponDTO) {
    if (!body.code) {
      throw new BadRequestException('Coupon code is required for redemption');
    }
    return this.redeemCouponUseCase.execute({
      tenantId: req.user.tenantId,
      code: body.code,
    });
  }

  @Post('coupons/:id/redeem')
  @Roles('OWNER', 'ADMIN', 'AGENT')
  async redeemCoupon(@Req() req: any, @Param('id') id: string) {
    return this.redeemCouponUseCase.execute({
      tenantId: req.user.tenantId,
      couponId: id,
    });
  }

  private parseOptionalDate(value?: string): Date | undefined {
    if (!value) {
      return undefined;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
}
