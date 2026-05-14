import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class ListFeedbacksQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsIn(['BUG', 'SUGGESTION', 'IMPROVEMENT'])
  type?: string;

  @IsOptional()
  @IsIn(['OPEN', 'REVIEWED', 'CLOSED'])
  status?: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

export class UpdateFeedbackStatusBodyDto {
  @IsIn(['OPEN', 'REVIEWED', 'CLOSED'])
  status!: 'OPEN' | 'REVIEWED' | 'CLOSED';
}

export class ReplyFeedbackBodyDto {
  @IsString()
  @MinLength(1)
  message!: string;

  @IsString()
  @MinLength(1)
  authorName!: string;
}
