import { ConflictException } from '@nestjs/common';

export class SessionAlreadyProcessingException extends ConflictException {
  constructor(sessionId: string) {
    super(
      `Session ${sessionId} is already being processed. Duplicate checkout rejected.`,
    );
  }
}
