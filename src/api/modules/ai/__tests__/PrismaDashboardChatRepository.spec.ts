import { PrismaDashboardChatRepository } from '../infrastructure/persistence/PrismaDashboardChatRepository';

describe('PrismaDashboardChatRepository', () => {
  let repo: PrismaDashboardChatRepository;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      dashboardChatMessage: {
        create: jest.fn().mockResolvedValue({
          id: 'msg-1',
          tenantId: 'tenant-1',
          userId: 'user-1',
          threadId: 'thread-1',
          role: 'user',
          content: 'Hello',
          toolCalls: null,
          metadata: {},
          createdAt: new Date('2026-07-09'),
        }),
        findMany: jest.fn().mockResolvedValue([
          { id: 'msg-1', role: 'user', content: 'Hello', threadId: 'thread-1', createdAt: new Date('2026-07-09T10:00:00') },
          { id: 'msg-2', role: 'assistant', content: 'Hi!', threadId: 'thread-1', createdAt: new Date('2026-07-09T10:00:05') },
        ]),
        deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
      },
    };
    repo = new PrismaDashboardChatRepository(mockPrisma);
  });

  it('should save a message with correct data', async () => {
    await repo.saveMessage({
      tenantId: 'tenant-1',
      userId: 'user-1',
      threadId: 'thread-1',
      role: 'user',
      content: 'Qual meu faturamento?',
    });

    expect(mockPrisma.dashboardChatMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'user-1',
        threadId: 'thread-1',
        role: 'user',
        content: 'Qual meu faturamento?',
      }),
    });
  });

  it('should get history scoped by tenantId and threadId', async () => {
    const history = await repo.getHistory('tenant-1', 'thread-1', 20);

    expect(mockPrisma.dashboardChatMessage.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', threadId: 'thread-1' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    expect(history).toHaveLength(2);
    // Reversed from desc to asc (oldest first)
    expect(history[0].id).toBe('msg-2');
    expect(history[1].id).toBe('msg-1');
  });

  it('should get threads by user', async () => {
    mockPrisma.dashboardChatMessage.findMany.mockResolvedValue([
      { threadId: 'thread-a', createdAt: new Date() },
      { threadId: 'thread-b', createdAt: new Date() },
    ]);

    const threads = await repo.getThreadsByUser('tenant-1', 'user-1');
    expect(threads).toEqual(['thread-a', 'thread-b']);
  });

  it('should delete old threads', async () => {
    const cutoff = new Date('2026-07-01');
    const count = await repo.deleteOldThreads('tenant-1', cutoff);

    expect(mockPrisma.dashboardChatMessage.deleteMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        createdAt: { lt: cutoff },
      },
    });
    expect(count).toBe(5);
  });
});
