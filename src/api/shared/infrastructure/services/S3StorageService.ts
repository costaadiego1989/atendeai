import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ObjectCannedACL,
} from '@aws-sdk/client-s3';
import {
  FileStorageService,
  FileUploadOptions,
} from '../../domain/services/FileStorageService';

@Injectable()
export class S3StorageService implements FileStorageService {
  private readonly client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly logger = new Logger(S3StorageService.name);

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET', '');

    const endpoint = this.configService.get<string>('AWS_S3_ENDPOINT');

    this.client = new S3Client({
      region: this.region,
      endpoint: endpoint || undefined,
      forcePathStyle: !!endpoint, // Useful for S3-compatible providers like MinIO or R2
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY', ''),
      },
    });
  }

  async upload(
    file: Buffer,
    fileName: string,
    mimeType: string,
    options?: FileUploadOptions,
  ): Promise<string> {
    if (!this.bucketName) {
      this.logger.warn('AWS_S3_BUCKET is not configured. Skipping upload.');
      return '';
    }

    const folder = options?.folder ? `${options.folder}/` : '';
    const fileKey = `${folder}${Date.now()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
      Body: file,
      ContentType: mimeType,
    });

    try {
      await this.client.send(command);

      const endpoint = this.configService.get<string>('AWS_S3_ENDPOINT');
      if (endpoint) {
        const baseUrl = endpoint.replace(/\/$/, '');
        return `${baseUrl}/${this.bucketName}/${fileKey}`;
      }

      return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${fileKey}`;
    } catch (error) {
      this.logger.error(`Error uploading file to S3: ${error.message}`);
      throw error;
    }
  }

  async delete(fileUrl: string): Promise<void> {
    if (!this.bucketName) return;

    const urlParts = fileUrl.split('/');
    const fileKey = urlParts.slice(3).join('/'); // Assumes standardized S3 URL structure

    if (!fileKey) return;

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
    });

    try {
      await this.client.send(command);
    } catch (error) {
      this.logger.error(`Error deleting file from S3: ${error.message}`);
      throw error;
    }
  }
}
