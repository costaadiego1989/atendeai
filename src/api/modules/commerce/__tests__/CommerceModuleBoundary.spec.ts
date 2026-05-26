import 'reflect-metadata';
import { CommerceModule } from '../commerce.module';

type ProviderEntry =
  | (new (...args: unknown[]) => unknown)
  | { provide?: unknown; useClass?: new (...args: unknown[]) => unknown };

describe('CommerceModule boundary (ADR-COMMERCE D-1)', () => {
  const providers: ProviderEntry[] =
    (Reflect.getMetadata('providers', CommerceModule) as ProviderEntry[]) ?? [];

  const providerNames = providers.map((entry) => {
    if (typeof entry === 'function') {
      return entry.name;
    }
    if (entry && typeof entry === 'object') {
      const provide =
        typeof entry.provide === 'function'
          ? (entry.provide as { name?: string }).name
          : String(entry.provide);
      const useClass = entry.useClass?.name;
      return `${provide ?? ''}:${useClass ?? ''}`;
    }
    return String(entry);
  });

  it('does not reconstruct messaging persistence internals', () => {
    expect(providerNames.join('|')).not.toContain('PrismaConversationRepository');
  });

  it('does not reconstruct the messaging queue internals', () => {
    expect(providerNames.join('|')).not.toContain('BullMQMessageQueue');
  });

  it('does not register the concrete MessagingFacade as its own provider', () => {
    expect(providerNames).not.toContain('MessagingFacade');
  });

  it('does not register the messaging WhatsApp template adapter', () => {
    expect(providerNames.join('|')).not.toContain(
      'WhatsAppTemplateMessageAdapter',
    );
  });
});
