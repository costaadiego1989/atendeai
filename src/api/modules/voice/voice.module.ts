import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TwilioTelephonyAdapter } from './infrastructure/adapters/TwilioTelephonyAdapter';
import { ElevenLabsTTSAdapter } from './infrastructure/adapters/ElevenLabsTTSAdapter';
import { DeepgramSTTAdapter } from './infrastructure/adapters/DeepgramSTTAdapter';
import { TELEPHONY_PROVIDER } from './application/ports/ITelephonyProvider';
import { TTS_PROVIDER } from './application/ports/ITTSProvider';
import { STT_PROVIDER } from './application/ports/ISTTProvider';
import { VoiceNegotiationService } from './application/services/VoiceNegotiationService';
import { MakeOutboundCallUseCase } from './application/use-cases/MakeOutboundCallUseCase';
import { VoiceCallWorker } from './infrastructure/queue/VoiceCallWorker';
import { VoiceWebhookController } from './presentation/controllers/VoiceWebhookController';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'voice-calls' }),
  ],
  controllers: [VoiceWebhookController],
  providers: [
    {
      provide: TELEPHONY_PROVIDER,
      useClass: TwilioTelephonyAdapter,
    },
    {
      provide: TTS_PROVIDER,
      useClass: ElevenLabsTTSAdapter,
    },
    {
      provide: STT_PROVIDER,
      useClass: DeepgramSTTAdapter,
    },
    TwilioTelephonyAdapter,
    ElevenLabsTTSAdapter,
    DeepgramSTTAdapter,
    VoiceNegotiationService,
    MakeOutboundCallUseCase,
    VoiceCallWorker,
  ],
  exports: [
    MakeOutboundCallUseCase,
    VoiceNegotiationService,
    TELEPHONY_PROVIDER,
    TTS_PROVIDER,
    STT_PROVIDER,
  ],
})
export class VoiceModule {}
