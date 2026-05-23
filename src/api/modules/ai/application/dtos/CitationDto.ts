export interface CitationDto {
  sourceId: string;
  sourceType: string;
  sourceTitle: string;
  sourceUrl?: string;
  pageNumber?: number;
  section?: string;
  relevanceScore: number;
  snippet: string;
}

export interface RAGResultWithCitations {
  context: string;
  citations: CitationDto[];
}

export function formatCitations(citations: CitationDto[]): string {
  if (citations.length === 0) return '';

  const lines = citations.map((c, i) => {
    const parts = [`[${i + 1}]`];
    parts.push(c.sourceTitle);
    if (c.section) parts.push(`— ${c.section}`);
    if (c.pageNumber) parts.push(`(p. ${c.pageNumber})`);
    if (c.sourceUrl) parts.push(`(${c.sourceUrl})`);
    return parts.join(' ');
  });

  return '\n\nFontes:\n' + lines.join('\n');
}
