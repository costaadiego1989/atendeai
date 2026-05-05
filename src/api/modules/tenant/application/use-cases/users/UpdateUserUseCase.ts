import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../../domain/repositories/IUserRepository';
import { Role, RoleType } from '../../../domain/value-objects/Role';

export interface UpdateUserInput {
  id: string;
  tenantId: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: RoleType;
}

@Injectable()
export class UpdateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
  ) {}

  async execute(input: UpdateUserInput): Promise<void> {
    const user = await this.userRepo.findByIdAndTenant(input.id, input.tenantId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (input.email && input.email !== user.email.value) {
      const existingUser = await this.userRepo.findByEmail(input.email);
      if (existingUser && existingUser.id.toValue() !== user.id.toValue()) {
        throw new ConflictException('A user with this email already exists.');
      }
    }

    if (input.name) user.updateName(input.name);
    if (input.email) user.updateEmail(input.email);
    if (input.phone) user.updatePhone(input.phone);
    if (input.role) user.changeRole(Role.create(input.role));

    await this.userRepo.save(user);
  }
}
