import { SetMetadata } from '@nestjs/common';

export const SKIP_SUCCESS_ENVELOPE_KEY = 'skip_success_envelope';

export const SkipSuccessEnvelope = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_SUCCESS_ENVELOPE_KEY, true);
