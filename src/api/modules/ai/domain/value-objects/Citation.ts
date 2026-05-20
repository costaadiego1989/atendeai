/**
 * Citation value object — represents a source reference in AI responses.
 */
export interface Citation {
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
  citations: Citation[];
}

/**
 * Formats citations for inclusion in AI response.
 */
export function formatCitations(citations: Citation[]): string {
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
