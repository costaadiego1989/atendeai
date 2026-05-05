import { Injectable } from '@nestjs/common';

export interface ParsedCatalogImportRow {
  lineNumber: number;
  type?: 'SERVICE' | 'PRODUCT' | 'RENTAL';
  name: string;
  description?: string;
  basePrice?: string;
  currency?: string;
  categoryName?: string;
  tags: string[];
  source?: 'MANUAL' | 'IMPORT' | 'ERP_SNAPSHOT';
  externalReference?: string;
  imageUrl?: string;
  sku?: string;
  availableQuantity?: number;
  availabilityStatus?: 'AVAILABLE' | 'LOW_STOCK' | 'UNAVAILABLE' | 'RESERVED';
  currentPrice?: string;
  hasInventoryData: boolean;
}

export interface CatalogImportDefaults {
  defaultType?: 'SERVICE' | 'PRODUCT' | 'RENTAL';
  defaultCategoryName?: string;
  defaultSource?: 'MANUAL' | 'IMPORT' | 'ERP_SNAPSHOT';
  defaultTags?: string[];
}

type CanonicalColumn =
  | 'type'
  | 'name'
  | 'description'
  | 'basePrice'
  | 'currency'
  | 'categoryName'
  | 'tags'
  | 'source'
  | 'externalReference'
  | 'imageUrl'
  | 'sku'
  | 'availableQuantity'
  | 'availabilityStatus'
  | 'currentPrice';

const COLUMN_SYNONYMS: Record<CanonicalColumn, string[]> = {
  type: ['type', 'tipo'],
  name: ['name', 'nome', 'produto', 'item', 'product name', 'nome produto', 'nome item'],
  description: ['description', 'descrição', 'descrição', 'detalhes', 'details'],
  basePrice: ['base price', 'preço', 'preço', 'valor', 'price', 'valor base', 'preço base', 'preço base'],
  currency: ['currency', 'moeda'],
  categoryName: ['category', 'categoria', 'grupo', 'department', 'departamento'],
  tags: ['tags', 'tag', 'labels', 'etiquetas'],
  source: ['source', 'origem'],
  externalReference: ['external reference', 'referência', 'referência', 'codigo', 'código', 'code', 'id externo', 'ref'],
  imageUrl: ['image', 'image url', 'imagem', 'foto', 'url imagem', 'url image'],
  sku: ['sku', 'codigo sku', 'codigo interno', 'código interno', 'ref sku'],
  availableQuantity: ['quantity', 'qty', 'estoque', 'stock', 'saldo', 'quantidade', 'qtd', 'available quantity'],
  availabilityStatus: ['status', 'availability', 'disponibilidade', 'status estoque', 'status do estoque'],
  currentPrice: ['current price', 'preço atual', 'preço atual', 'sale price', 'valor atual'],
};

const POSITIONAL_COLUMNS: CanonicalColumn[] = [
  'type',
  'name',
  'description',
  'basePrice',
  'currency',
  'categoryName',
  'tags',
  'source',
  'externalReference',
  'imageUrl',
  'sku',
  'availableQuantity',
  'availabilityStatus',
  'currentPrice',
];

@Injectable()
export class CatalogImportParser {
  parseRows(rawText: string, defaults: CatalogImportDefaults = {}): ParsedCatalogImportRow[] {
    const lines = rawText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      return [];
    }

    const delimiter = this.detectDelimiter(lines.slice(0, 5));
    const firstColumns = this.parseLine(lines[0], delimiter);
    const headerMap = this.mapHeader(firstColumns);
    const recognizedHeaders = Object.values(headerMap).filter(Boolean).length;
    const hasHeader = recognizedHeaders >= 2;
    const rows = hasHeader ? lines.slice(1) : lines;

