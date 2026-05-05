import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRES_ACTIVE_PLAN_KEY } from '../decorators/requires-active-plan.decorator';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';

@Injectable()
export class SubscriptionActiveGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiresActivePlan = this.reflector.getAllAndOverride<boolean>(
      REQUIRES_ACTIVE_PLAN_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiresActivePlan) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.tenantId) {
      return true;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { planStatus: true }
    });

    if (!tenant) {
      return true;
    }

    if (tenant.planStatus === 'TRIAL_EXPIRED') {
      throw new ForbiddenException(
        'Seu período de teste (7 dias) expirou. Para continuar aproveitando os recursos do AtendeAí, escolha um plano agora.',
        'TRIAL_EXPIRED',
      );
    }

    if (tenant.planStatus === 'EXPIRED') {
      throw new ForbiddenException(
        'Sua assinatura expirou. Por favor, regularize seu pagamento para continuar acessando este recurso.',
        'SUBSCRIPTION_EXPIRED',
      );
    }

    return true;
  }
}
