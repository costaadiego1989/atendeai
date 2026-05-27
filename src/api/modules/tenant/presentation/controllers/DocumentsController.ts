import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UploadedFile,
  Body,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsOptional, IsString } from 'class-validator';
import { JwtCookieGuard } from '@shared/infrastructure/auth/guards/JwtCookieGuard';
import { RolesGuard } from '@shared/infrastructure/auth/guards/RolesGuard';
import { TenantGuard } from '@shared/infrastructure/auth/guards/TenantGuard';
import { Roles } from '@shared/infrastructure/auth/decorators/roles.decorator';
import { UploadDocumentUseCase } from '../../application/use-cases/UploadDocumentUseCase';
import { DeleteDocumentUseCase } from '../../application/use-cases/DeleteDocumentUseCase';
import { ListTenantPDFResumesUseCase } from '../../application/use-cases/ListTenantPDFResumesUseCase';

class UploadDocumentBodyDTO {
  @IsOptional() @IsString() title?: string;
}

@Controller('tenants/:tenantId/documents')
@UseGuards(JwtCookieGuard, RolesGuard, TenantGuard)
@Roles('OWNER', 'ADMIN')
export class DocumentsController {
  constructor(
    private readonly uploadDocument: UploadDocumentUseCase,
    private readonly deleteDocument: DeleteDocumentUseCase,
    private readonly listDocuments: ListTenantPDFResumesUseCase,
  ) {}

  @Get()
  async list(@Param('tenantId') tenantId: string) {
    const items = await this.listDocuments.execute(tenantId);
    return items.map((item) => ({
      id: item.id,
      title: item.fileName,
      status: item.status,
      chunksCount: item.chunkCount,
      fileUrl: item.fileUrl ?? null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Param('tenantId') tenantId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadDocumentBodyDTO,
  ) {
    return this.uploadDocument.execute({
      tenantId,
      file: file.buffer,
      fileName: file.originalname,
      mimeType: file.mimetype,
      title: body.title,
    });
  }

  @Delete(':docId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('tenantId') tenantId: string,
    @Param('docId') docId: string,
  ) {
    await this.deleteDocument.execute({ tenantId, documentId: docId });
  }
}
