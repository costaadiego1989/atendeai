import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  IVoiceCallRepository,
  VOICE_CALL_REPOSITORY,
  TranscriptEntry,
} from '../ports/IVoiceCallRepository';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';

export interface ProcessGatherWebhookCommand {
  callId: string;
  speechResult: string;
  confidence: number;
}

export interface ProcessGatherWebhookResult {
  /** TwiML XML string to return to Twilio */
  twiml: string;
}

@Injectable()
export class ProcessGatherWebhookUseCase {
  private readonly logger = new Logger(ProcessGatherWebhookUseCase.name);

  constructor(
    @Inject(VOICE_CALL_REPOSITORY)
    private readonly voiceCallRepo: IVoiceCallRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    command: ProcessGatherWebhookCommand,
  ): Promise<ProcessGatherWebhookResult> {
    const { callId, speechResult, confidence } = command;

    this.logger.log(
      `Processing gather for call ${callId} (confidence: ${confidence})`,
    );

    // Fetch call to resolve tenantId — findById with tenantId would require tenantId
    // in the webhook; instead we do a non-scoped find then immediately scope all mutations.
    const callRecord = await this.prisma.voiceCall.findUnique({
      where: { id: callId },
    });

    if (callRecord) {
      const entry: TranscriptEntry = {
        role: 'customer',
        text: speechResult,
        confidence,
        timestamp: new Date().toISOString(),
      };
      // V1 fix: atomic JSON append — no read-modify-write race
      await this.voiceCallRepo.appendTranscript(callId, callRecord.tenantId, entry);
    }

    const lower = speechResult.toLowerCase();
    const isTransfer =
      lower.includes('supervisor') ||
      lower.includes('gerente') ||
      lower.includes('humano') ||
      lower.includes('atendente');
    const isPositive =
      lower.includes('sim') ||
      lower.includes('quero') ||
      lower.includes('pode') ||
      lower.includes('aceito') ||
      lower.includes('concordo');
    const isNegative =
      lower.includes('não') ||
      lower.includes('nao') ||
      lower.includes('recuso') ||
      lower.includes('impossível') ||
      lower.includes('agora não');

    let twiml: string;

    if (isTransfer) {
      const config = callRecord
        ? await this.prisma.voiceAgentConfig.findUnique({
            where: { tenantId: callRecord.tenantId },
          })
        : null;
      const transferPhone = config?.transferPhone || '';

      if (transferPhone) {
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="pt-BR" voice="Polly.Camila">Vou transferir sua ligação agora.</Say>
  <Dial>${this.escapeXml(transferPhone)}</Dial>
</Response>`;
        if (callRecord) {
          await this.voiceCallRepo.updateStatus(
            callId,
            callRecord.tenantId,
            'IN_PROGRESS',
            { outcome: 'TRANSFERRED' },
          );
        }
      } else {
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="pt-BR" voice="Polly.Camila">Desculpe, não tenho um atendente disponível agora. Vou registrar sua solicitação e alguém entrará em contato. Obrigado.</Say>
</Response>`;
      }
    } else if (isPositive) {
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="pt-BR" voice="Polly.Camila">Ótimo! Vou enviar o link de pagamento por WhatsApp agora mesmo. Você receberá em instantes. Obrigado pela atenção e tenha um bom dia!</Say>
</Response>`;
      if (callRecord) {
        await this.voiceCallRepo.updateStatus(
          callId,
          callRecord.tenantId,
          'IN_PROGRESS',
          { outcome: 'NEGOTIATED' },
        );
      }
    } else if (isNegative) {
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" language="pt-BR" speechTimeout="3" action="/api/v1/voice/webhook/gather/${callId}" method="POST">
    <Say language="pt-BR" voice="Polly.Camila">Entendo. Posso oferecer condições especiais. Gostaria de saber mais?</Say>
  </Gather>
  <Say language="pt-BR" voice="Polly.Camila">Tudo bem, vou registrar e entraremos em contato em outro momento. Até logo.</Say>
</Response>`;
      if (callRecord) {
        await this.voiceCallRepo.updateStatus(
          callId,
          callRecord.tenantId,
          'IN_PROGRESS',
          { outcome: 'REFUSED' },
        );
      }
    } else {
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" language="pt-BR" speechTimeout="3" action="/api/v1/voice/webhook/gather/${callId}" method="POST">
    <Say language="pt-BR" voice="Polly.Camila">Desculpe, não entendi bem. Poderia repetir?</Say>
  </Gather>
</Response>`;
    }

    return { twiml };
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
