import { ZodError } from 'zod';

export class StructuredOutputParseError extends Error {
  constructor(
    message: string,
    public readonly lastAttempt: unknown,
    public readonly zodErrors: ZodError | null,
  ) {
    super(message);
    this.name = 'StructuredOutputParseError';
  }
}
