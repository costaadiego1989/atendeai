import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  IKnowledgeSourceAdapter,
  IngestResult,
  KnowledgeSourceContent,
} from '../../../application/ports/IKnowledgeSourceAdapter';

/**
 * Notion adapter — fetches pages and databases from Notion API.
 */
@Injectable()
export class NotionAdapter implements IKnowledgeSourceAdapter {
  private readonly logger = new Logger(NotionAdapter.name);
  private readonly baseUrl = 'https://api.notion.com/v1';
  readonly sourceType = 'notion';

  async ingest(
    sourceUrl: string,
    credentials?: Record<string, string>,
  ): Promise<IngestResult> {
    const apiKey = credentials?.notionApiKey;
    if (!apiKey) {
      throw new Error('Notion API key is required');
    }

    const pageId = this.extractPageId(sourceUrl);
    if (!pageId) {
      throw new Error(`Invalid Notion URL: ${sourceUrl}`);
    }

    // Get page metadata
    const pageResponse = await fetch(`${this.baseUrl}/pages/${pageId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28',
      },
    });

    if (!pageResponse.ok) {
      throw new Error(`Failed to get Notion page: ${pageResponse.status}`);
    }

    const page = await pageResponse.json();
    const title = this.extractPageTitle(page) || 'Untitled';

    // Get page blocks (content)
    const blocks = await this.getAllBlocks(pageId, apiKey);
    const text = this.blocksToText(blocks);

    const contentHash = crypto.createHash('sha256').update(text).digest('hex');

    const contents: KnowledgeSourceContent[] = [
      {
        title,
        text,
        sourceUrl,
        metadata: { pageId, type: 'notion-page' },
      },
    ];

    return { contents, contentHash };
  }

  private async getAllBlocks(pageId: string, apiKey: string): Promise<any[]> {
    const blocks: any[] = [];
    let cursor: string | undefined;

    do {
      const url = cursor
        ? `${this.baseUrl}/blocks/${pageId}/children?start_cursor=${cursor}`
        : `${this.baseUrl}/blocks/${pageId}/children`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Notion-Version': '2022-06-28',
        },
      });

      if (!response.ok) break;

      const data = await response.json();
      blocks.push(...(data.results || []));
      cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);

    return blocks;
  }

  private blocksToText(blocks: any[]): string {
    const lines: string[] = [];

    for (const block of blocks) {
      const type = block.type;
      const content = block[type];

      if (!content) continue;

      if (content.rich_text) {
        const text = content.rich_text
          .map((rt: any) => rt.plain_text || '')
          .join('');

        if (type.startsWith('heading')) {
          lines.push(`\n${text}\n`);
        } else if (
          type === 'bulleted_list_item' ||
          type === 'numbered_list_item'
        ) {
          lines.push(`• ${text}`);
        } else if (type === 'to_do') {
          const checked = content.checked ? '✓' : '○';
          lines.push(`${checked} ${text}`);
        } else {
          lines.push(text);
        }
      } else if (type === 'divider') {
        lines.push('---');
      } else if (type === 'code') {
        const code =
          content.rich_text?.map((rt: any) => rt.plain_text || '').join('') ||
          '';
        lines.push(`\`\`\`\n${code}\n\`\`\``);
      }
    }

    return lines.join('\n').trim();
  }

  private extractPageId(url: string): string | null {
    // Notion URLs: https://www.notion.so/workspace/Page-Title-{id}
    // or https://www.notion.so/{id}
    const match = url.match(/([a-f0-9]{32}|[a-f0-9-]{36})(?:\?|$)/);
    if (match) return match[1].replace(/-/g, '');

    // Try extracting from path
    const parts = url.split('/').pop()?.split('-');
    if (parts && parts.length > 0) {
      const lastPart = parts[parts.length - 1]?.replace(/\?.*/, '');
      if (lastPart && /^[a-f0-9]{32}$/.test(lastPart)) return lastPart;
    }

    return null;
  }

  private extractPageTitle(page: any): string | null {
    const properties = page.properties || {};
    for (const key of Object.keys(properties)) {
      const prop = properties[key];
      if (prop.type === 'title' && prop.title?.length > 0) {
        return prop.title.map((t: any) => t.plain_text || '').join('');
      }
    }
    return null;
  }
}
