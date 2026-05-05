export interface FileUploadOptions {
  folder?: string;
  isPublic?: boolean;
}

export interface FileStorageService {
  upload(
    file: Buffer,
    fileName: string,
    mimeType: string,
    options?: FileUploadOptions,
  ): Promise<string>;
  delete(fileUrl: string): Promise<void>;
  getPresignedUrl?(fileKey: string, expiresIn?: number): Promise<string>;
}

export const FILE_STORAGE_SERVICE = 'FILE_STORAGE_SERVICE';
