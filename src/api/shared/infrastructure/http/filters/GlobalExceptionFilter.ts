import {
  Injectable,
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientRustPanicError,
  PrismaClientUnknownRequestError,
  PrismaClientValidationError,
} from '@prisma/client/runtime/library';
import {
  BaseException,
  EntityNotFoundException,
  ValidationErrorException,
  UnauthorizedException,
  ForbiddenException,
} from '../../../domain/exceptions/DomainExceptions';
import { StructuredLogEmitter } from '../../observability/StructuredLogEmitter';
import { context as otContext, trace } from '@opentelemetry/api';

interface ExceptionPayload {
  status: HttpStatus;
  code: string;
  message: string;
}

@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly log?: StructuredLogEmitter) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const { status, code, message } = this.handleException(exception);

    const active = otContext.active();
    const sc = trace.getSpan(active)?.spanContext();
    const traceId = sc?.traceId ?? '';
    const spanId = sc?.spanId ?? '';

    const prismaCode =
      exception instanceof PrismaClientKnownRequestError ? exception.code : undefined;
    const rawMessage =
      exception instanceof Error ? exception.message : undefined;

    this.log?.emit({
      level:
        status >= HttpStatus.INTERNAL_SERVER_ERROR ? 'error' : 'warn',
      event: 'http.exception',
      message: String(message),
      traceId,
      spanId,
      attributes: {
        error_code: code,
        http_status: String(status),
        ...(prismaCode && { prisma_code: prismaCode }),
        ...(rawMessage && status >= HttpStatus.INTERNAL_SERVER_ERROR && { raw_error: rawMessage.slice(0, 500) }),
      },
    });

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        timestamp: new Date().toISOString(),
      },
    });
  }

  private handleException(exception: unknown): ExceptionPayload {
    if (exception instanceof HttpException) {
      return this.handleHttpException(exception);
    }

    if (exception instanceof UnauthorizedException) {
      return this.createErrorPayload(HttpStatus.UNAUTHORIZED, exception.code!, exception.message);
    }

    if (exception instanceof ForbiddenException) {
      return this.createErrorPayload(HttpStatus.FORBIDDEN, exception.code!, exception.message);
    }

    if (exception instanceof EntityNotFoundException) {
      return this.createErrorPayload(HttpStatus.NOT_FOUND, exception.code!, exception.message);
    }

    if (exception instanceof ValidationErrorException) {
      return this.createErrorPayload(HttpStatus.BAD_REQUEST, exception.code!, exception.message);
    }

    if (exception instanceof BaseException) {
      return this.createErrorPayload(
        HttpStatus.UNPROCESSABLE_ENTITY,
        exception.code || 'DOMAIN_ERROR',
        exception.message
      );
    }

    if (exception instanceof PrismaClientKnownRequestError) {
      return this.handlePrismaKnownError(exception);
    }

    if (this.isPrismaUnknownError(exception)) {
      return this.createErrorPayload(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'DATABASE_ERROR',
        'Database operation failed'
      );
    }

    if (exception instanceof Error) {
      return this.createErrorPayload(HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR', exception.message);
    }

    return this.createErrorPayload(HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR', 'Internal server error');
  }

  private handleHttpException(exception: HttpException): ExceptionPayload {
    const res = exception.getResponse() as any;
    const message = res.message || exception.message;
    const code = res.error || 'HTTP_ERROR';
    
    return this.createErrorPayload(exception.getStatus(), code, message);
  }

  private handlePrismaKnownError(exception: PrismaClientKnownRequestError): ExceptionPayload {
    if (exception.code === 'P2002') {
      return this.handlePrismaUniqueConstraint(exception);
    }

    if (exception.code === 'P2025') {
      return this.createErrorPayload(HttpStatus.NOT_FOUND, 'RESOURCE_NOT_FOUND', 'Resource not found');
    }

    return this.createErrorPayload(HttpStatus.INTERNAL_SERVER_ERROR, 'DATABASE_ERROR', 'Database operation failed');
  }

  private handlePrismaUniqueConstraint(exception: PrismaClientKnownRequestError): ExceptionPayload {
    const target = Array.isArray(exception.meta?.target)
      ? exception.meta?.target.join(', ')
      : String(exception.meta?.target ?? '');
      
    const normalizedTarget = target.toLowerCase();

    if (normalizedTarget.includes('email')) {
      return this.createErrorPayload(HttpStatus.CONFLICT, 'RESOURCE_ALREADY_EXISTS', 'Email already registered');
    }

    if (normalizedTarget.includes('cnpj')) {
      return this.createErrorPayload(HttpStatus.CONFLICT, 'RESOURCE_ALREADY_EXISTS', 'CNPJ already registered');
    }

    if (normalizedTarget.includes('cpf')) {
      return this.createErrorPayload(HttpStatus.CONFLICT, 'RESOURCE_ALREADY_EXISTS', 'CPF already registered');
    }

    return this.createErrorPayload(HttpStatus.CONFLICT, 'RESOURCE_ALREADY_EXISTS', 'Resource already exists');
  }

  private isPrismaUnknownError(exception: unknown): boolean {
    return (
      exception instanceof PrismaClientValidationError ||
      exception instanceof PrismaClientUnknownRequestError ||
      exception instanceof PrismaClientRustPanicError ||
      exception instanceof PrismaClientInitializationError
    );
  }

  private createErrorPayload(status: HttpStatus, code: string, message: string): ExceptionPayload {
    return { status, code, message };
  }
}
