import {
  IsString,
  IsOptional,
  IsInt,
  IsObject,
  Min,
  Max,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ListCommentsQueryDTO {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  postId?: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ReplyToCommentDTO {
  @IsString()
  text!: string;
}

export class CreateAutoReplyRuleDTO {
  @IsString()
  name!: string;

  @IsString()
  platform!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  priority?: number;

  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  actions?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  limits?: Record<string, unknown>;
}

export class UpdateAutoReplyRuleDTO {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  priority?: number;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  actions?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  limits?: Record<string, unknown>;
}

export class SendInboxMessageDTO {
  @IsString()
  socialAccountId!: string;

  @IsString()
  recipientExternalId!: string;

  @IsOptional()
  @IsString()
  recipientUsername?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsString()
  linkUrl?: string;

  @IsOptional()
  @IsString()
  linkTitle?: string;

  @IsOptional()
  @IsString()
  originCommentId?: string;
}

export class ConnectInstagramDTO {
  @IsString()
  accessToken!: string;

  @IsString()
  instagramAccountId!: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  profilePictureUrl?: string;

  @IsString()
  pageId!: string;
}
