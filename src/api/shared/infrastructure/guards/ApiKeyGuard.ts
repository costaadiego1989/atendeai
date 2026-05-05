import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import {
  ITenantRepository,
  TENANT_REPOSITORY,
} from '../../../modules/tenant/domain/repositories/ITenantRepository';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: ITenantRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('API Key is missing');
    }

    const tenant = await this.tenantRepository.findByApiKey(apiKey);
    if (!tenant) {
      throw new UnauthorizedException('Invalid API Key');
    }

    request.tenant = tenant;
    return true;
  }
}
