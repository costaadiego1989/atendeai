import { Controller, Post, Param, Req, Res, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { PrismaService } from '@shared/infrastructure/database/PrismaService';

/**
 * Handles Twilio voice webhooks for call flow control.
 * These endpoints are public (called by Twilio) — no auth guard.
 */
@Controller('voice/webhook')
export class VoiceWebhookController {
  private readonly logger = new Logger(VoiceWebhookController.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * POST /api/v1/voice/webhook/twiml/:callId
   * Returns TwiML instructions when call connects.
   */
  @Post('twiml/:callId')
  async handleTwiml(
    @Param('callId') callId: string,
    @Req() _req: Request,
    @Res() res: Response,
  ) {
    const call = await this.prisma.voiceCall.findUnique({
      where: { id: callId },
    });

    if (!call) {
      res.status(404).send('<Response><Say>Erro interno.</Say></Response>');
      return;
    }

    // Load voice agent config
    const config = await this.prisma.voiceAgentConfig.findUnique({
      where: { tenantId: call.tenantId },
    });

    const greeting =
      config?.greeting ||
      'Olá, estou entrando em contato sobre um assunto importante.';

    // Update call status
    await this.prisma.voiceCall.update({
      where: { id: callId },
      data: { status: 'IN_PROGRESS' },
    });

    // Return TwiML with greeting and gather for response
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="pt-BR" voice="Polly.Camila">${this.escapeXml(greeting)}</Say>
  <Gather input="speech" language="pt-BR" speechTimeout="3" action="/api/v1/voice/webhook/gather/${callId}" method="POST">
    <Say language="pt-BR" voice="Polly.Camila">Posso ajudar você a resolver isso agora. O que acha?</Say>
  </Gather>
  <Say language="pt-BR" voice="Polly.Camila">Não consegui ouvir sua resposta. Vou tentar novamente em outro momento. Até logo.</Say>
</Response>`;

    res.type('text/xml').send(twiml);
  }

  /**
   * POST /api/v1/voice/webhook/gather/:callId
   * Handles speech input from the caller.
   */
  @Post('gather/:callId')
  async handleGather(
    @Param('callId') callId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const speechResult = req.body?.SpeechResult || '';
    const confidence = parseFloat(req.body?.Confidence || '0');

    this.logger.log(
      `Call ${callId} speech: "${speechResult}" (confidence: ${confidence})`,
    );

    // Store transcript entry
    const call = await this.prisma.voiceCall.findUnique({
      where: { id: callId },
    });
    if (call) {
      const transcript = (call.transcript as any[]) || [];
      transcript.push({
        role: 'customer',
        text: speechResult,
        confidence,
        timestamp: new Date().toISOString(),
      });
      await this.prisma.voiceCall.update({
        where: { id: callId },
        data: { transcript },
      });
    }

    // Simple intent detection for MVP
    const lower = speechResult.toLowerCase();
    const isPositive =
      lower.includes('sim') ||
      lower.includes('quero') ||
      lower.includes('pode') ||
      lower.includes('vamos');
    const isNegative =
      lower.includes('não') ||
      lower.includes('agora não') ||
      lower.includes('depois');
    const wantsTransfer =
      lower.includes('supervisor') ||
      lower.includes('gerente') ||
      lower.includes('humano');

    let twiml: string;

    if (wantsTransfer) {
      const config = await this.prisma.voiceAgentConfig.findUnique({
        where: { tenantId: call?.tenantId || '' },
      });
      const transferTo = config?.transferPhone || '';
      if (transferTo) {
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="pt-BR" voice="Polly.Camila">Vou transferir você para um atendente. Um momento.</Say>
  <Dial>${transferTo}</Dial>
</Response>`;
      } else {
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="pt-BR" voice="Polly.Camila">Infelizmente não tenho um atendente disponível agora. Vou registrar sua solicitação e alguém entrará em contato. Obrigado.</Say>
</Response>`;
      }
      await this.prisma.voiceCall.update({
        where: { id: callId },
        data: { outcome: 'TRANSFERRED' },
      });
    } else if (isPositive) {
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="pt-BR" voice="Polly.Camila">Ótimo! Vou enviar o link de pagamento por WhatsApp agora mesmo. Você receberá em instantes. Obrigado pela atenção e tenha um bom dia!</Say>
</Response>`;
      await this.prisma.voiceCall.update({
        where: { id: callId },
        data: { outcome: 'NEGOTIATED', negotiation: { accepted: true } },
      });
    } else if (isNegative) {
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" language="pt-BR" speechTimeout="3" action="/api/v1/voice/webhook/gather/${callId}" method="POST">
    <Say language="pt-BR" voice="Polly.Camila">Entendo. Posso oferecer condições especiais como desconto para pagamento à vista ou parcelamento. Gostaria de ouvir as opções?</Say>
  </Gather>
  <Say language="pt-BR" voice="Polly.Camila">Tudo bem, vou registrar e entraremos em contato em outro momento. Obrigado.</Say>
</Response>`;
      await this.prisma.voiceCall.update({
        where: { id: callId },
        data: { outcome: 'REFUSED' },
      });
    } else {
      // Unclear response — ask again
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" language="pt-BR" speechTimeout="3" action="/api/v1/voice/webhook/gather/${callId}" method="POST">
    <Say language="pt-BR" voice="Polly.Camila">Desculpe, não entendi bem. Você gostaria de resolver o débito agora? Posso oferecer condições especiais.</Say>
  </Gather>
  <Say language="pt-BR" voice="Polly.Camila">Não consegui ouvir. Vou tentar em outro momento. Até logo.</Say>
</Response>`;
    }

    res.type('text/xml').send(twiml);
  }

  /**
   * POST /api/v1/voice/webhook/status/:callId
   * Handles call status updates from Twilio.
   */
  @Post('status/:callId')
  async handleStatus(
    @Param('callId') callId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const callStatus = req.body?.CallStatus || '';
    const duration = parseInt(req.body?.CallDuration || '0', 10);
    const recordingUrl = req.body?.RecordingUrl || null;

    this.logger.log(`Call ${callId} status update: ${callStatus}`);

    const statusMap: Record<string, string> = {
      queued: 'QUEUED',
      ringing: 'RINGING',
      'in-progress': 'IN_PROGRESS',
      completed: 'COMPLETED',
      failed: 'FAILED',
      'no-answer': 'NO_ANSWER',
      busy: 'BUSY',
    };

    const mappedStatus = statusMap[callStatus] || 'COMPLETED';

    const updateData: any = { status: mappedStatus };
    if (duration) updateData.duration = duration;
    if (recordingUrl) updateData.recordingUrl = recordingUrl;

    if (['COMPLETED', 'FAILED', 'NO_ANSWER', 'BUSY'].includes(mappedStatus)) {
      // Set outcome if not already set
      const call = await this.prisma.voiceCall.findUnique({
        where: { id: callId },
      });
      if (call && !call.outcome) {
        if (mappedStatus === 'NO_ANSWER') updateData.outcome = 'NO_ANSWER';
        if (mappedStatus === 'FAILED') updateData.outcome = 'ERROR';
      }
    }

    await this.prisma.voiceCall.update({
      where: { id: callId },
      data: updateData,
    });

    res.status(200).send('OK');
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
