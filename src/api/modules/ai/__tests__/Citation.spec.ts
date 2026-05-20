import { formatCitations, Citation } from '../domain/value-objects/Citation';

describe('Citation', () => {
  describe('formatCitations', () => {
    it('should return empty string for empty citations', () => {
      expect(formatCitations([])).toBe('');
    });

    it('should format a single citation', () => {
      const citations: Citation[] = [
        {
          sourceId: 'src-1',
          sourceType: 'webpage',
          sourceTitle: 'FAQ Page',
          sourceUrl: 'https://example.com/faq',
          relevanceScore: 0.9,
          snippet: 'Some relevant text...',
        },
      ];

      const result = formatCitations(citations);

      expect(result).toContain('Fontes:');
      expect(result).toContain('[1]');
      expect(result).toContain('FAQ Page');
      expect(result).toContain('https://example.com/faq');
    });

    it('should format multiple citations with numbering', () => {
      const citations: Citation[] = [
        {
          sourceId: 'src-1',
          sourceType: 'document',
          sourceTitle: 'Manual do Produto',
          section: 'Instalação',
          pageNumber: 5,
          relevanceScore: 0.95,
          snippet: 'Para instalar...',
        },
        {
          sourceId: 'src-2',
          sourceType: 'webpage',
          sourceTitle: 'Blog Post',
          sourceUrl: 'https://blog.example.com/post',
          relevanceScore: 0.8,
          snippet: 'Artigo sobre...',
        },
      ];

      const result = formatCitations(citations);

      expect(result).toContain('[1]');
      expect(result).toContain('[2]');
      expect(result).toContain('Manual do Produto');
      expect(result).toContain('— Instalação');
      expect(result).toContain('(p. 5)');
      expect(result).toContain('Blog Post');
    });

    it('should include section when present', () => {
      const citations: Citation[] = [
        {
          sourceId: 'src-1',
          sourceType: 'document',
          sourceTitle: 'Docs',
          section: 'Getting Started',
          relevanceScore: 0.85,
          snippet: 'text...',
        },
      ];

      const result = formatCitations(citations);
      expect(result).toContain('— Getting Started');
    });

    it('should include page number when present', () => {
      const citations: Citation[] = [
        {
          sourceId: 'src-1',
          sourceType: 'pdf',
          sourceTitle: 'Report',
          pageNumber: 12,
          relevanceScore: 0.9,
          snippet: 'text...',
        },
      ];

      const result = formatCitations(citations);
      expect(result).toContain('(p. 12)');
    });

    it('should omit optional fields when not present', () => {
      const citations: Citation[] = [
        {
          sourceId: 'src-1',
          sourceType: 'document',
          sourceTitle: 'Simple Doc',
          relevanceScore: 0.7,
          snippet: 'text...',
        },
      ];

      const result = formatCitations(citations);
      expect(result).toContain('[1] Simple Doc');
      expect(result).not.toContain('—');
      expect(result).not.toContain('(p.');
    });
  });
});
