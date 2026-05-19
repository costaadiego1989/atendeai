import { PlatformMessagingReadDao } from '../infrastructure/daos/PlatformMessagingReadDao';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';

describe('PlatformMessagingReadDao', () => {
  const prisma = {
    conversation: {
      count: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    message: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    tenant: {
      findMany: jest.fn(),
    },
  } as unknown as PrismaService;

  const dao = new PlatformMessagingReadDao(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('returns messaging metrics with channel and status breakdown', async () => {
    (prisma.conversation.count as jest.Mock)
      .mockResolvedValueOnce(25) // active conversations
      .mockResolvedValueOnce(5); // unanswered > 1h
    (prisma.conversation.groupBy as jest.Mock)
      .mockResolvedValueOnce([
        { channel: 'WHATSAPP', _count: 20 },
        { channel: 'INSTAGRAM', _count: 5 },
      ])
      .mockResolvedValueOnce([
        { status: 'ACTIVE', _count: 25 },
        { status: 'CLOSED', _count: 10 },
      ])
      .mockResolvedValueOnce([
        { tenantId: 't1', _count: 15 },
        { tenantId: 't2', _count: 10 },
      ]);
    (prisma.message.count as jest.Mock)
      .mockResolvedValueOnce(500) // sent
      .mockResolvedValueOnce(300); // received
    (prisma.message.groupBy as jest.Mock).mockResolvedValue([
      { sentBy: 'AI', _count: 200 },
      { sentBy: 'HUMAN', _count: 300 },
    ]);
    (prisma.tenant.findMany as jest.Mock).mockResolvedValue([
      { id: 't1', companyName: 'Acme' },
      { id: 't2', companyName: 'Beta' },
    ]);

    const result = await dao.getMetrics({ period: '30d' });

    expect(result.totalActiveConversations).toBe(25);
    expect(result.conversationsByChannel).toEqual({ WHATSAPP: 20, INSTAGRAM: 5 });
    expect(result.conversationsByStatus).toEqual({ ACTIVE: 25, CLOSED: 10 });
    expect(result.totalMessagesSent).toBe(500);
    expect(result.totalMessagesReceived).toBe(300);
    expect(result.messagesBySentBy).toEqual({ AI: 200, HUMAN: 300 });
    expect(result.unansweredOver1h).toBe(5);
    expect(result.topTenantsByConversations).toHaveLength(2);
    expect(result.topTenantsByConversations[0].companyName).toBe('Acme');
  });

  it('lists conversations with contact info', async () => {
    (prisma.conversation.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'c1',
        tenantId: 't1',
        channel: 'WHATSAPP',
        status: 'ACTIVE',
        assignedUserId: null,
        lastMessagePreview: 'Hello',
        lastMessageAt: new Date(),
        lastMessageDirection: 'INBOUND',
        startedAt: new Date(),
        unreadCount: 2,
        contact: { name: 'John', phone: '+5511999999999' },
      },
    ]);
    (prisma.conversation.count as jest.Mock).mockResolvedValue(1);
    (prisma.tenant.findMany as jest.Mock).mockResolvedValue([
      { id: 't1', companyName: 'Acme' },
    ]);

    const result = await dao.listConversations({ page: 1, limit: 20 });

    expect(result.total).toBe(1);
    expect(result.items[0].contactName).toBe('John');
    expect(result.items[0].companyName).toBe('Acme');
    expect(result.items[0].channel).toBe('WHATSAPP');
  });
});