    return rows
      .map((line, index) =>
        this.mapRow(
          hasHeader ? index + 2 : index + 1,
          this.parseLine(line, delimiter),
          hasHeader ? headerMap : null,
          defaults,
        ),
      )
      .filter((row) => row.name || row.externalReference || row.sku);
  }

  countRows(rawText: string, defaults: CatalogImportDefaults = {}): number {
    return this.parseRows(rawText, defaults).length;
  }

  private mapRow(
    lineNumber: number,
    columns: string[],
    headerMap: Partial<Record<number, CanonicalColumn>> | null,
    defaults: CatalogImportDefaults,
  ): ParsedCatalogImportRow {
    const getValue = (column: CanonicalColumn): string | undefined => {
      if (headerMap) {
        const entry = Object.entries(headerMap).find(([, mapped]) => mapped === column);
        if (!entry) {
          return undefined;
        }

        return this.normalizeEmpty(columns[Number(entry[0])]);
      }

      const position = POSITIONAL_COLUMNS.indexOf(column);
      return position >= 0 ? this.normalizeEmpty(columns[position]) : undefined;
    };

    const tags = [
      ...(defaults.defaultTags ?? []),
      ...this.parseTags(getValue('tags')),
    ];
    const type = this.normalizeType(getValue('type') ?? defaults.defaultType);
    const basePrice = this.normalizeMoney(getValue('basePrice'));
    const currentPrice = this.normalizeMoney(getValue('currentPrice'));
    const availableQuantity = this.normalizeQuantity(getValue('availableQuantity'));
    const availabilityStatus = this.normalizeAvailabilityStatus(getValue('availabilityStatus'));
    const categoryName = this.normalizeEmpty(getValue('categoryName') ?? defaults.defaultCategoryName);
    const source = this.normalizeSource(getValue('source') ?? defaults.defaultSource);
    const externalReference = this.normalizeEmpty(getValue('externalReference'));
    const sku = this.normalizeEmpty(getValue('sku'));
    const name =
      this.normalizeEmpty(getValue('name')) ??
      this.normalizeEmpty(externalReference) ??
      this.normalizeEmpty(sku) ??
      '';

    return {
      lineNumber,
      type,
      name,
      description: this.normalizeEmpty(getValue('description')),
      basePrice,
      currency: this.normalizeEmpty(getValue('currency')) ?? 'BRL',
      categoryName,
      tags: [...new Set(tags)],
      source,
      externalReference,
      imageUrl: this.normalizeEmpty(getValue('imageUrl')),
      sku,
      availableQuantity,
      availabilityStatus,
      currentPrice,
      hasInventoryData:
        Boolean(sku) ||
        typeof availableQuantity === 'number' ||
        Boolean(currentPrice) ||
        Boolean(availabilityStatus),
    };
  }

  private mapHeader(columns: string[]): Partial<Record<number, CanonicalColumn>> {
    const mapping: Partial<Record<number, CanonicalColumn>> = {};

    columns.forEach((column, index) => {
      const normalized = this.normalizeHeader(column);
      const canonical = (Object.entries(COLUMN_SYNONYMS) as Array<[CanonicalColumn, string[]]>).find(
        ([, synonyms]) => synonyms.some((synonym) => normalized.includes(this.normalizeHeader(synonym))),
      )?.[0];

      if (canonical) {
        mapping[index] = canonical;
      }
    });

    return mapping;
  }

  private detectDelimiter(lines: string[]): string {
    const delimiters = [';', ',', '\t', '|'];
    const scored = delimiters.map((delimiter) => ({
      delimiter,
      score: lines.reduce((total, line) => total + this.countDelimiter(line, delimiter), 0),
    }));

    return scored.sort((left, right) => right.score - left.score)[0]?.delimiter ?? ';';
  }

  private countDelimiter(line: string, delimiter: string): number {
    return line.split(delimiter).length - 1;
  }

  private parseLine(line: string, delimiter: string): string[] {
    const columns: string[] = [];
    let current = '';
    let insideQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];

      if (char === '"') {
        if (insideQuotes && next === '"') {
          current += '"';
          index += 1;
          continue;
        }

        insideQuotes = !insideQuotes;
        continue;
      }

      if (char === delimiter && !insideQuotes) {
        columns.push(current.trim());
        current = '';
        continue;
      }

      current += char;
    }

    columns.push(current.trim());
    return columns;
  }

  private parseTags(value?: string): string[] {
    return (value ?? '')
      .split(/[|,]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  private normalizeHeader(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private normalizeType(value?: string): 'SERVICE' | 'PRODUCT' | 'RENTAL' | undefined {
    const normalized = this.normalizeHeader(value ?? '');
    if (!normalized) {
      return undefined;
    }

    if (['service', 'serviço', 'serviços'].includes(normalized)) {
      return 'SERVICE';
    }

    if (['rental', 'rent', 'locação', 'locacoes'].includes(normalized)) {
      return 'RENTAL';
    }

    return 'PRODUCT';
  }

  private normalizeSource(value?: string): 'MANUAL' | 'IMPORT' | 'ERP_SNAPSHOT' | undefined {
    const normalized = this.normalizeHeader(value ?? '');
    if (!normalized) {
      return undefined;
    }

    if (normalized.includes('erp')) {
      return 'ERP_SNAPSHOT';
    }

    if (normalized.includes('import')) {
      return 'IMPORT';
    }

    return 'MANUAL';
  }

  private normalizeAvailabilityStatus(
    value?: string,
  ): 'AVAILABLE' | 'LOW_STOCK' | 'UNAVAILABLE' | 'RESERVED' | undefined {
    const normalized = this.normalizeHeader(value ?? '');
    if (!normalized) {
      return undefined;
    }

    if (normalized.includes('low') || normalized.includes('baixo')) {
      return 'LOW_STOCK';
    }

    if (normalized.includes('reserv')) {
      return 'RESERVED';
    }

    if (normalized.includes('indispon') || normalized.includes('unavailable') || normalized.includes('sem estoque')) {
      return 'UNAVAILABLE';
    }

    return 'AVAILABLE';
  }

  private normalizeMoney(value?: string): string | undefined {
    const trimmed = this.normalizeEmpty(value);
    if (!trimmed) {
      return undefined;
    }

    const sanitized = trimmed
      .replace(/[R$\s]/gi, '')
      .replace(/\.(?=\d{3}(?:\D|$))/g, '')
      .replace(',', '.')
      .replace(/[^\d.-]/g, '');

    const parsed = Number(sanitized);
    return Number.isFinite(parsed) ? parsed.toFixed(2) : undefined;
  }

  private normalizeQuantity(value?: string): number | undefined {
    const trimmed = this.normalizeEmpty(value);
    if (!trimmed) {
      return undefined;
    }

    const sanitized = trimmed.replace(/[^\d-]/g, '');
    const parsed = Number(sanitized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private normalizeEmpty(value?: string): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }
}
