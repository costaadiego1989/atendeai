import { Inject, Injectable } from '@nestjs/common';
import {
  IAuthUserRepository,
  AUTH_USER_REPOSITORY,
} from '../../domain/repositories/IAuthUserRepository';
import {
  IPasswordHasher,
  PASSWORD_HASHER,
} from '@shared/application/ports/IPasswordHasher';
import { EntityNotFoundException } from '@shared/domain/exceptions/DomainExceptions';
import {
  ChangeFirstAccessPasswordInput,
  ChangeFirstAccessPasswordOutput,
  IChangeFirstAccessPasswordUseCase,
} from './interfaces/IChangeFirstAccessPasswordUseCase';
import {
  AUTH_AUDIT_LOG_REPOSITORY,
  IAuthAuditLogRepository,
} from '../ports/IAuthAuditLogRepository';

@Injectable()
export class ChangeFirstAccessPasswordUseCase
  implements IChangeFirstAccessPasswordUseCase
{
  constructor(
    @Inject(AUTH_USER_REPOSITORY)
    private readonly authUserRepository: IAuthUserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: IPasswordHasher,
    @Inject(AUTH_AUDIT_LOG_REPOSITORY)
    private readonly authAuditLogRepository: IAuthAuditLogRepository,
  ) {}

  async execute(
    input: ChangeFirstAccessPasswordInput,
  ): Promise<ChangeFirstAccessPasswordOutput> {
    const user = await this.authUserRepository.findById(input.userId);
    if (!user) {
      throw new EntityNotFoundException('User', input.userId);
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    await this.authUserRepository.updatePassword(input.userId, passwordHash);
    await this.recordAudit({
      eventType: 'FIRST_ACCESS_PASSWORD_CHANGED',
      userId: user.id.toString(),
      tenantId: user.tenantId,
      email: user.email.value,
      ipAddress: input.context?.ipAddress,
      userAgent: input.context?.userAgent,
      deviceId: input.context?.deviceId,
    });

    return {
      message: 'Senha atualizada com sucesso.',
    };
  }

  private async recordAudit(
    input: Parameters<IAuthAuditLogRepository['record']>[0],
  ): Promise<void> {
    try {
      await this.authAuditLogRepository.record(input);
    } catch {
      // Best effort audit only.
    }
  }
}
