import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { RoleType } from '../../domain/value-objects/Role';

export class CreateUserDTO {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsEnum({ OWNER: 'OWNER', ADMIN: 'ADMIN', AGENT: 'AGENT' })
  @IsNotEmpty()
  role: RoleType;
}

export class UpdateUserDTO {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEnum({ OWNER: 'OWNER', ADMIN: 'ADMIN', AGENT: 'AGENT' })
  @IsOptional()
  role?: RoleType;
}
