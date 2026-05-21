import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  IKnowledgeSourceAdapter,
  IngestResult,
  KnowledgeSourceContent,
} from '../../../application/ports/IKnowledgeSourceAdapter';

/**
 * Google Drive adapter — fetches documents from Google Drive.
 * Supports Google Docs (exported as text) and PDFs.
 */
@Injectable()
export class GoogleDriveAdapter implements IKnowledgeSourceAdapter {
  private readonly logger = new Logger(GoogleDriveAdapter.name);
  readonly sourceType = 'google-drive';

  async ingest(
    sourceUrl: string,
    credentials?: Record<string, string>,
  ): Promise<IngestResult> {
    const accessToken = credentials?.accessToken;
    if (!accessToken) {
      throw new Error('Google Drive access token is required');
    }

    const fileId = this.extractFileId(sourceUrl);
    if (!fileId) {
      throw new Error(`Invalid Google Drive URL: ${sourceUrl}`);
    }

    // Get file metadata
    const metaResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!metaResponse.ok) {
      throw new Error(`Failed to get file metadata: ${metaResponse.status}`);
    }

    const meta = await metaResponse.json();
    const title = meta.name || 'Untitled';
    const mimeType = meta.mimeType || '';

    let text: string;

    if (mimeType === 'application/vnd.google-apps.document') {
      // Export Google Doc as plain text
      const exportResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!exportResponse.ok) {
        throw new Error(`Failed to export document: ${exportResponse.status}`);
      }
      text = await exportResponse.text();
    } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      // Export Google Sheet as CSV
      const exportResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!exportResponse.ok) {
        throw new Error(
          `Failed to export spreadsheet: ${exportResponse.status}`,
        );
      }
      text = await exportResponse.text();
    } else {
      // Download raw file content (for text-based files)
      const downloadResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!downloadResponse.ok) {
        throw new Error(`Failed to download file: ${downloadResponse.status}`);
      }
      text = await downloadResponse.text();
    }

    const contentHash = crypto.createHash('sha256').update(text).digest('hex');

    const contents: KnowledgeSourceContent[] = [
      {
        title,
        text,
        sourceUrl,
        metadata: { fileId, mimeType },
      },
    ];

    return { contents, contentHash };
  }

  private extractFileId(url: string): string | null {
    // Handles: /file/d/{id}/, /document/d/{id}/, /spreadsheets/d/{id}/
    const match = url.match(
      /\/(?:file|document|spreadsheets)\/d\/([a-zA-Z0-9_-]+)/,
    );
    if (match) return match[1];

    // Handles: ?id={id}
    const urlObj = new URL(url);
    return urlObj.searchParams.get('id');
  }
}
