import { PrismaVoiceCallRepository } from '../infrastructure/persistence/repositories/PrismaVoiceCallRepository';
import { Prisma } from '@prisma/client';

describe('PrismaVoiceCallRepository', () => {
  let repo: PrismaVoiceCallRepository;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      voiceCall: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };
    repo = new PrismaVoiceCallRepository(prisma);
  });

  describe('findById', () => {
    it('should query with both id and tenantId (prevents cross-tenant read)', async () => {
      prisma.voiceCall.findUnique.mockResolvedValue({ id: 'call-1', tenantId: 'tenant-1' });

      const result = await repo.findById('call-1', 'tenant-1');

      expect(prisma.voiceCall.findUnique).toHaveBeenCalledWith({
        where: { id: 'call-1', tenantId: 'tenant-1' },
      });
      expect(result?.id).toBe('call-1');
    });

    it('should return null when not found', async () => {
      prisma.voiceCall.findUnique.mockResolvedValue(null);

      const result = await repo.findById('missing', 'tenant-1');

      expect(result).toBeNull();
    });
  });

  describe('save', () => {
    it('should create a voice call record and return it', async () => {
      const created = {
        id: 'call-new',
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        direction: 'OUTBOUND',
        status: 'QUEUED',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.voiceCall.create.mockResolvedValue(created);

      const result = await repo.save({
        tenantId: 'tenant-1',
        contactId: 'contact-1',
        recoveryCaseId: null,
        direction: 'OUTBOUND',
        status: 'QUEUED',
      });

      expect(prisma.voiceCall.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            contactId: 'contact-1',
            direction: 'OUTBOUND',
            status: 'QUEUED',
          }),
        }),
      );
      expect(result.id).toBe('call-new');
    });
  });

  describe('updateStatus', () => {
    it('should update with tenantId scope', async () => {
      prisma.voiceCall.update.mockResolvedValue({});

      await repo.updateStatus('call-1', 'tenant-1', 'COMPLETED', { duration: 60 });

      expect(prisma.voiceCall.update).toHaveBeenCalledWith({
        where: { id: 'call-1', tenantId: 'tenant-1' },
        data: { status: 'COMPLETED', duration: 60 },
      });
    });

    it('should update with externalCallId when provided', async () => {
      prisma.voiceCall.update.mockResolvedValue({});

      await repo.updateStatus('call-1', 'tenant-1', 'RINGING', {
        externalCallId: 'twilio-ext-123',
      });

      expect(prisma.voiceCall.update).toHaveBeenCalledWith({
        where: { id: 'call-1', tenantId: 'tenant-1' },
        data: { status: 'RINGING', externalCallId: 'twilio-ext-123' },
      });
    });
  });

  describe('appendTranscript (V1: atomic JSON append, no race condition)', () => {
    it('should call $queryRaw with Prisma.sql (never $queryRawUnsafe)', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      const entry = {
        role: 'customer' as const,
        text: 'Sim, quero pagar',
        confidence: 0.95,
        timestamp: '2024-01-01T10:00:00.000Z',
      };

      await repo.appendTranscript('call-1', 'tenant-1', entry);

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      // The argument must be a Prisma SQL template (TemplateStringsArray-based),
      // not a raw string — this ensures Prisma.sql was used (parameterized query).
      const [sqlArg] = prisma.$queryRaw.mock.calls[0];
      expect(sqlArg).toBeDefined();
      // Prisma.sql returns an object with a 'strings' array and 'values' array
      expect(typeof sqlArg).toBe('object');
      expect(Array.isArray((sqlArg as any).strings)).toBe(true);
    });

    it('should use COALESCE to handle NULL transcript columns', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      const entry = {
        role: 'customer' as const,
        text: 'test',
        confidence: 0.8,
        timestamp: '2024-01-01T10:00:00.000Z',
      };

      await repo.appendTranscript('call-1', 'tenant-1', entry);

      const [sqlArg] = prisma.$queryRaw.mock.calls[0];
      const sqlString = (sqlArg as any).strings.join('');
      expect(sqlString).toContain('COALESCE');
      expect(sqlString).toContain('voice_calls');
    });

    it('should embed callId and tenantId as query parameters (not string-interpolated)', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      const entry = {
        role: 'customer' as const,
        text: 'test',
        confidence: 0.8,
        timestamp: '2024-01-01T10:00:00.000Z',
      };

      await repo.appendTranscript('call-1', 'tenant-1', entry);

      const [sqlArg] = prisma.$queryRaw.mock.calls[0];
      // callId and tenantId should appear as parameterized values, not baked into SQL strings
      const sqlStrings = (sqlArg as any).strings.join('');
      expect(sqlStrings).not.toContain('call-1');
      expect(sqlStrings).not.toContain('tenant-1');
      const values = (sqlArg as any).values;
      expect(values).toContain('call-1');
      expect(values).toContain('tenant-1');
    });
  });
});
