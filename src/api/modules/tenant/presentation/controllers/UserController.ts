import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CreateUserUseCase } from '../../application/use-cases/users/CreateUserUseCase';
import { UpdateUserUseCase } from '../../application/use-cases/users/UpdateUserUseCase';
import { DeleteUserUseCase } from '../../application/use-cases/users/DeleteUserUseCase';
import { GetUsersByTenantUseCase } from '../../application/use-cases/users/GetUsersByTenantUseCase';
import { CreateUserDTO, UpdateUserDTO } from '../dtos/UserDTOs';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { Roles } from '@shared/infrastructure/auth/decorators/roles.decorator';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';

@Controller('tenants/:tenantId/users')
@UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
export class UserController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
    private readonly deleteUserUseCase: DeleteUserUseCase,
    private readonly getUsersByTenantUseCase: GetUsersByTenantUseCase,
  ) {}

  @Get()
  @Roles('OWNER', 'ADMIN')
  async listUsers(@Param('tenantId') tenantId: string) {
    return this.getUsersByTenantUseCase.execute(tenantId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('OWNER', 'ADMIN')
  async createUser(
    @Param('tenantId') tenantId: string,
    @Body() body: CreateUserDTO,
  ) {
    return this.createUserUseCase.execute({ ...body, tenantId });
  }

  @Put(':id')
  @Roles('OWNER', 'ADMIN')
  async updateUser(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() body: UpdateUserDTO,
  ) {
    await this.updateUserUseCase.execute({ ...body, tenantId, id });
    return { message: 'User updated successfully' };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('OWNER', 'ADMIN')
  async deleteUser(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    await this.deleteUserUseCase.execute({ tenantId, userId: id });
  }
}
