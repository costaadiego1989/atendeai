import { SocialAutoReplyRule } from '../domain/entities/SocialAutoReplyRule';

describe('SocialAutoReplyRule', () => {
  it('deve casar por palavra-chave e bloquear por exclusão', () => {
    const rule = SocialAutoReplyRule.create({
      tenantId: 'tenant-1',
      name: 'Preço',
      platform: 'INSTAGRAM',
      conditions: {
        keywords: ['preço', 'valor'],
        excludeKeywords: ['spam'],
      },
    });

    expect(rule.matchesComment('Qual o preço hoje?')).toBe(true);
    expect(rule.matchesComment('Qual o valor? spam')).toBe(false);
    expect(rule.matchesComment('Olá, tudo bem?')).toBe(false);
  });

  it('deve respeitar filtro de post quando informado', () => {
    const rule = SocialAutoReplyRule.create({
      tenantId: 'tenant-1',
      name: 'Post específico',
      platform: 'INSTAGRAM',
      conditions: {
        postIds: ['post-123'],
      },
    });

    expect(rule.matchesComment('teste', 'post-123')).toBe(true);
    expect(rule.matchesComment('teste', 'post-999')).toBe(false);
  });
});
