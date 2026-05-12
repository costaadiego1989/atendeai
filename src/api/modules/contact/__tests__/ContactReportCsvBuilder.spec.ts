import { ContactReportCsvBuilder } from '../application/services/ContactReportCsvBuilder';
import { GenerateContactsReportOutput } from '../application/use-cases/interfaces/IGenerateContactsReportUseCase';

describe('ContactReportCsvBuilder', () => {
  let builder: ContactReportCsvBuilder;

  beforeEach(() => {
    builder = new ContactReportCsvBuilder();
  });

  const makeReport = (
    contacts: GenerateContactsReportOutput['contacts'] = [],
  ): GenerateContactsReportOutput => ({
    generatedAt: new Date('2024-06-15T10:00:00Z'),
    summary: {
      totalContacts: contacts.length,
      contactsWithTimelineMatch: 0,
      contactsWithoutInteraction: 0,
      pipelineContacts: 0,
      customers: 0,
      inactive: 0,
      totalTimelineEvents: 0,
      topTags: [],
      topChannels: [],
      topTimelineTypes: [],
    },
    contacts,
  });

  it('should build CSV with correct headers', () => {
    const report = makeReport([]);
    const result = builder.build(report);

    const lines = result.content.split('\n');
    expect(lines[0]).toContain('Nome');
    expect(lines[0]).toContain('Telefone');
    expect(lines[0]).toContain('Documento');
    expect(lines[0]).toContain('Email');
    expect(lines[0]).toContain('Estagio');
    expect(lines[0]).toContain('Tags');
  });

  it('should format dates as ISO strings', () => {
    const report = makeReport([
      {
        id: 'c1',
        name: 'John',
        phone: '5511999999999',
        stage: 'LEAD',
        tags: [],
        createdAt: new Date('2024-01-15T10:30:00Z'),
        updatedAt: new Date('2024-06-01T14:00:00Z'),
        lastInteraction: new Date('2024-05-20T08:00:00Z'),
        lastTimelineEventAt: new Date('2024-05-20T08:00:00Z'),
        timelineEventCount: 5,
        inboundMessages: 3,
        outboundMessages: 2,
        channels: ['WHATSAPP'],
        timelineTypes: ['MESSAGING'],
      },
    ]);

    const result = builder.build(report);

    expect(result.content).toContain('2024-05-20T08:00:00.000Z');
  });

  it('should handle empty data (header only)', () => {
    const report = makeReport([]);
    const result = builder.build(report);

    const lines = result.content.split('\n');
    expect(lines).toHaveLength(1);
    expect(result.mimeType).toBe('text/csv;charset=utf-8');
  });

  it('should escape special characters (commas, quotes) in cells', () => {
    const report = makeReport([
      {
        id: 'c1',
        name: 'John "The Boss" Doe',
        phone: '5511999999999',
        stage: 'LEAD',
        tags: ['tag,with,commas'],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-06-01'),
        timelineEventCount: 0,
        inboundMessages: 0,
        outboundMessages: 0,
        channels: [],
        timelineTypes: [],
      },
    ]);

    const result = builder.build(report);

    expect(result.content).toContain('John ""The Boss"" Doe');
    expect(result.content).toContain('tag,with,commas');
  });

  it('should include all contact fields in output rows', () => {
    const report = makeReport([
      {
        id: 'c1',
        name: 'Alice',
        phone: '5511999999999',
        document: '12345678900',
        email: 'alice@test.com',
        stage: 'PROSPECT',
        tags: ['VIP', 'Premium'],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-06-01'),
        lastInteraction: new Date('2024-05-15'),
        lastTimelineEventAt: new Date('2024-05-15'),
        timelineEventCount: 10,
        inboundMessages: 6,
        outboundMessages: 4,
        channels: ['WHATSAPP', 'INSTAGRAM'],
        timelineTypes: ['MESSAGING', 'PAYMENT'],
      },
    ]);

    const result = builder.build(report);
    const lines = result.content.split('\n');

    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('Alice');
    expect(lines[1]).toContain('5511999999999');
    expect(lines[1]).toContain('12345678900');
    expect(lines[1]).toContain('alice@test.com');
    expect(lines[1]).toContain('PROSPECT');
    expect(lines[1]).toContain('VIP | Premium');
    expect(result.fileName).toMatch(/relatorio-contatos-\d{4}-\d{2}-\d{2}\.csv/);
  });
});
