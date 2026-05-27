import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IUseCase } from '@shared/application/IUseCase';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../../domain/repositories/IUserRepository';

@Injectable()
export class DeleteUserUseCase implements IUseCase<
  { userId: string; tenantId: string },
  void
> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
  ) {}

  async execute(input: { userId: string; tenantId: string }): Promise<void> {
    const user = await this.userRepo.findByIdAndTenant(
      input.userId,
      input.tenantId,
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role.value === 'OWNER') {
      throw new ConflictException('The tenant owner cannot be deleted.');
    }

    await this.userRepo.delete(input.userId, input.tenantId);
  }
}
