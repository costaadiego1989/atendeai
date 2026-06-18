import {
  BadRequestException,
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
export class UpdateUserUseCase implements IUseCase<UpdateUserInput, void> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
  ) {}

  async execute(input: UpdateUserInput): Promise<void> {
    const user = await this.userRepo.findByIdAndTenant(
      input.id,
      input.tenantId,
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (input.email && input.email !== user.email.value) {
      const existingUser = await this.userRepo.findByEmail(input.email);
      if (existingUser && existingUser.id.toValue() !== user.id.toValue()) {
        throw new ConflictException('A user with this email already exists.');
      }
    }

    // Server-side last-owner guard: prevent demoting the only remaining OWNER.
    // The client performs the same check against its cache, but that data can
    // be stale under concurrent edits — this is the authoritative enforcement.
    if (input.role && input.role !== 'OWNER' && user.role.value === 'OWNER') {
      const ownerCount = await this.userRepo.countOwners(input.tenantId);
      if (ownerCount <= 1) {
        throw new BadRequestException(
          'Não é possível rebaixar o último OWNER do tenant.',
        );
      }
    }

    if (input.name) user.updateName(input.name);
    if (input.email) user.updateEmail(input.email);
    if (input.phone) user.updatePhone(input.phone);
    if (input.role) user.changeRole(Role.create(input.role));

    await this.userRepo.save(user);
  }
}
