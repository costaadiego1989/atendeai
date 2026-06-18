import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';
import {
  IVoiceCallRepository,
  TranscriptEntry,
} from '../../../application/ports/IVoiceCallRepository';
import { VoiceCall, VoiceCallStatus } from '../../../domain/entities/VoiceCall';

@Injectable()
export class PrismaVoiceCallRepository implements IVoiceCallRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, tenantId: string): Promise<VoiceCall | null> {
    const record = await this.prisma.voiceCall.findUnique({
      where: { id, tenantId },
    });
    return record as VoiceCall | null;
  }

  async save(
    call: Omit<VoiceCall, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<VoiceCall> {
    const record = await this.prisma.voiceCall.create({
      data: {
        tenantId: call.tenantId,
        contactId: call.contactId,
        recoveryCaseId: call.recoveryCaseId ?? null,
        direction: call.direction,
        status: call.status,
        externalCallId: call.externalCallId ?? null,
      },
    });
    return record as VoiceCall;
  }

  async updateStatus(
    callId: string,
    tenantId: string,
    status: VoiceCallStatus,
    extra?: Partial<
      Pick<
        VoiceCall,
        'duration' | 'recordingUrl' | 'outcome' | 'externalCallId'
      >
    >,
  ): Promise<void> {
    await this.prisma.voiceCall.update({
      where: { id: callId, tenantId },
      data: { status, ...extra },
    });
  }

  /**
   * Atomically appends a single entry to the transcript JSON array.
   * Uses a raw SQL UPDATE with the PostgreSQL `||` jsonb concatenation operator
   * so two concurrent webhook deliveries cannot overwrite each other's entry.
   * Uses Prisma.sql tagged template — never $queryRawUnsafe.
   */
  async appendTranscript(
    callId: string,
    tenantId: string,
    entry: TranscriptEntry,
  ): Promise<void> {
    // tenant-safe: WHERE clause includes AND tenant_id = ${tenantId} (Prisma.sql parameterized)
    await this.prisma.$queryRaw(
      Prisma.sql`
        UPDATE voice_schema.voice_calls
        SET transcript = COALESCE(transcript, '[]'::jsonb) || ${JSON.stringify(entry)}::jsonb
        WHERE id = ${callId}
          AND tenant_id = ${tenantId}
      `,
    );
  }
}
