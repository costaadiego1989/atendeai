import { Inject, Injectable } from '@nestjs/common';
import { IUseCase } from '@shared/application/IUseCase';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../../domain/repositories/IUserRepository';

export interface TeamMemberOutput {
  id: string;
  name: string;
  email: string;
  phone: string;
  mustChangePassword: boolean;
  role: string;
  lastLoginAt: string | null;
}

@Injectable()
export class GetUsersByTenantUseCase implements IUseCase<
  string,
  TeamMemberOutput[]
> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
  ) {}

  async execute(tenantId: string): Promise<TeamMemberOutput[]> {
    const users = await this.userRepo.findAllByTenant(tenantId);

    return users.map((user) => ({
      id: user.id.toValue(),
      name: user.name,
      email: user.email.value,
      phone: user.phone.value,
      mustChangePassword: user.mustChangePassword,
      role: user.role.value,
      lastLoginAt: (user as any).lastLoginAt ?? null,
    }));
  }
}
