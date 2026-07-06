import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AIModule } from '@modules/ai/ai.module';
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
import { VoiceConfigController } from './presentation/controllers/VoiceConfigController';
import { GetVoiceConfigUseCase } from './application/use-cases/GetVoiceConfigUseCase';
import { UpdateVoiceConfigUseCase } from './application/use-cases/UpdateVoiceConfigUseCase';
import { ListVoiceCallsUseCase } from './application/use-cases/ListVoiceCallsUseCase';
import { SuggestVoiceScriptUseCase } from './application/use-cases/SuggestVoiceScriptUseCase';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'voice-calls' }),
    AuthModule,
    forwardRef(() => AIModule),
  ],
  controllers: [VoiceWebhookController, VoiceConfigController],
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
    GetVoiceConfigUseCase,
    UpdateVoiceConfigUseCase,
    ListVoiceCallsUseCase,
    SuggestVoiceScriptUseCase,
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
