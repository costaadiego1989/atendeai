import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  IKnowledgeSourceAdapter,
  IngestResult,
  KnowledgeSourceContent,
} from '../../../application/ports/IKnowledgeSourceAdapter';

/**
 * Web crawler adapter — fetches and extracts text from web pages.
 * Uses basic HTML parsing (no headless browser for MVP).
 */
@Injectable()
export class WebCrawlerAdapter implements IKnowledgeSourceAdapter {
  private readonly logger = new Logger(WebCrawlerAdapter.name);
  readonly sourceType = 'webpage';

  async ingest(sourceUrl: string): Promise<IngestResult> {
    const response = await fetch(sourceUrl, {
      headers: {
        'User-Agent': 'AtendeAI-Bot/1.0 (Knowledge Base Crawler)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${sourceUrl}: ${response.status}`);
    }

    const html = await response.text();
    const text = this.extractText(html);
    const title = this.extractTitle(html) || sourceUrl;

    const contentHash = crypto.createHash('sha256').update(text).digest('hex');

    const contents: KnowledgeSourceContent[] = [];

    // Split by sections (h1, h2, h3 headings)
    const sections = this.splitBySections(text);
    for (const section of sections) {
      if (section.text.trim().length < 50) continue;
      contents.push({
        title,
        text: section.text,
        sourceUrl,
        section: section.heading || undefined,
      });
    }

    // If no sections found, use full text
    if (contents.length === 0 && text.trim().length > 50) {
      contents.push({ title, text, sourceUrl });
    }

    return { contents, contentHash };
  }

  private extractText(html: string): string {
    // Remove script, style, nav, footer, header tags
    let cleaned = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');

    // Replace block elements with newlines
    cleaned = cleaned
      .replace(/<\/?(p|div|br|h[1-6]|li|tr|td|th|blockquote)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // Clean whitespace
    return cleaned
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n');
  }

  private extractTitle(html: string): string | null {
    const match = html.match(/<title[^>]*>(.*?)<\/title>/i);
    return match ? match[1].trim() : null;
  }

  private splitBySections(text: string): { heading: string | null; text: string }[] {
    const lines = text.split('\n');
    const sections: { heading: string | null; text: string }[] = [];
    let currentHeading: string | null = null;
    let currentText: string[] = [];

    for (const line of lines) {
      // Heuristic: short lines (< 80 chars) that are all caps or end without period = heading
      const isHeading =
        line.length < 80 &&
        line.length > 3 &&
        !line.endsWith('.') &&
        !line.endsWith(',');

      if (isHeading && currentText.length > 0) {
        sections.push({ heading: currentHeading, text: currentText.join('\n') });
        currentText = [];
        currentHeading = line;
      } else {
        currentText.push(line);
      }
    }

    if (currentText.length > 0) {
      sections.push({ heading: currentHeading, text: currentText.join('\n') });
    }

    return sections;
  }
}
