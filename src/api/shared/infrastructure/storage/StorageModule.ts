import { Global, Module } from '@nestjs/common';
import { FILE_STORAGE_SERVICE } from '../../domain/services/FileStorageService';
import { S3StorageService } from '../services/S3StorageService';

@Global()
@Module({
  providers: [
    {
      provide: FILE_STORAGE_SERVICE,
      useClass: S3StorageService,
    },
  ],
  exports: [FILE_STORAGE_SERVICE],
})
export class StorageModule {}
