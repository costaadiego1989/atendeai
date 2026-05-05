import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  IProspectWebsiteEnricher,
  ProspectWebsiteEnrichment,
} from '../../domain/ports/IProspectWebsiteEnricher';

@Injectable()
export class HttpProspectWebsiteEnricher implements IProspectWebsiteEnricher {
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.timeoutMs = this.configService.get<number>(
      'PROSPECT_WEBSITE_TIMEOUT_MS',
      5000,
    );
  }

  async enrich(input: { website?: string }): Promise<ProspectWebsiteEnrichment> {
    if (!input.website?.trim()) {
      return {};
    }

    try {
      const homepageUrl = this.normalizeWebsiteUrl(input.website);
      const homepageHtml = await this.fetchPage(homepageUrl);
      const contactUrl = this.extractContactPageUrl(homepageUrl, homepageHtml);
      const contactHtml = contactUrl ? await this.fetchPage(contactUrl) : '';
      const combinedHtml = `${homepageHtml}\n${contactHtml}`;

      return {
        email: this.extractEmail(combinedHtml),
        phone: this.extractPhone(combinedHtml),
        whatsappPhone: this.extractWhatsAppPhone(combinedHtml),
        instagramUrl: this.extractInstagramUrl(combinedHtml),
      };
    } catch {
      return {};
    }
  }

  private async fetchPage(url: string): Promise<string> {
    const response = await axios.get(url, {
      timeout: this.timeoutMs,
      headers: {
        'User-Agent': 'AtendeAiBot/1.0 (+prospecting enrichment)',
      },
    });

    return typeof response.data === 'string' ? response.data : '';
  }

  private normalizeWebsiteUrl(website: string): string {
    const trimmed = website.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed.replace(/\/+$/, '');
    }

    return `https://${trimmed.replace(/\/+$/, '')}`;
  }

  private extractContactPageUrl(baseUrl: string, html: string): string | null {
    const hrefMatch =
      html.match(/href=["']([^"']*(contato|contact|fale-conosco)[^"']*)["']/i) ||
      html.match(/href=["']([^"']*(sobre|about)[^"']*)["']/i);

    if (!hrefMatch?.[1]) {
      return null;
    }

    try {
      return new URL(hrefMatch[1], `${baseUrl}/`).toString().replace(/\/+$/, '');
    } catch {
      return null;
    }
  }

  private extractEmail(html: string): string | undefined {
    const mailtoMatch = html.match(/mailto:([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i);
    if (mailtoMatch?.[1]) {
      return mailtoMatch[1].toLowerCase();
    }

    const plainMatch = html.match(
      /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i,
    );
    return plainMatch?.[1]?.toLowerCase();
  }

  private extractPhone(html: string): string | undefined {
    const phoneMatch = html.match(
      /(\+?\d[\d\s().-]{8,}\d)/,
    );

    if (!phoneMatch?.[1]) {
      return undefined;
    }

    const digits = phoneMatch[1].replace(/\D/g, '');
    return digits.length >= 10 ? digits : undefined;
  }

  private extractWhatsAppPhone(html: string): string | undefined {
    const whatsappLinkMatch =
      html.match(/wa\.me\/(\d{10,15})/i) ||
      html.match(/api\.whatsapp\.com\/send\?phone=(\d{10,15})/i);

    if (whatsappLinkMatch?.[1]) {
      return whatsappLinkMatch[1];
    }

    return this.extractPhone(html);
  }

  private extractInstagramUrl(html: string): string | undefined {
    const instagramMatch = html.match(
      /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._-]+\/?/i,
    );

    return instagramMatch?.[0]?.replace(/\/+$/, '');
  }
}
