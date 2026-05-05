import { IsOptional, IsString } from 'class-validator';

export class BootstrapTenantFinancialAccountDTO {
  @IsOptional()
  @IsString()
  companyType?: string;

  @IsOptional()
  @IsString()
  addressNumber?: string;

  @IsOptional()
  @IsString()
  complement?: string;

  @IsOptional()
  @IsString()
  birthDate?: string;
}
