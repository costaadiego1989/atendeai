import { Injectable } from '@nestjs/common';

export interface ParsedContactImportRow {
  lineNumber: number;
  name: string;
  phone: string;
  document?: string;
  email?: string;
  notes?: string;
  tags: string[];
}

@Injectable()
export class ContactImportParser {
  parseRows(rawText: string, defaultTags: string[]): ParsedContactImportRow[] {
    const lines = rawText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      return [];
    }

    const firstColumns = this.splitLine(lines[0]).map((part) => this.normalizeHeader(part));
    const hasHeader =
      firstColumns.includes('nome') ||
      firstColumns.includes('name') ||
      firstColumns.includes('telefone') ||
      firstColumns.includes('phone') ||
      firstColumns.includes('whatsapp');

    const rows = hasHeader ? lines.slice(1) : lines;

    return rows.map((line, index) => {
      const columns = this.splitLine(line).map((part) => part.trim());
      const phoneFromSingleColumn = columns.length === 1 ? this.normalizePhone(columns[0]) : '';
      const nameFromSingleColumn = phoneFromSingleColumn
        ? `Contato ${phoneFromSingleColumn.slice(-4)}`
        : '';

      const tags = columns[4]
        ? columns[4]
            .split(/[|,]/)
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [];

      return {
        lineNumber: hasHeader ? index + 2 : index + 1,
        name: columns[0] && !phoneFromSingleColumn ? columns[0] : nameFromSingleColumn,
        phone: this.normalizePhone(columns.length > 1 ? columns[1] : columns[0]),
        document: columns.length > 2 ? this.normalizeEmpty(columns[2]) : undefined,
        email: columns.length > 3 ? this.normalizeEmpty(columns[3]) : undefined,
        tags: [...new Set([...defaultTags, ...tags])],
        notes: columns.length > 5 ? this.normalizeEmpty(columns[5]) : undefined,
      };
    });
  }

  countRows(rawText: string): number {
    return this.parseRows(rawText, []).length;
  }

  private splitLine(line: string): string[] {
    if (line.includes('\t')) {
      return line.split('\t');
    }

    if (line.includes(';')) {
      return line.split(';');
    }

    if (line.includes('|')) {
      return line.split('|');
    }

    return line.split(',');
  }

  private normalizePhone(value?: string): string {
    return (value ?? '').replace(/\D/g, '');
  }

  private normalizeHeader(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private normalizeEmpty(value?: string): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }
}
